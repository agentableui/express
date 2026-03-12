import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { loadConfig } from '../src/config-loader'
import { validateConfig } from '../src/commands/validate'
import type { AgentableConfig } from '@agentableui/core'

describe('validateConfig', () => {
  it('returns no errors for valid config', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const result = validateConfig(config)
    expect(result.errors).toHaveLength(0)
  })

  it('detects orphan states', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/orphan-state-config.ts'))
    const result = validateConfig(config)
    expect(result.errors.some(e => e.includes('orphan'))).toBe(true)
  })

  it('detects invalid transitions', async () => {
    const config = (await import('./fixtures/invalid-transition-config')).default as unknown as AgentableConfig
    const result = validateConfig(config)
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true)
  })

  it('detects empty states', async () => {
    const config = {
      name: 'test',
      baseUrl: 'http://localhost',
      entrypoint: 'home',
      states: {
        home: { route: '/', description: 'Home', actions: { go: { transitions: 'empty' } } },
        empty: { route: '/empty', description: 'Empty', actions: {} },
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: [], authenticatedActions: [],
      },
    } as unknown as AgentableConfig

    const result = validateConfig(config)
    expect(result.warnings.some(w => w.includes('empty') && w.includes('no actions'))).toBe(true)
  })
})
