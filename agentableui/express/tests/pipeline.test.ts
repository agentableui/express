import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKey, revokeKey } from '@agentableui/core'
import { AuthVerifier } from '../src/pipeline/auth'

let tempDir: string
let keysPath: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentable-auth-'))
  keysPath = join(tempDir, 'keys.json')
})

afterEach(async () => {
  await rm(tempDir, { recursive: true })
})

describe('AuthVerifier', () => {
  it('returns key info for valid key', async () => {
    const { key } = await generateKey('agent', { role: 'user' }, keysPath)
    const verifier = new AuthVerifier(keysPath)
    const result = await verifier.verify(key)
    expect(result).not.toBeNull()
    expect(result!.role).toBe('user')
    expect(result!.name).toBe('agent')
  })

  it('returns null for invalid key', async () => {
    await generateKey('agent', {}, keysPath)
    const verifier = new AuthVerifier(keysPath)
    const result = await verifier.verify('agui_k1_invalid_key_value_here_xx')
    expect(result).toBeNull()
  })

  it('returns null for revoked key', async () => {
    const { key, prefix } = await generateKey('agent', {}, keysPath)
    await revokeKey(prefix, keysPath)
    const verifier = new AuthVerifier(keysPath)
    const result = await verifier.verify(key)
    expect(result).toBeNull()
  })
})
