import type Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function latestMigrationTimestamp(migrationsFolder: string): number {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
    entries: Array<{ when: number }>
  }
  const latest = journal.entries.at(-1)
  if (!latest) throw new Error('Drizzle migration journal is empty')
  return latest.when
}

export function migrateDatabase(sqlite: Database.Database, migrationsFolder: string): void {
  migrate(drizzle(sqlite), { migrationsFolder })
}

export function assertDatabaseCurrent(sqlite: Database.Database, migrationsFolder: string): void {
  const table = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  ).get()
  const latest = latestMigrationTimestamp(migrationsFolder)
  const applied = table && sqlite.prepare(
    'SELECT 1 FROM __drizzle_migrations WHERE created_at = ? LIMIT 1',
  ).get(latest)
  if (!applied) throw new Error(`Database migration ${latest} has not been applied`)
}

export function prepareDatabase(sqlite: Database.Database, migrationsFolder: string, rawFlag = process.env['MIGRATE_ON_STARTUP']): void {
  if (rawFlag === 'true') {
    migrateDatabase(sqlite, migrationsFolder)
  } else if (rawFlag === undefined || rawFlag === '' || rawFlag === 'false') {
    assertDatabaseCurrent(sqlite, migrationsFolder)
  } else {
    throw new Error('MIGRATE_ON_STARTUP must be true or false')
  }
}
