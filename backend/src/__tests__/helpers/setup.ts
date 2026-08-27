import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { checkJwksReachable } from '@zudar107/schloss-server-kit'
import { sqlite, migrationsDir } from './db.js'
import { assertDatabaseCurrent } from '../../db/migrate.js'
import { JWKS_URL } from '../../middleware/auth.js'
import { accountsRouter } from '../../features/accounts/router.js'
import { periodsRouter } from '../../features/periods/router.js'
import { envelopesRouter } from '../../features/envelopes/router.js'
import { transactionsRouter } from '../../features/transactions/router.js'
import { goalsRouter } from '../../features/goals/router.js'
import { debtsRouter } from '../../features/debts/router.js'
import { usersRouter } from '../../features/users/router.js'
import { exportRouter, exportsRouter } from '../../features/export/router.js'
import { deletionsRouter } from '../../features/deletions/router.js'

/**
 * Build a minimal Hono app wired up with all feature routers.
 * The db and auth modules are expected to have been mocked by the calling
 * test file before this function is called.
 */
export function createTestApp() {
  const app = new Hono()
  // Mirrors index.ts's real middleware stack, not just the routers - so
  // this exact behavior (body-size limiting) is exercised in tests too.
  app.use('*', bodyLimit({
    maxSize: 5 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Request body too large' }, 413),
  }))
  app.get('/health', (c) => c.json({ status: 'ok', service: 'Kuvert' }))
  // Mirrors index.ts's own real /ready logic (schema currency, then the
  // Schlüssel JWKS dependency), not a static "ready" stub.
  app.get('/ready', async (c) => {
    try {
      assertDatabaseCurrent(sqlite, migrationsDir)
    } catch {
      return c.json({ status: 'unavailable', service: 'Kuvert' }, 503)
    }
    if (!(await checkJwksReachable(JWKS_URL))) {
      return c.json({ status: 'unavailable', service: 'Kuvert' }, 503)
    }
    return c.json({ status: 'ready', service: 'Kuvert' })
  })
  app.route('/accounts', accountsRouter)
  app.route('/periods', periodsRouter)
  app.route('/envelopes', envelopesRouter)
  app.route('/transactions', transactionsRouter)
  app.route('/goals', goalsRouter)
  app.route('/debts', debtsRouter)
  app.route('/users', usersRouter)
  app.route('/export', exportRouter)
  app.route('/exports', exportsRouter)
  app.route('/internal/v1', deletionsRouter)
  return app
}
