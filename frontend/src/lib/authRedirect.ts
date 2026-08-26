// Thin, kuvert-named wrapper around @zudar107/schloss-ui's config-driven
// auth-redirect helpers - preserves kuvert's own function names so nothing
// else in the app needs to change. Reads runtime config on every call so tests
// and startup validation do not depend on module import order.
import { buildLoginUrl, buildLogoutUrl, buildAccountUrl, CODE_VERIFIER_STORAGE_KEY } from '@zudar107/schloss-ui'
import { getRuntimeConfig } from './runtimeConfig'

function config() {
  return {
    schluesselUrl: getRuntimeConfig().schlusselUrl,
  }
}

export { CODE_VERIFIER_STORAGE_KEY }

export function buildSchluesselLoginUrl(currentPath: string, origin?: string): Promise<string> {
  return buildLoginUrl(config(), currentPath, origin)
}

export function buildSchluesselLogoutUrl(returnTo?: string): string {
  return buildLogoutUrl(config(), returnTo)
}

export function buildSchluesselAccountUrl(currentPath: string, origin?: string): string {
  return buildAccountUrl(config(), currentPath, origin)
}
