import { SignalError, cohort, identity, object, observation, result, ENUMS } from './contract.ts';
import { Store } from './store.ts';
import type { Database } from './store.ts';
type Environment = { DB?: Database; REPORTING_ENABLED?: string };
const limits = new WeakMap<object, { window: number; used: number }>();
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
async function body(request: Request) {
  if (
    !request.headers.get('content-type')?.startsWith('application/json') ||
    Number(request.headers.get('content-length')) > 8192
  )
    throw new SignalError('invalid_request');
  const reader = request.body?.getReader();
  if (!reader) throw new SignalError('invalid_request');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new SignalError('invalid_request');
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return object(JSON.parse(new TextDecoder().decode(buffer)));
  } catch {
    throw new SignalError('invalid_request');
  }
}
export const tools = ['check_reports', 'report_failure', 'report_recovery'].map((name) => ({
  name,
  description:
    'Return unverified report counts for an exact cohort. Counts are not independent people or confirmed outages. Never send diagnostics, URLs, names, or account details.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cohort: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.entries(ENUMS).map(([key, values]) => [key, { type: 'string', enum: values }]),
        ),
        required: Object.keys(ENUMS),
      },
      ...(name !== 'check_reports'
        ? {
            capability: {
              type: 'string',
              maxLength: 80,
              description:
                'Locally generated, rotating random reporter bearer capability; never a user identifier.',
            },
            sequence: { type: 'integer', minimum: 1 },
          }
        : {}),
    },
    required: name === 'check_reports' ? ['cohort'] : ['cohort', 'capability', 'sequence'],
  },
}));
export async function handle(
  request: Request,
  env: Environment,
  now = Date.now(),
): Promise<Response> {
  let rpcId: unknown = null,
    rpc = false,
    toolCall = false;
  try {
    // Early isolate-local admission control bounds parsing and database access.
    // Platform-wide read/traffic ceilings are a separate launch gate.
    const budget = limits.get(env) ?? { window: now, used: 0 };
    if (now - budget.window >= 60_000) {
      budget.window = now;
      budget.used = 0;
    }
    limits.set(env, budget);
    if (++budget.used > 120) throw new SignalError('rate_limited', 429);
    const url = new URL(request.url);
    rpc = url.pathname === '/mcp';
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'invalid_origin' }, 403);
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    if (url.search) throw new SignalError('invalid_request');
    const version = request.headers.get('MCP-Protocol-Version');
    if (rpc && version && !['2025-11-25', '2025-03-26'].includes(version))
      throw new SignalError('invalid_request');
    const data = await body(request);
    let action = url.pathname.split('/').pop(),
      args = data;
    if (rpc) {
      if (data.jsonrpc !== '2.0') throw new SignalError('invalid_request');
      if (data.method === 'notifications/initialized' && !('id' in data))
        return new Response(null, { status: 202 });
      const validId =
        (typeof data.id === 'number' && Number.isSafeInteger(data.id)) ||
        (typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 64);
      if (!validId) throw new SignalError('invalid_request');
      rpcId = data.id;
      if (data.method === 'initialize') {
        return json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: { tools: {} },
            serverInfo: { name: 'agent-signal', version: '0.1.0' },
          },
        });
      }
      if (data.method === 'ping') return json({ jsonrpc: '2.0', id: rpcId, result: {} });
      if (data.method === 'tools/list')
        return json({ jsonrpc: '2.0', id: rpcId, result: { tools } });
      if (data.method !== 'tools/call') throw new SignalError('invalid_request');
      const params = object(data.params);

      const actions: Record<string, string> = {
        check_reports: 'check',
        report_failure: 'failure',
        report_recovery: 'recovery',
      };
      action = typeof params.name === 'string' ? actions[params.name] : undefined;
      if (!action) throw new SignalError('invalid_request');
      toolCall = true;
      args = object(params.arguments);
    } else if (!['/api/v1/check', '/api/v1/failure', '/api/v1/recovery'].includes(url.pathname))
      throw new SignalError('invalid_request');
    if (!env.DB || env.REPORTING_ENABLED !== 'true') throw new SignalError('unavailable', 503);
    const store = new Store(env.DB);
    let counts;
    if (action === 'check') counts = await store.check(cohort(args.cohort), now);
    else if (action === 'failure' || action === 'recovery') {
      const token = rpc
        ? args.capability
        : request.headers.get('authorization')?.replace(/^Bearer /, '');
      counts = await store.report(observation(args, action), await identity(token, now), now);
    } else throw new SignalError('invalid_request');
    const answer = result(counts, now);
    return rpc
      ? json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            content: [{ type: 'text', text: JSON.stringify(answer) }],
            structuredContent: answer,
          },
        })
      : json(answer);
  } catch (error) {
    const safe = error instanceof SignalError ? error : new SignalError('unavailable', 503);
    // No logging, exception text, raw request, or upstream output escapes here.
    if (rpc && toolCall)
      return json({
        jsonrpc: '2.0',
        id: rpcId,
        result: { isError: true, content: [{ type: 'text', text: safe.code }] },
      });
    return rpc
      ? json(
          { jsonrpc: '2.0', id: rpcId, error: { code: -32600, message: safe.code } },
          safe.status,
        )
      : json({ error: safe.code }, safe.status);
  }
}
