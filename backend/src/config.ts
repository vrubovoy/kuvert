import { readFileSync, statSync } from 'node:fs'

const MAX_SECRET_FILE_BYTES = 64 * 1024

export function resolveSecret(name: string): string | undefined {
  const direct = process.env[name]
  const fileName = `${name}_FILE`
  const path = process.env[fileName]
  const hasDirect = direct !== undefined && direct !== ''
  const hasFile = path !== undefined && path !== ''
  if (hasDirect && hasFile) throw new Error(`${name} and ${fileName} are mutually exclusive`)

  let value: string | undefined
  if (hasDirect) value = direct
  if (hasFile) {
    const stat = statSync(path)
    if (!stat.isFile()) throw new Error(`${fileName} must reference a regular file`)
    if (stat.size > MAX_SECRET_FILE_BYTES) throw new Error(`${fileName} must not exceed 64 KiB`)
    const bytes = readFileSync(path)
    try {
      value = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error(`${fileName} must contain valid UTF-8`)
    }
    if (value.endsWith('\r\n')) value = value.slice(0, -2)
    else if (value.endsWith('\n')) value = value.slice(0, -1)
  }
  if (value?.includes('\0')) throw new Error(`${name} must not contain NUL bytes`)
  if (hasFile && value === '') throw new Error(`${fileName} must not contain an empty secret`)
  return value
}

export function notificationCredentials() {
  const keyId = process.env['KUVERT_TO_GLOCKE_HMAC_KEY_ID'] || undefined
  const secret = resolveSecret('KUVERT_TO_GLOCKE_HMAC_SECRET')
  if (Boolean(keyId) !== Boolean(secret)) {
    throw new Error('KUVERT_TO_GLOCKE_HMAC_KEY_ID and KUVERT_TO_GLOCKE_HMAC_SECRET must be configured together')
  }
  return { keyId, secret }
}
