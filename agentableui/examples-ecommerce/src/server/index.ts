import express from 'express'
import { createServer as createViteServer } from 'vite'
import { agentableMiddleware } from '@agentableui/express'
import config from '../agentable.config.js'
import handlers from '../agentable.handlers.js'
import conditions from '../agentable.conditions.js'
import { ProductStore } from './stores/products.js'
import { CartService } from './stores/cart.js'
import { OrderService } from './stores/orders.js'
import { AuthService } from './auth.js'

async function start() {
  const app = express()
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

  // Shared in-memory stores
  const products = new ProductStore()
  const cart = new CartService()
  const orders = new OrderService()

  // AgentableUI middleware — serves all protocol endpoints
  app.use(agentableMiddleware(config, handlers, conditions, {
    createContext: (req) => ({
      products,
      cart,
      orders,
      sessionKey: AuthService.extractSessionKey(req.headers.authorization),
    }),
    keysPath: '.agentable/keys.json',
  }))

  // Simple API for the React frontend (not part of AgentableUI protocol)
  app.get('/api/products', (_req, res) => {
    res.json(products.list())
  })

  app.get('/api/products/:id', (req, res) => {
    const product = products.find(req.params.id)
    if (!product) return res.status(404).json({ error: 'Not found' })
    res.json(product)
  })

  app.get('/api/search', (req, res) => {
    const query = req.query.q as string || ''
    res.json(products.search(query))
  })

  // Vite dev server in middleware mode — single process serves everything
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)

  app.listen(port, () => {
    console.log(`Example store running at http://localhost:${port}`)
    console.log(`AgentableUI endpoints:`)
    console.log(`  Discovery:   http://localhost:${port}/.well-known/agentable.json`)
    console.log(`  Execute:     POST http://localhost:${port}/agentable/execute`)
    console.log(`  Conditions:  GET  http://localhost:${port}/agentable/conditions`)
    console.log(``)
    console.log(`Demo API key: agui_k1_demo_user_key_123`)
  })
}

start()
