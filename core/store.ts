import {
  DAILY_LIMIT,
  REPORTER_HOURLY_LIMIT,
  WINDOW_MS,
  SignalError,
  cohortKey,
} from './contract.ts';
import type { Aggregate, Cohort, Identity, Observation } from './contract.ts';
export interface Statement {
  bind(...values: (string | number)[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = Record<string, unknown>>(statements: Statement[]): Promise<{ results: T[] }[]>;
}
type Row = { sequence: number; state: string; observed: number };
export class Store {
  private db: Database;
  private partition: string;
  constructor(db: Database, partition = '') {
    this.db = db;
    this.partition = partition ? `${partition}:` : '';
  }
  async check(value: Cohort, now: number, reporter?: Identity): Promise<Aggregate> {
    const response = await this.db
      .prepare(
        `SELECT
      COALESCE(SUM(state='failure'),0) AS outstanding,
      COALESCE(SUM(state='recovery' AND had_failure=1),0) AS recovered,
      COALESCE(SUM(state='failure' AND reporter<>?),0) AS others
      FROM observations WHERE cohort=? AND observed>? AND expires>?`,
      )
      .bind(reporter?.hash ?? '', this.partition + cohortKey(value), now - WINDOW_MS, now)
      .all<{ outstanding: number; recovered: number; others: number }>();
    const row = response.results[0];
    return {
      outstanding: row.outstanding,
      recovered: row.recovered,
      otherOutstanding: reporter ? row.others : null,
    };
  }
  async report(value: Observation, reporter: Identity, now: number): Promise<Aggregate> {
    const globalKey = `global:${Math.floor(now / 86_400_000)}`;
    const reporterKey = `reporter:${reporter.hash}:${Math.floor(now / 3_600_000)}`;
    const key = this.partition + cohortKey(value.cohort);
    // D1 batch is transactional. changes() gates each subsequent mutation on the
    // preceding quota write; simultaneous requests cannot bypass either ceiling.
    const responses = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO budgets(key,used,expires) VALUES(?,1,?)
        ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used<? RETURNING used`,
        )
        .bind(globalKey, now + 2 * 86_400_000, DAILY_LIMIT),
      this.db
        .prepare(
          `INSERT INTO budgets(key,used,expires) SELECT ?,1,? WHERE changes()=1
        ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used<? RETURNING used`,
        )
        .bind(reporterKey, reporter.expires, REPORTER_HOURLY_LIMIT),
      this.db
        .prepare(
          `INSERT INTO observations(reporter,cohort,sequence,state,observed,expires,had_failure)
        SELECT ?,?,?,?,?,?,? WHERE changes()=1
        ON CONFLICT(reporter,cohort) DO UPDATE SET sequence=excluded.sequence,state=excluded.state,
        observed=excluded.observed,had_failure=MAX(observations.had_failure,excluded.had_failure)
        WHERE excluded.sequence>observations.sequence RETURNING sequence`,
        )
        .bind(
          reporter.hash,
          key,
          value.sequence,
          value.state,
          now,
          reporter.expires,
          value.state === 'failure' ? 1 : 0,
        ),
      this.db
        .prepare('SELECT sequence,state,observed FROM observations WHERE reporter=? AND cohort=?')
        .bind(reporter.hash, key),
    ]);
    if (!responses[0].results.length || !responses[1].results.length)
      throw new SignalError('rate_limited', 429);
    const existing = responses[3].results[0] as Row | undefined;
    if (!existing || existing.sequence !== value.sequence || existing.state !== value.state)
      throw new SignalError('sequence_conflict', 409);
    return this.check(value.cohort, now, reporter);
  }
  async cleanup(now: number): Promise<void> {
    // Keep watermarks until capabilities expire; silence only expires the count.
    await this.db.batch([
      this.db.prepare('DELETE FROM observations WHERE expires<=?').bind(now),
      this.db.prepare('DELETE FROM budgets WHERE expires<=?').bind(now),
    ]);
  }
}
