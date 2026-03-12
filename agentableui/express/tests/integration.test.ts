import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defineAgentable, defineHandlers, defineConditions,
  generateKey, AgentableError, AgentableRedirect,
} from '@agentableui/core'
import { agentableMiddleware } from '../src'
import { AgentableClient } from '@agentableui/sdk'

let server: Server
let baseUrl: string
let tempDir: string
let keysPath: string
let agentKey: string

const config = defineAgentable({
  name: 'test-store',
  baseUrl: 'http://localhost',
  entrypoint: 'home',
  states: {
    home: {
      route: '/',
      description: 'Home page',
      actions: {
        search: {
          params: { query: { type: 'string', required: true } },
          transitions: 'results',
        },
        'view-product': {
          params: { id: { type: 'string', required: true } },
          transitions: 'product',
        },
      },
    },
    results: {
      route: '/results',
      description: 'Search results',
      actions: {
        'go-home': { transitions: 'home' },
        'view-product': {
          params: { id: { type: 'string', required: true } },
          transitions: 'product',
        },
      },
    },
    product: {
      route: '/product/:id',
      description: 'Product page',
      actions: {
        'add-to-cart': {
          params: { id: { type: 'string', required: true } },
          transitions: 'cart',
          errors: ['OUT_OF_STOCK'],
          redirects: { 'auth-required': 'login' },
        },
        'go-home': { transitions: 'home' },
      },
    },
    cart: {
      route: '/cart',
      description: 'Cart',
      actions: { 'go-home': { transitions: 'home' } },
    },
    login: {
      route: '/login',
      description: 'Login',
      actions: {
        authenticate: {
          params: { token: { type: 'string', required: true } },
          transitions: 'home',
          returnToPrevious: true,
        },
      },
    },
  },
  auth: {
    public: ['home', 'results', 'product', 'login'],
    user: '*',
  },
  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['search', 'view-product', 'go-home'],
    authenticatedActions: ['add-to-cart', 'authenticate'],
  },
})

type Ctx = { authenticated: boolean }

const handlers = defineHandlers<typeof config>()<Ctx>({
  'home.search': async ({ query }) => ({ results: [`result-for-${query}`] }),
  'view-product': async ({ id }) => ({ product: { id, name: `Product ${id}` } }),
  'product.add-to-cart': async ({ id }, ctx) => {
    if (!ctx.authenticated) throw new AgentableRedirect('auth-required')
    if (id === 'out-of-stock') throw new AgentableError('OUT_OF_STOCK', 'Item unavailable')
    return { cartItem: id }
  },
  'login.authenticate': async ({ token }) => {
    return { authenticated: true }
  },
})

const conditions = defineConditions<typeof config, Ctx>({})

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentable-integ-'))
  keysPath = join(tempDir, 'keys.json')
  const { key } = await generateKey('test-agent', { role: 'user' }, keysPath)
  agentKey = key

  const app = express()
  app.use(agentableMiddleware(config, handlers, conditions, {
    createContext: (req) => ({
      authenticated: req.headers.authorization === `Bearer ${agentKey}`,
    }),
    keysPath,
  }))

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address()
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://localhost:${addr.port}`
      }
      resolve()
    })
  })
})

afterAll(async () => {
  server?.close()
  await rm(tempDir, { recursive: true })
})

describe('End-to-end: discover -> search -> view -> add-to-cart', () => {
  it('completes the full agent flow', async () => {
    const client = new AgentableClient(baseUrl, { apiKey: agentKey, role: 'user' })

    // Discover
    const manifest = await client.discover()
    expect(manifest.name).toBe('test-store')
    expect(client.currentState?.name).toBe('home')

    // Search
    const searchResult = await client.execute('search', { query: 'shoes' })
    expect(searchResult.status).toBe('ok')
    expect(client.currentState?.name).toBe('results')

    // View product
    const viewResult = await client.execute('view-product', { id: 'shoe-1' })
    expect(viewResult.status).toBe('ok')
    expect(client.currentState?.name).toBe('product')

    // Add to cart (should succeed with valid key and authenticated context)
    const cartResult = await client.execute('add-to-cart', { id: 'shoe-1' })
    expect(cartResult.status).toBe('ok')
    expect(client.currentState?.name).toBe('cart')
  })

  it('handles state graph and plan validation', async () => {
    const client = new AgentableClient(baseUrl, { role: 'public' })
    await client.discover()

    const graph = client.getStateGraph()
    expect(graph.nodes).toContain('home')
    expect(graph.edges.find(e => e.action === 'search')).toBeTruthy()

    const validPlan = client.validatePlan(['search', 'view-product'])
    expect(validPlan.valid).toBe(true)

    const invalidPlan = client.validatePlan(['add-to-cart'])
    expect(invalidPlan.valid).toBe(false)
  })

  it('handles error response (OUT_OF_STOCK)', async () => {
    const client = new AgentableClient(baseUrl, { apiKey: agentKey, role: 'user' })
    await client.discover()
    await client.execute('view-product', { id: 'out-of-stock' })
    expect(client.currentState?.name).toBe('product')

    const result = await client.execute('add-to-cart', { id: 'out-of-stock' })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('OUT_OF_STOCK')
    }
    // State should remain product on error
    expect(client.currentState?.name).toBe('product')
  })

  it('handles redirect -> authenticate -> returnToPrevious flow', async () => {
    const { key: unauthKey } = await generateKey('unauth-agent', { role: 'user' }, keysPath)

    const client = new AgentableClient(baseUrl, { apiKey: unauthKey, role: 'user' })
    await client.discover()

    // Navigate to product page
    await client.execute('view-product', { id: 'shoe-1' })
    expect(client.currentState?.name).toBe('product')

    // add-to-cart with valid key but unauthenticated context -> AgentableRedirect
    const redirectResult = await client.execute('add-to-cart', { id: 'shoe-1' })
    expect(redirectResult.status).toBe('redirect')
    if (redirectResult.status === 'redirect') {
      expect(redirectResult.state).toBe('login')
      expect(redirectResult.reason).toBe('auth-required')
      expect(redirectResult.returnTo).toBe('product')
    }
    expect(client.currentState?.name).toBe('login')

    // authenticate -- SDK should auto-include returnTo from stored redirect
    const authResult = await client.execute('authenticate', { token: 'valid-token' })
    expect(authResult.status).toBe('ok')
    // returnToPrevious should send us back to 'product', not to 'home'
    expect(client.currentState?.name).toBe('product')
  })

  it('returns unauthorized for auth action without key', async () => {
    const client = new AgentableClient(baseUrl, { role: 'user' })
    await client.discover()
    await client.execute('view-product', { id: 'shoe-1' })

    const result = await client.execute('add-to-cart', { id: 'shoe-1' })
    expect(result.status).toBe('unauthorized')
  })
})
