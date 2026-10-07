import { SignalError, DAILY_LIMIT, type Aggregate } from './contract.ts';
import { readSignalObject, type Backend } from './http.ts';

export function sitesBackend(
  origin: string,
  secret: string,
  send: typeof fetch = (input, init) => globalThis.fetch(input, init),
): Backend {
  const url = new URL(origin);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.chatgpt.site') ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !secret ||
    /[\r\n]/.test(secret)
  )
    throw new SignalError('unavailable', 503);
  async function invoke(action: string, payload: unknown, capability?: string): Promise<Aggregate> {
    // A new request, never a clone: no client cookies, IP headers, IDs, RPC metadata or diagnostics.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'OAI-Sites-Authorization': `Bearer ${secret}`,
    };
    if (capability) headers.Authorization = `Bearer ${capability}`;
    const response = await send(new URL(`/api/v1/${action}`, url), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      // Inspect redirects without following them or forwarding secrets to another host.
      redirect: 'manual',
      signal: AbortSignal.timeout(600),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new SignalError('unavailable', 503);
    }
    const data = await readSignalObject(response).catch(() => {
      throw new SignalError('unavailable', 503);
    });
    if (!response.ok) {
      const errors = {
        invalid_request: 400,
        invalid_capability: 401,
        rate_limited: 429,
        sequence_conflict: 409,
      } as const;
      for (const [code, status] of Object.entries(errors)) {
        if (data.error === code && response.status === status)
          throw new SignalError(code as keyof typeof errors, status);
      }
      throw new SignalError('unavailable', 503);
    }
    const count = (value: unknown) => {
      if (
        !Number.isSafeInteger(value) ||
        (value as number) < 0 ||
        (value as number) > DAILY_LIMIT * 2
      )
        throw new SignalError('unavailable', 503);
      return value as number;
    };
    const answer = {
      outstanding: count(data.outstanding),
      recovered: count(data.recovered),
      otherOutstanding: data.otherOutstanding === null ? null : count(data.otherOutstanding),
    };
    if (answer.otherOutstanding !== null && answer.otherOutstanding > answer.outstanding)
      throw new SignalError('unavailable', 503);
    return answer;
  }
  return {
    check: (value) => invoke('check', { cohort: value }),
    report: (value, capability) =>
      invoke(value.state, { cohort: value.cohort, sequence: value.sequence }, capability),
  };
}
