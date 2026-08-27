import { createAuthMiddleware, createExportAuthMiddleware } from '@zudar107/schloss-server-kit'
import type { AuthUser } from '@zudar107/schloss-server-kit'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, userTombstones } from '../db/schema.js'

export type { AuthUser }

export const JWKS_URL = process.env['SCHLUSSEL_JWKS_URL'] ?? 'http://localhost:4000/.well-known/jwks.json'
const ISSUER = process.env['JWT_ISSUER'] ?? 'schlussel'

export const requireExportAuth = createExportAuthMiddleware({
  jwksUrl: JWKS_URL,
  issuer: ISSUER,
  service: 'kuvert',
})

export const { requireAuth, requireAdmin } = createAuthMiddleware({
  jwksUrl: JWKS_URL,
  issuer: ISSUER,
  // Auto-provision a local user row on first sight - kuvert stores only
  // the user id from the JWT plus its own currency preference, no
  // passwords here.
  onUserSeen: async (user) => {
    const deleted = db.transaction((tx) => {
      const tombstone = tx.select({ userId: userTombstones.userId })
        .from(userTombstones).where(eq(userTombstones.userId, user.id)).get()
      if (tombstone) return true
      const existing = tx.select().from(users).where(eq(users.id, user.id)).get()
      if (!existing) tx.insert(users).values({
        id: user.id,
        email: user.email,
        name: user.name,
        currency: 'RUB',
        createdAt: new Date(),
      }).run()
      return false
    })
    if (deleted) throw new Error('Deleted account')
  },
})
