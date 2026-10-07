import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { Database, Statement } from '../core/store.ts';
export class Sqlite implements Database {
  raw = new DatabaseSync(':memory:');
  constructor() {
    this.raw.exec(
      readFileSync(new URL('../drizzle/0000_new_ben_urich.sql', import.meta.url), 'utf8'),
    );
  }
  prepare(sql: string): Statement {
    const statement = this.raw.prepare(sql);
    let values: (string | number)[] = [];
    const wrapper: Statement = {
      bind(...next) {
        values = next;
        return wrapper;
      },
      async all<T>() {
        return { results: statement.all(...values) as T[] };
      },
    };
    return wrapper;
  }
  async batch<T>(statements: Statement[]) {
    this.raw.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all<T>());
      this.raw.exec('COMMIT');
      return results;
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
}
export const now = Date.UTC(2026, 9, 7, 12);
export const sample = {
  service: 'github',
  operation: 'git_push',
  access: 'git_https',
  environment: 'local_agent',
  error: 'http_503',
} as const;
export const token = (character = 'a', at = now) =>
  `v1.${Math.floor(at / 3_600_000)}.${character.repeat(43)}`;
