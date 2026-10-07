export const WINDOW_MS = 10 * 60_000;
export const CAPABILITY_MS = 24 * 60 * 60_000;
export const DAILY_LIMIT = 10_000;
export const REPORTER_HOURLY_LIMIT = 12;
export const ENUMS = {
  service: ['github'],
  operation: ['git_push'],
  access: ['git_https'],
  environment: ['local_agent', 'hosted_agent', 'unknown'],
  error: ['http_502', 'http_503', 'http_504'],
} as const;
export type Cohort = { [K in keyof typeof ENUMS]: (typeof ENUMS)[K][number] };
export type State = 'failure' | 'recovery';
export type Observation = { cohort: Cohort; sequence: number; state: State };
export type Identity = { hash: string; expires: number };
export type Aggregate = { outstanding: number; recovered: number; otherOutstanding: number | null };
export class SignalError extends Error {
  code:
    'invalid_request' | 'invalid_capability' | 'rate_limited' | 'sequence_conflict' | 'unavailable';
  status: number;
  constructor(code: SignalError['code'], status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new SignalError('invalid_request');
  return input as Record<string, unknown>;
}
// Projection, never passthrough: unknown fields are discarded, including diagnostic text.
export function cohort(input: unknown): Cohort {
  const source = object(input),
    clean: Record<string, string> = {};
  for (const [key, values] of Object.entries(ENUMS)) {
    const value = source[key];
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
      throw new SignalError('invalid_request');
    clean[key] = value;
  }
  return clean as Cohort;
}
export function observation(input: unknown, state: State): Observation {
  const source = object(input),
    sequence = source.sequence;
  if (!Number.isSafeInteger(sequence) || (sequence as number) < 1)
    throw new SignalError('invalid_request');
  return { cohort: cohort(source.cohort), sequence: sequence as number, state };
}
export function cohortKey(value: Cohort): string {
  return Object.keys(ENUMS)
    .map((key) => value[key as keyof Cohort])
    .join(':');
}
export async function identity(token: unknown, now: number): Promise<Identity> {
  if (typeof token !== 'string' || token.length > 80)
    throw new SignalError('invalid_capability', 401);
  const parts = /^v1\.(\d{6,10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!parts) throw new SignalError('invalid_capability', 401);
  const issued = Number(parts[1]) * 3_600_000;
  if (issued > now || now >= issued + CAPABILITY_MS)
    throw new SignalError('invalid_capability', 401);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return {
    hash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    expires: issued + CAPABILITY_MS,
  };
}
export function result(counts: Aggregate, now: number) {
  return {
    ...counts,
    windowSeconds: WINDOW_MS / 1000,
    asOf: new Date(now).toISOString(),
    evidence: 'unverified_reports',
    population: 'reporter_capabilities',
    interpretation:
      'Counts may include forged or duplicate reporters. No report does not establish health. Expiry does not establish recovery.',
  };
}
