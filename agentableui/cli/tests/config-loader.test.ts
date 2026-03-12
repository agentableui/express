import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { loadConfig } from '../src/config-loader'

describe('loadConfig', () => {
  it('loads a valid TypeScript config', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    expect(config.name).toBe('test-app')
    expect(config.entrypoint).toBe('home')
    expect(Object.keys(config.states)).toEqual(['home', 'results', 'about'])
  })

  it('throws on missing file', async () => {
    await expect(loadConfig('/nonexistent/path.ts')).rejects.toThrow()
  })

  it('returns the default export', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    expect(config.baseUrl).toBe('http://localhost:3000')
  })
})
