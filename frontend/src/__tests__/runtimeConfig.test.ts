import { afterEach, describe, expect, it } from 'vitest'
import { getRuntimeConfig } from '../lib/runtimeConfig'

afterEach(() => {
  delete window.__HOF_CONFIG__
})

describe('getRuntimeConfig', () => {
  it('uses localhost defaults when config or URL values are missing or blank', () => {
    expect(getRuntimeConfig()).toEqual({
      schemaVersion: 1,
      schlusselUrl: 'http://localhost:4001',
      schlossUrl: 'http://localhost:3000',
      glockeUrl: 'http://localhost:5177',
    })

    window.__HOF_CONFIG__ = { schemaVersion: 1, schlusselUrl: '  ', glockeUrl: '' }
    expect(getRuntimeConfig()).toEqual({
      schemaVersion: 1,
      schlusselUrl: 'http://localhost:4001',
      schlossUrl: 'http://localhost:3000',
      glockeUrl: 'http://localhost:5177',
    })
  })

  it('normalizes configured HTTP(S) URLs to origins and reads each call', () => {
    window.__HOF_CONFIG__ = {
      schemaVersion: 1,
      schlusselUrl: ' https://AUTH.example.com:443/ ',
      schlossUrl: 'http://home.example.com:8080/',
      glockeUrl: 'https://glocke.example.com/',
    }
    expect(getRuntimeConfig()).toEqual({
      schemaVersion: 1,
      schlusselUrl: 'https://auth.example.com',
      schlossUrl: 'http://home.example.com:8080',
      glockeUrl: 'https://glocke.example.com',
    })

    window.__HOF_CONFIG__ = { schemaVersion: 1, schlossUrl: 'https://new.example.com' }
    expect(getRuntimeConfig().schlossUrl).toBe('https://new.example.com')
  })

  it.each([
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com/.',
    'https://example.com?query=1',
    'https://example.com#hash',
    'not a URL',
  ])('rejects malformed explicit URL %s', (schlusselUrl) => {
    window.__HOF_CONFIG__ = { schemaVersion: 1, schlusselUrl }
    expect(() => getRuntimeConfig()).toThrow('schlusselUrl')
  })

  it('rejects a non-string explicit URL', () => {
    window.__HOF_CONFIG__ = { schemaVersion: 1, glockeUrl: null }
    expect(() => getRuntimeConfig()).toThrow('glockeUrl')
  })

  it('rejects an unsupported or missing schema version', () => {
    window.__HOF_CONFIG__ = { schemaVersion: 2 }
    expect(() => getRuntimeConfig()).toThrow('schemaVersion')
  })
})
