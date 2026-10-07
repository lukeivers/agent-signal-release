import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const observations = sqliteTable(
  'observations',
  {
    reporter: text('reporter').notNull(),
    cohort: text('cohort').notNull(),
    sequence: integer('sequence').notNull(),
    state: text('state').notNull(),
    observed: integer('observed').notNull(),
    expires: integer('expires').notNull(),
    hadFailure: integer('had_failure').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reporter, table.cohort] }),
    index('cohort_freshness').on(table.cohort, table.observed),
    index('observation_expiry').on(table.expires),
  ],
);
export const budgets = sqliteTable(
  'budgets',
  {
    key: text('key').primaryKey(),
    used: integer('used').notNull(),
    expires: integer('expires').notNull(),
  },
  (table) => [index('budget_expiry').on(table.expires)],
);
