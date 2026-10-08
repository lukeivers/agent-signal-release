import { handle } from './http.ts';
import { scheduleCleanup } from './maintenance.ts';
import { WINDOW_MS } from './contract.ts';
import type { Database } from './store.ts';

export type GatewayEnvironment = {
  DB?: Database;
  BACKEND_MODE?: string;
  PUBLIC_ENABLED?: string;
  REPORTING_ENABLED?: string;
  PRIVATE_ACCESS_TOKEN?: string;
  STATE_EPOCH?: string;
};
export async function gatewayFetch(request: Request, env: GatewayEnvironment, now = Date.now()) {
  const unavailable = () =>
    Response.json(
      { error: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  if (
    env.PUBLIC_ENABLED !== 'true' &&
    (!env.PRIVATE_ACCESS_TOKEN ||
      env.PRIVATE_ACCESS_TOKEN.length < 32 ||
      request.headers.get('X-Agent-Signal-Private') !== env.PRIVATE_ACCESS_TOKEN)
  )
    return unavailable();
  if (env.BACKEND_MODE !== 'cloudflare') return unavailable();
  const epoch = Date.parse(env.STATE_EPOCH ?? '');
  if (!Number.isFinite(epoch) || epoch > now || new Date(epoch).toISOString() !== env.STATE_EPOCH)
    return unavailable();
  try {
    const response = await handle(request, env, now);
    response.headers.set('X-Agent-Signal-Backend', env.BACKEND_MODE!);
    response.headers.set('X-Agent-Signal-Epoch', env.STATE_EPOCH!);
    response.headers.set('X-Agent-Signal-Warming', String(now < epoch + WINDOW_MS));
    return response;
  } catch {
    return unavailable();
  }
}
const worker = {
  fetch(request: Request, env: GatewayEnvironment) {
    return gatewayFetch(request, env);
  },
  scheduled(
    _event: unknown,
    env: GatewayEnvironment,
    context: { waitUntil(work: Promise<void>): void },
  ) {
    scheduleCleanup(env, context);
  },
};
export default worker;
