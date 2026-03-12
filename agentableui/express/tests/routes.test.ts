import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
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

  // 2.3 returnTo validation
  it('returns invalid for unknown returnTo state', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: { query: 'q' }, currentState: 'home', returnTo: 'nonexistent' })
    expect(res.status).toBe(400)
    expect(res.body.status).toBe('invalid')
    expect(res.body.errors[0].param).toBe('returnTo')
  })

  // 2.6 Edge case tests
  it('returns invalid for empty body', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.status).toBe('invalid')
  })

  it('returns invalid for array body', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send([])
    expect(res.status).toBe(400)
  })

  it('returns invalid for missing action', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ currentState: 'home', params: {} })
    expect(res.status).toBe(400)
    expect(res.body.errors.some((e: any) => e.param === 'action')).toBe(true)
  })

  it('returns invalid for missing currentState', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: {} })
    expect(res.status).toBe(400)
    expect(res.body.errors.some((e: any) => e.param === 'currentState')).toBe(true)
  })

  it('handles very long action names without crashing', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'a'.repeat(10000), params: {}, currentState: 'home' })
    expect(res.status).toBe(400)
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

// 2.1 Condition existence check
describe('POST /agentable/execute (missing condition)', () => {
  let missingCondApp: express.Express

  beforeAll(async () => {
    const missingCondConfig = defineAgentable({
      name: 'test',
      baseUrl: 'https://test.com',
      entrypoint: 'home',
      states: {
        home: { route: '/', description: 'Home', actions: {
          buy: { transitions: 'home', available: 'nonexistent-condition' },
        }},
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['buy'],
        authenticatedActions: [],
      },
    })
    missingCondApp = express()
    missingCondApp.use(agentableMiddleware(missingCondConfig, {}, {}, {
      createContext: () => ({}),
      keysPath: join(tempDir, 'keys-mc.json'),
    }))
  })

  it('returns 500 when action references undefined condition', async () => {
    const res = await request(missingCondApp)
      .post('/agentable/execute')
      .send({ action: 'buy', params: {}, currentState: 'home' })
    expect(res.status).toBe(500)
    expect(res.body.error).toContain('nonexistent-condition')
  })
})

// 2.4 Handler return type validation
describe('POST /agentable/execute (handler return validation)', () => {
  let badHandlerApp: express.Express

  beforeAll(async () => {
    const cfg = defineAgentable({
      name: 'test',
      baseUrl: 'https://test.com',
      entrypoint: 'home',
      states: {
        home: { route: '/', description: 'Home', actions: {
          'return-null': { params: { x: { type: 'string', required: true } } },
          'return-string': { params: { x: { type: 'string', required: true } } },
          'return-array': { params: { x: { type: 'string', required: true } } },
        }},
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['return-null', 'return-string', 'return-array'],
        authenticatedActions: [],
      },
    })
    badHandlerApp = express()
    badHandlerApp.use(agentableMiddleware(cfg, {
      'return-null': async () => null as any,
      'return-string': async () => 'bad' as any,
      'return-array': async () => [1, 2] as any,
    }, {}, {
      createContext: () => ({}),
      keysPath: join(tempDir, 'keys-bh.json'),
    }))
  })

  it('returns 500 when handler returns null', async () => {
    const res = await request(badHandlerApp)
      .post('/agentable/execute')
      .send({ action: 'return-null', params: { x: 'a' }, currentState: 'home' })
    expect(res.status).toBe(500)
    expect(res.body.error).toContain('object')
  })

  it('returns 500 when handler returns string', async () => {
    const res = await request(badHandlerApp)
      .post('/agentable/execute')
      .send({ action: 'return-string', params: { x: 'a' }, currentState: 'home' })
    expect(res.status).toBe(500)
  })

  it('returns 500 when handler returns array', async () => {
    const res = await request(badHandlerApp)
      .post('/agentable/execute')
      .send({ action: 'return-array', params: { x: 'a' }, currentState: 'home' })
    expect(res.status).toBe(500)
  })
})

// 2.5 Logger integration
describe('Logger integration', () => {
  let loggerApp: express.Express
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }

  beforeAll(async () => {
    const cfg = defineAgentable({
      name: 'logger-test',
      baseUrl: 'https://test.com',
      entrypoint: 'home',
      states: {
        home: { route: '/', description: 'Home', actions: {
          crash: { params: { x: { type: 'string', required: true } } },
          safe: { transitions: 'home' },
        }},
      },
      auth: { public: '*' },
      security: {
        requireApiKey: true,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['safe'],
        authenticatedActions: ['crash'],
      },
    })
    loggerApp = express()
    loggerApp.use(agentableMiddleware(cfg, {
      crash: async () => { throw new Error('boom') },
    }, {}, {
      createContext: () => ({}),
      keysPath,
      logger: mockLogger,
    }))
  })

  beforeEach(() => {
    mockLogger.error.mockClear()
    mockLogger.warn.mockClear()
    mockLogger.info.mockClear()
  })

  it('calls logger.warn on unauthorized access', async () => {
    await request(loggerApp)
      .post('/agentable/execute')
      .send({ action: 'crash', params: { x: 'a' }, currentState: 'home' })
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('calls logger.error on handler crash', async () => {
    await request(loggerApp)
      .post('/agentable/execute')
      .set('Authorization', `Bearer ${validKey}`)
      .send({ action: 'crash', params: { x: 'a' }, currentState: 'home' })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('does not crash without logger', async () => {
    const res = await request(app)
      .post('/agentable/execute')
      .send({ action: 'search', params: { query: 'q' }, currentState: 'home' })
    expect(res.status).toBe(200)
  })
})

// 2.6 Handler throws non-Error
describe('POST /agentable/execute (handler throws non-Error)', () => {
  let throwApp: express.Express

  beforeAll(async () => {
    const cfg = defineAgentable({
      name: 'throw-test',
      baseUrl: 'https://test.com',
      entrypoint: 'home',
      states: {
        home: { route: '/', description: 'Home', actions: {
          bad: { params: { x: { type: 'string', required: true } } },
        }},
      },
      auth: { public: '*' },
      security: {
        requireApiKey: false,
        rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
        publicActions: ['bad'],
        authenticatedActions: [],
      },
    })
    throwApp = express()
    throwApp.use(agentableMiddleware(cfg, {
      bad: async () => { throw 'string-error' },
    }, {}, {
      createContext: () => ({}),
      keysPath: join(tempDir, 'keys-throw.json'),
    }))
  })

  it('returns 500 when handler throws non-Error', async () => {
    const res = await request(throwApp)
      .post('/agentable/execute')
      .send({ action: 'bad', params: { x: 'a' }, currentState: 'home' })
    expect(res.status).toBe(500)
  })
})
