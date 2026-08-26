export interface RuntimeServices {
  glocke: boolean
}

export interface RuntimeConfig {
  schemaVersion: 1
  schlusselUrl: string
  schlossUrl: string
  glockeUrl: string
  services: RuntimeServices
}

declare global {
  interface Window {
    __HOF_CONFIG__?: unknown
  }
}

const defaults: RuntimeConfig = {
  schemaVersion: 1,
  schlusselUrl: 'http://localhost:4001',
  schlossUrl: 'http://localhost:3000',
  glockeUrl: 'http://localhost:5177',
  services: { glocke: true },
}

// Missing or non-boolean per-service flags default to enabled (true) - a
// deployment that hasn't started emitting `services` yet (or a hand-edited
// config.js) should keep showing the bell, matching this app's behavior
// before this field existed, rather than hiding it nobody asked to disable.
function services(value: unknown): RuntimeServices {
  const source = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  return { glocke: typeof source.glocke === 'boolean' ? source.glocke : true }
}

function origin(value: unknown, name: keyof Omit<RuntimeConfig, 'schemaVersion' | 'services'>): string {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) return defaults[name]
  if (typeof value !== 'string') throw new Error(`Runtime config ${name} must be an HTTP(S) origin`)

  const input = value.trim()
  if (!/^https?:\/\/[^/?#\\]+\/?$/i.test(input)) throw new Error(`Runtime config ${name} must be an HTTP(S) origin`)

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error(`Runtime config ${name} must be an HTTP(S) origin`)
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error(`Runtime config ${name} must be an HTTP(S) origin`)
  }

  return url.origin
}

export function getRuntimeConfig(): RuntimeConfig {
  const raw = window.__HOF_CONFIG__
  if (raw === undefined) return { ...defaults }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Runtime config must be an object')

  const config = raw as Record<string, unknown>
  if (config.schemaVersion !== 1) throw new Error('Unsupported runtime config schemaVersion')

  return {
    schemaVersion: 1,
    schlusselUrl: origin(config.schlusselUrl, 'schlusselUrl'),
    schlossUrl: origin(config.schlossUrl, 'schlossUrl'),
    glockeUrl: origin(config.glockeUrl, 'glockeUrl'),
    services: services(config.services),
  }
}
