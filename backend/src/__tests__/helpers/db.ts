import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from '../../db/schema.js'
import { migrateDatabase } from '../../db/migrate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')

// The real migrateDatabase() (not hand-rolled raw-SQL execution) so it
// also populates __drizzle_migrations - assertDatabaseCurrent() checks
// that table, and /ready now calls it for real via this file's own
// reconstructed route in helpers/setup.ts.
export const migrationsDir = resolve(__dirname, '../../db/migrations')
migrateDatabase(sqlite, migrationsDir)

// Insert the two test users — they persist for the lifetime of this DB instance.
// Do NOT delete users in beforeEach cleanup.
const now = Date.now()
sqlite.prepare(
  'INSERT INTO users (id, email, name, currency, created_at) VALUES (?, ?, ?, ?, ?)',
).run('user-1', 'test@example.com', 'Test User', 'RUB', now)
sqlite.prepare(
  'INSERT INTO users (id, email, name, currency, created_at) VALUES (?, ?, ?, ?, ?)',
).run('user-2', 'test2@example.com', 'Test User 2', 'RUB', now)

export const db = drizzle(sqlite, { schema })

/**
 * Delete all data rows (not users) between tests.
 * Order respects FK constraints: delete dependents before parents.
 */
export function cleanDb() {
  const hasNotificationOutbox = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'notification_outbox'",
  ).get() !== undefined
  const tables = [
    ...(hasNotificationOutbox ? ['notification_outbox'] : []),
    'goal_contributions',
    'envelope_budgets',
    'transactions',
    'goals',
    'debts',
    'accounts',
    'envelopes',
    'categories',
    'periods',
  ]
  for (const t of tables) sqlite.exec(`DELETE FROM ${t}`)

  // Reset mutable fields on the seeded users back to their defaults, since
  // the users table itself is intentionally not wiped above.
  sqlite.exec(`UPDATE users SET currency = 'RUB'`)
}
