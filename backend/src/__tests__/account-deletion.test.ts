import { createServer, type Server } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', async () => await import('./helpers/db.js'))

import { sqlite } from './helpers/db.js'
import { createDeletionsRouter } from '../features/deletions/router.js'

let server: Server
let jwksUrl: string
let privateKey: CryptoKey

async function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ token_use: 'deletion', scope: 'account:delete', job_id: 'job-delete', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'deletion-test' })
    .setIssuer('schlussel').setAudience('hof-deletion:kuvert')
    .setSubject('user-delete').setJti('token-delete').setIssuedAt(now).setExpirationTime(now + 60)
    .sign(privateKey)
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const publicJwk: JWK = { ...await exportJWK(pair.publicKey), kid: 'deletion-test', alg: 'RS256', use: 'sig' }
  server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ keys: [publicJwk] }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Failed to bind JWKS server')
  jwksUrl = `http://127.0.0.1:${address.port}/jwks.json`
})

afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

function app() {
  const app = new Hono()
  app.route('/internal/v1', createDeletionsRouter({ jwksUrl, issuer: 'schlussel', service: 'kuvert' }))
  return app
}

describe('POST /internal/v1/account-deletions', () => {
  it('atomically tombstones and purges an account and safely accepts exact replay', async () => {
    sqlite.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)')
      .run('user-delete', 'delete@example.com', 'Delete', 'RUB', Math.floor(Date.now() / 1000))
    sqlite.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('account-delete', 'user-delete', 'Delete', 'checking', 'RUB', 0, '#000000', 0, Math.floor(Date.now() / 1000))
    sqlite.prepare(`INSERT INTO notification_outbox
      (id, event_type, user_id, payload, correlation_id, state, created_at, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('event-delete', 'test', 'user-delete', '{}', 'delete', 'pending', Date.now(), 0)
    const authorization = `Bearer ${await token()}`
    const request = () => app().request('/internal/v1/account-deletions', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-delete', userId: 'user-delete' }),
    })

    expect(await (await request()).json()).toEqual({ status: 'completed', jobId: 'job-delete' })
    expect(await (await request()).json()).toEqual({ status: 'duplicate', jobId: 'job-delete' })
    expect(sqlite.prepare('SELECT * FROM users WHERE id = ?').get('user-delete')).toBeUndefined()
    expect(sqlite.prepare('SELECT * FROM accounts WHERE user_id = ?').all('user-delete')).toEqual([])
    expect(sqlite.prepare('SELECT * FROM notification_outbox WHERE user_id = ?').all('user-delete')).toEqual([])
    expect(sqlite.prepare('SELECT deletion_job_id FROM user_tombstones WHERE user_id = ?').get('user-delete'))
      .toEqual({ deletion_job_id: 'job-delete' })
  })

  it('rejects a mismatched payload without recording or deleting anything', async () => {
    const response = await app().request('/internal/v1/account-deletions', {
      method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'other-job', userId: 'user-delete' }),
    })
    expect(response.status).toBe(409)
  })

  it('rejects a cryptographically valid token for another exact audience', async () => {
    const wrongAudience = await new SignJWT({ token_use: 'deletion', scope: 'account:delete', job_id: 'job-wrong' })
      .setProtectedHeader({ alg: 'RS256', kid: 'deletion-test' }).setIssuer('schlussel')
      .setAudience('hof-deletion:tafel').setSubject('user-wrong').setJti('token-wrong')
      .setExpirationTime('1m').sign(privateKey)
    const response = await app().request('/internal/v1/account-deletions', {
      method: 'POST', headers: { Authorization: `Bearer ${wrongAudience}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-wrong', userId: 'user-wrong' }),
    })
    expect(response.status).toBe(401)
  })
})
