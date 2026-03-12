import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { defineAgentable, defineHandlers, defineConditions, generateKey } from '@agentableui/core'
import { agentableMiddleware } from '../src'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: express.Express
let tempDir: string
let keysPath: string
let validKey: string

const config = defineAgentable({
  name: 'test-store',
  baseUrl: 'https://store.com',
  entrypoint: 'home',
  states: {
    home: {
      route: '/',
      description: 'Home',
      actions: {
        search: {
          params: { query: { type: 'string', required: true } },
          transitions: 'results',
        },
        'go-cart': { transitions: 'cart' },
      },
    },
    results: {
      route: '/results',
      description: 'Results',
      actions: { 'go-home': { transitions: 'home' } },
    },
    cart: {
      route: '/cart',
      description: 'Cart',
      actions: {
        checkout: { transitions: 'done', available: 'cart-not-empty' },
      },
    },
    done: { route: '/done', description: 'Done', actions: {} },
  },
  auth: { public: ['home', 'results', 'cart', 'done'] },
  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['search', 'go-home', 'go-cart'],
    authenticatedActions: ['checkout'],
  },
})

const handlers = defineHandlers<typeof config>()<{}>({
  'home.search': async ({ query }) => ({ results: [`found: ${query}`] }),
})

const conditions = defineConditions<typeof config, {}>({
  'cart-not-empty': { description: 'Cart must have items', check: () => false },
})

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentable-routes-'))
  keysPath = join(tempDir, 'keys.json')
  const { key } = await generateKey('test-agent', { role: 'public' }, keysPath)
  validKey = key

  app = express()
  app.use(agentableMiddleware(config, handlers, conditions, {
    createContext: () => ({}),
    keysPath,
  }))
})

afterAll(async () => {
  await rm(tempDir, { recursive: true })
})

describe('GET /.well-known/agentable.json', () => {
  it('returns meta-manifest', async () => {
    const res = await request(app).get('/.well-known/agentable.json')
    expect(res.status).toBe(200)
    expect(res.body.agentable).toBe('1.0')
    expect(res.body.name).toBe('test-store')
    expect(res.body.manifests.public).toBeDefined()
  })
})

describe('GET /agentable/manifest/:role', () => {
  it('returns role manifest with ETag', async () => {
    const res = await request(app).get('/agentable/manifest/public')
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('public')
    expect(res.headers.etag).toBeDefined()
  })

  it('returns 304 on matching ETag', async () => {
    const first = await request(app).get('/agentable/manifest/public')
    const res = await request(app)
      .get('/agentable/manifest/public')
      .set('If-None-Match', first.headers.etag)
    expect(res.status).toBe(304)
  })

  it('returns 404 for unknown role', async () => {
    const res = await request(app).get('/agentable/manifest/unknown')
    expect(res.status).toBe(404)
  })
})

describe('POST /agentable/execute', () => {
  it('executes action and returns ok', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: { query: 'shoes' }, currentState: 'home' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.state).toBe('results')
    expect(res.body.data.results).toEqual(['found: shoes'])
  })

  it('returns invalid for unknown state', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: {}, currentState: 'nonexistent' })
    expect(res.status).toBe(400)
    expect(res.body.status).toBe('invalid')
  })

  it('returns invalid for missing params', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: {}, currentState: 'home' })
    expect(res.status).toBe(400)
    expect(res.body.status).toBe('invalid')
  })

  it('handles pure transition (go-cart)', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'go-cart', params: {}, currentState: 'home' })
    expect(res.body.status).toBe('ok')
    expect(res.body.state).toBe('cart')
  })

  it('returns unavailable when condition not met', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .set('Authorization', `Bearer ${validKey}`)
      .send({ action: 'checkout', params: {}, currentState: 'cart' })
    expect(res.status).toBe(409)
    expect(res.body.status).toBe('unavailable')
  })

  it('returns unauthorized for auth action without key', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'checkout', params: {}, currentState: 'cart' })
    expect(res.status).toBe(401)
    expect(res.body.status).toBe('unauthorized')
  })
})

describe('GET /agentable/conditions', () => {
  it('returns conditions with met status', async () => {
    const res = await request(app).get('/agentable/conditions')
    expect(res.status).toBe(200)
    expect(res.body.conditions['cart-not-empty'].met).toBe(false)
    expect(res.body.conditions['cart-not-empty'].description).toBe('Cart must have items')
  })
})
