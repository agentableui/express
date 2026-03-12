import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { loadConfig } from '../src/config-loader'
import { renderAscii, renderMermaid } from '../src/commands/visualize'

describe('renderAscii', () => {
  it('shows all states and transitions', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const output = renderAscii(config)

    expect(output).toContain('test-app (entrypoint: home)')
    expect(output).toContain('home /')
    expect(output).toContain('──search──> results')
    expect(output).toContain('──go-about──> about')
    expect(output).toContain('results /results')
    expect(output).toContain('──go-home──> home')
  })

  it('marks self-transitions', async () => {
    const config = {
      name: 'test',
      baseUrl: 'http://localhost',
      entrypoint: 'home',
      states: {
        home: {
          route: '/',
          description: 'Home',
          actions: {
            refresh: { transitions: 'home' },
          },
        },
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['refresh'],
        authenticatedActions: [],
      },
    }
    const output = renderAscii(config as any)
    expect(output).toContain('(self)')
  })

  it('marks auth actions', async () => {
    const config = {
      name: 'test',
      baseUrl: 'http://localhost',
      entrypoint: 'home',
      states: {
        home: {
          route: '/',
          description: 'Home',
          actions: {
            buy: {
              params: { id: { type: 'string', required: true } },
              transitions: 'cart',
            },
          },
        },
        cart: { route: '/cart', description: 'Cart', actions: {} },
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: [],
        authenticatedActions: ['buy'],
      },
    }
    const output = renderAscii(config as any)
    expect(output).toContain('[auth]')
  })
})

describe('renderMermaid', () => {
  it('outputs stateDiagram-v2 syntax', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const output = renderMermaid(config)

    expect(output).toContain('stateDiagram-v2')
    expect(output).toContain('[*] --> home')
    expect(output).toContain('home --> results : search')
    expect(output).toContain('home --> about : go-about')
  })

  it('handles self-transitions', () => {
    const config = {
      name: 'test',
      baseUrl: 'http://localhost',
      entrypoint: 'home',
      states: {
        home: {
          route: '/',
          description: 'Home',
          actions: { refresh: { transitions: 'home' } },
        },
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['refresh'],
        authenticatedActions: [],
      },
    }
    const output = renderMermaid(config as any)
    expect(output).toContain('home --> home : refresh')
  })
})
