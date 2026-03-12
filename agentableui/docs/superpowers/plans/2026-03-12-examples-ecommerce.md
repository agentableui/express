# Examples E-Commerce Store — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional e-commerce store as a standalone repo demonstrating all AgentableUI features end-to-end.

**Architecture:** Express server with agentable middleware serving both the AgentableUI protocol endpoints and a Vite+React SPA. In-memory stores for products, carts, and orders — zero external dependencies. A demo agent script exercises the full SDK flow.

**Tech Stack:** TypeScript, Express, Vite, React, React Router, @agentableui/core, @agentableui/express, @agentableui/react, @agentableui/cli, @agentableui/sdk

**Spec:** `docs/superpowers/specs/2026-03-12-examples-ecommerce-design.md`

---

## File Map

```
examples-ecommerce/
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── index.html
├── README.md
├── .gitignore
├── src/
│   ├── server/
│   │   ├── index.ts              # Express app + agentable middleware + Vite dev server
│   │   ├── stores/
│   │   │   ├── products.ts       # ProductStore class + seed data (~10 products)
│   │   │   ├── cart.ts           # CartService class (per-session, keyed by API key)
│   │   │   └── orders.ts        # OrderService class (creates orders, decrements stock)
│   │   └── auth.ts              # AuthService (validates API keys, maps to sessions)
│   ├── client/
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # React Router setup + layout
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── SearchResults.tsx
│   │       ├── ProductPage.tsx
│   │       ├── Cart.tsx
│   │       ├── Checkout.tsx
│   │       ├── OrderConfirmation.tsx
│   │       └── Login.tsx
│   ├── agentable.config.ts      # defineAgentable() — full state machine
│   ├── agentable.handlers.ts    # defineHandlers() — scoped + fallback handlers
│   └── agentable.conditions.ts  # defineConditions() — cart-not-empty
├── .agentable/
│   └── keys.json                # Pre-seeded demo API keys (gitignored in real apps, committed here for demo)
└── scripts/
    └── demo-agent.ts            # SDK script: discover → search → buy flow
```

---

## Chunk 1: Project Scaffold + In-Memory Stores

### Task 1: Initialize project

**Files:**
- Create: `examples-ecommerce/package.json`
- Create: `examples-ecommerce/tsconfig.json`
- Create: `examples-ecommerce/tsconfig.server.json`
- Create: `examples-ecommerce/.gitignore`

- [ ] **Step 1: Create the repo directory**

```bash
mkdir -p /home/arsen/projects/agentableui/examples-ecommerce
cd /home/arsen/projects/agentableui/examples-ecommerce
git init
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "@agentableui/examples-ecommerce",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server/index.ts",
    "generate": "npx agentableui generate",
    "demo": "tsx scripts/demo-agent.ts"
  },
  "dependencies": {
    "@agentableui/core": "workspace:*",
    "@agentableui/express": "workspace:*",
    "@agentableui/react": "workspace:*",
    "@agentableui/cli": "workspace:*",
    "@agentableui/sdk": "workspace:*",
    "express": "^4.21.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**Note on repo structure:** The spec says "separate repo, not part of the monorepo." During development we use `workspace:*` links for convenience (add `examples-ecommerce` to `pnpm-workspace.yaml`). Before publishing as a standalone repo, replace with actual version ranges (e.g., `"^0.1.0"`) and remove from the workspace. The final published repo will have no workspace dependencies.

- [ ] **Step 3: Write tsconfig.json (client)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["src/client/**/*", "src/agentable.*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write tsconfig.server.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/server",
    "rootDir": "src"
  },
  "include": ["src/server/**/*", "src/agentable.*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
dist/
.agentable/*.json
!.agentable/keys.json
```

- [ ] **Step 6: Add examples-ecommerce to workspace**

Edit `/home/arsen/projects/agentableui/pnpm-workspace.yaml` to add `examples-ecommerce` to the packages list.

- [ ] **Step 7: Install dependencies**

```bash
cd /home/arsen/projects/agentableui && pnpm install
```

- [ ] **Step 8: Commit**

```bash
cd /home/arsen/projects/agentableui/examples-ecommerce
git add -A
git commit -m "chore: scaffold examples-ecommerce project"
```

---

### Task 2: ProductStore

**Files:**
- Create: `examples-ecommerce/src/server/stores/products.ts`

- [ ] **Step 1: Write ProductStore with seed data**

```typescript
// src/server/stores/products.ts

export interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  category: string
  imageUrl: string
}

const seedProducts: Product[] = [
  { id: 'shoe-001', name: 'Red Running Shoes', description: 'Lightweight running shoes in bold red', price: 89.99, stock: 15, category: 'shoes', imageUrl: '/images/red-shoes.jpg' },
  { id: 'shoe-002', name: 'Blue Trail Sneakers', description: 'Durable sneakers for trail running', price: 109.99, stock: 8, category: 'shoes', imageUrl: '/images/blue-sneakers.jpg' },
  { id: 'shirt-001', name: 'Cotton Crew T-Shirt', description: 'Classic cotton t-shirt in white', price: 24.99, stock: 50, category: 'shirts', imageUrl: '/images/white-tshirt.jpg' },
  { id: 'shirt-002', name: 'Slim Fit Oxford Shirt', description: 'Formal oxford shirt in light blue', price: 59.99, stock: 20, category: 'shirts', imageUrl: '/images/oxford-shirt.jpg' },
  { id: 'jacket-001', name: 'Waterproof Rain Jacket', description: 'Lightweight jacket for rainy days', price: 129.99, stock: 12, category: 'jackets', imageUrl: '/images/rain-jacket.jpg' },
  { id: 'jacket-002', name: 'Fleece Zip-Up', description: 'Warm fleece jacket with full zip', price: 74.99, stock: 25, category: 'jackets', imageUrl: '/images/fleece-jacket.jpg' },
  { id: 'pants-001', name: 'Slim Chino Pants', description: 'Tailored chino pants in khaki', price: 49.99, stock: 30, category: 'pants', imageUrl: '/images/chino-pants.jpg' },
  { id: 'pants-002', name: 'Stretch Denim Jeans', description: 'Comfortable stretch jeans in dark wash', price: 69.99, stock: 0, category: 'pants', imageUrl: '/images/denim-jeans.jpg' },
  { id: 'acc-001', name: 'Leather Belt', description: 'Genuine leather belt with brass buckle', price: 34.99, stock: 40, category: 'accessories', imageUrl: '/images/leather-belt.jpg' },
  { id: 'acc-002', name: 'Wool Beanie', description: 'Warm wool beanie in charcoal grey', price: 19.99, stock: 60, category: 'accessories', imageUrl: '/images/wool-beanie.jpg' },
]

export class ProductStore {
  private products: Map<string, Product>

  constructor() {
    this.products = new Map(seedProducts.map(p => [p.id, { ...p }]))
  }

  list(): Product[] {
    return Array.from(this.products.values())
  }

  find(id: string): Product | undefined {
    return this.products.get(id)
  }

  search(query: string): Product[] {
    const q = query.toLowerCase()
    return this.list().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }

  decrementStock(id: string, quantity: number): boolean {
    const product = this.products.get(id)
    if (!product || product.stock < quantity) return false
    product.stock -= quantity
    return true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/stores/products.ts
git commit -m "feat: add ProductStore with 10 seed products"
```

---

### Task 3: CartService

**Files:**
- Create: `examples-ecommerce/src/server/stores/cart.ts`

- [ ] **Step 1: Write CartService**

```typescript
// src/server/stores/cart.ts

export interface CartItem {
  id: string          // cart-item ID (unique per cart entry)
  productId: string
  name: string
  price: number
  quantity: number
  giftWrap: boolean
}

export class CartService {
  private carts: Map<string, CartItem[]> = new Map()
  private nextItemId = 1

  private getCart(sessionKey: string): CartItem[] {
    if (!this.carts.has(sessionKey)) {
      this.carts.set(sessionKey, [])
    }
    return this.carts.get(sessionKey)!
  }

  add(sessionKey: string, productId: string, name: string, price: number, quantity: number, giftWrap: boolean): CartItem {
    const cart = this.getCart(sessionKey)
    const existing = cart.find(item => item.productId === productId && item.giftWrap === giftWrap)
    if (existing) {
      existing.quantity += quantity
      return existing
    }
    const item: CartItem = {
      id: `item-${this.nextItemId++}`,
      productId,
      name,
      price,
      quantity,
      giftWrap,
    }
    cart.push(item)
    return item
  }

  remove(sessionKey: string, itemId: string): boolean {
    const cart = this.getCart(sessionKey)
    const index = cart.findIndex(item => item.id === itemId)
    if (index === -1) return false
    cart.splice(index, 1)
    return true
  }

  list(sessionKey: string): CartItem[] {
    return this.getCart(sessionKey)
  }

  isEmpty(sessionKey: string): boolean {
    return this.getCart(sessionKey).length === 0
  }

  total(sessionKey: string): number {
    return this.getCart(sessionKey).reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  clear(sessionKey: string): void {
    this.carts.set(sessionKey, [])
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/stores/cart.ts
git commit -m "feat: add CartService with per-session carts"
```

---

### Task 4: OrderService

**Files:**
- Create: `examples-ecommerce/src/server/stores/orders.ts`

- [ ] **Step 1: Write OrderService**

```typescript
// src/server/stores/orders.ts

import type { CartItem } from './cart.js'
import type { ProductStore } from './products.js'

export interface Order {
  id: string
  items: CartItem[]
  total: number
  shippingAddress: string
  paymentMethod: 'card' | 'paypal' | 'crypto'
  createdAt: string
}

export class OrderService {
  private orders: Map<string, Order> = new Map()
  private nextId = 1

  create(
    items: CartItem[],
    total: number,
    shippingAddress: string,
    paymentMethod: 'card' | 'paypal' | 'crypto',
    productStore: ProductStore
  ): Order {
    // Decrement stock for each item
    for (const item of items) {
      const success = productStore.decrementStock(item.productId, item.quantity)
      if (!success) {
        throw new Error(`Insufficient stock for ${item.name}`)
      }
    }

    const order: Order = {
      id: `order-${this.nextId++}`,
      items: [...items],
      total,
      shippingAddress,
      paymentMethod,
      createdAt: new Date().toISOString(),
    }
    this.orders.set(order.id, order)
    return order
  }

  find(id: string): Order | undefined {
    return this.orders.get(id)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/stores/orders.ts
git commit -m "feat: add OrderService with stock management"
```

---

### Task 5: AuthService

**Files:**
- Create: `examples-ecommerce/src/server/auth.ts`

- [ ] **Step 1: Write AuthService**

The express middleware handles API key validation against `.agentable/keys.json` automatically. The AuthService here maps validated API keys to session identifiers for cart isolation.

```typescript
// src/server/auth.ts

export interface UserSession {
  apiKey: string
  role: string
}

export class AuthService {
  /**
   * Extract session key from request authorization header.
   * Returns the API key string (used as cart session key) or null if no auth.
   */
  static extractSessionKey(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null
    return authHeader.slice(7)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat: add AuthService for session key extraction"
```

---

## Chunk 2: AgentableUI Config, Handlers, Conditions

### Task 6: agentable.config.ts

**Files:**
- Create: `examples-ecommerce/src/agentable.config.ts`

- [ ] **Step 1: Write the full state machine config**

```typescript
// src/agentable.config.ts
import { defineAgentable } from '@agentableui/core'

export default defineAgentable({
  name: 'example-store',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',

  states: {
    'home': {
      route: '/',
      description: 'Landing page with featured products and search',
      actions: {
        'search': {
          description: 'Search for products by keyword',
          params: { query: { type: 'string', required: true, description: 'Search query' } },
          transitions: 'search-results',
        },
        'view-product': {
          description: 'Navigate to a product detail page',
          params: { productId: { type: 'string', required: true, description: 'Product ID' } },
          transitions: 'product-page',
        },
      },
    },

    'search-results': {
      route: '/search',
      description: 'Search results listing matching products',
      actions: {
        'view-product': {
          description: 'View a product from search results',
          params: { productId: { type: 'string', required: true, description: 'Product ID' } },
          transitions: 'product-page',
        },
        'search': {
          description: 'Refine search with a new query',
          params: { query: { type: 'string', required: true, description: 'Search query' } },
          transitions: 'search-results',
        },
        'go-home': {
          description: 'Return to the home page',
          transitions: 'home',
        },
      },
    },

    'product-page': {
      route: '/products/:id',
      description: 'Product detail page with name, price, stock, and add-to-cart',
      actions: {
        'add-to-cart': {
          description: 'Add this product to your shopping cart',
          params: {
            productId: { type: 'string', required: true, description: 'Product ID' },
            quantity: { type: 'number', required: false, description: 'Quantity (default 1)' },
            giftWrap: { type: 'boolean', required: false, description: 'Gift wrap the item' },
          },
          transitions: 'cart',
          errors: ['OUT_OF_STOCK', 'INVALID_QUANTITY'],
          redirects: { 'auth-required': 'login' },
        },
        'go-back': {
          description: 'Go back to the home page',
          transitions: 'home',
        },
      },
    },

    'cart': {
      route: '/cart',
      description: 'Shopping cart with items, quantities, and totals',
      actions: {
        'checkout': {
          description: 'Proceed to checkout',
          transitions: 'checkout',
          available: 'cart-not-empty',
        },
        'remove-item': {
          description: 'Remove an item from the cart',
          params: { itemId: { type: 'string', required: true, description: 'Cart item ID' } },
        },
        'continue-shopping': {
          description: 'Return to the home page to browse more',
          transitions: 'home',
        },
      },
    },

    'checkout': {
      route: '/checkout',
      description: 'Checkout flow — enter shipping and payment details',
      actions: {
        'submit-order': {
          description: 'Submit the order with shipping and payment info',
          params: {
            shippingAddress: { type: 'string', required: true, description: 'Full shipping address' },
            paymentMethod: { type: 'enum', values: ['card', 'paypal', 'crypto'], required: true, description: 'Payment method' },
          },
          transitions: 'order-confirmation',
          errors: ['PAYMENT_FAILED', 'INVALID_ADDRESS'],
        },
        'back-to-cart': {
          description: 'Go back to cart to make changes',
          transitions: 'cart',
        },
      },
    },

    'order-confirmation': {
      route: '/order/:id',
      description: 'Order confirmation with order details and ID',
      actions: {
        'go-home': {
          description: 'Return to the home page',
          transitions: 'home',
        },
      },
    },

    'login': {
      route: '/login',
      description: 'Login page — agents are redirected here when auth is required',
      actions: {
        'authenticate': {
          description: 'Authenticate with an API token',
          params: { token: { type: 'string', required: true, description: 'API key or auth token' } },
          transitions: 'home',
          returnToPrevious: true,
        },
      },
    },
  },

  auth: {
    public: ['home', 'search-results', 'product-page', 'login'],
    user: ['home', 'search-results', 'product-page', 'cart', 'checkout', 'order-confirmation', 'login'],
  },

  security: {
    requireApiKey: true,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['search', 'view-product', 'go-home', 'go-back', 'continue-shopping'],
    authenticatedActions: ['add-to-cart', 'checkout', 'submit-order', 'remove-item'],
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/agentable.config.ts
git commit -m "feat: add agentable.config.ts with full state machine"
```

---

### Task 7: agentable.handlers.ts

**Files:**
- Create: `examples-ecommerce/src/agentable.handlers.ts`

- [ ] **Step 1: Write all handlers**

```typescript
// src/agentable.handlers.ts
import { defineHandlers, AgentableError } from '@agentableui/core'
import type config from './agentable.config.js'
import type { ProductStore } from './server/stores/products.js'
import type { CartService } from './server/stores/cart.js'
import type { OrderService } from './server/stores/orders.js'

export type AppContext = {
  products: ProductStore
  cart: CartService
  orders: OrderService
  sessionKey: string | null
}

export default defineHandlers<typeof config>()<AppContext>({
  // Fallback: search (shared across home + search-results — demonstrates fallback pattern)
  'search': async ({ query }, ctx) => {
    const results = ctx.products.search(query as string)
    return { results: results.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category })) }
  },

  // Fallback: view-product (shared across home + search-results — demonstrates fallback pattern)
  'view-product': async ({ productId }, ctx) => {
    const product = ctx.products.find(productId as string)
    if (!product) {
      throw new AgentableError('NOT_FOUND', `Product ${productId} not found`)
    }
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      inStock: product.stock > 0,
    }
  },

  // Scoped: product-page.add-to-cart
  'product-page.add-to-cart': async ({ productId, quantity, giftWrap }, ctx) => {
    const product = ctx.products.find(productId as string)
    if (!product) {
      throw new AgentableError('NOT_FOUND', `Product ${productId} not found`)
    }
    const qty = (quantity as number | undefined) ?? 1
    if (qty < 1 || !Number.isInteger(qty)) {
      throw new AgentableError('INVALID_QUANTITY', `Quantity must be a positive integer`)
    }
    if (product.stock < qty) {
      throw new AgentableError('OUT_OF_STOCK', `${product.name} only has ${product.stock} in stock`)
    }
    const wrap = (giftWrap as boolean | undefined) ?? false
    const item = ctx.cart.add(ctx.sessionKey!, product.id, product.name, product.price, qty, wrap)
    return { added: product.name, quantity: qty, giftWrap: wrap, cartItemId: item.id }
  },

  // Scoped: cart.remove-item
  'cart.remove-item': async ({ itemId }, ctx) => {
    const removed = ctx.cart.remove(ctx.sessionKey!, itemId as string)
    if (!removed) {
      throw new AgentableError('NOT_FOUND', `Cart item ${itemId} not found`)
    }
    return { removed: itemId, items: ctx.cart.list(ctx.sessionKey!) }
  },

  // Scoped: checkout.submit-order
  'checkout.submit-order': async ({ shippingAddress, paymentMethod }, ctx) => {
    const address = shippingAddress as string
    if (address.trim().length < 10) {
      throw new AgentableError('INVALID_ADDRESS', 'Shipping address is too short')
    }

    // Simulate payment failure for 'crypto' 50% of the time (demo purposes)
    if (paymentMethod === 'crypto' && Math.random() < 0.5) {
      throw new AgentableError('PAYMENT_FAILED', 'Crypto payment failed — please try again')
    }

    const items = ctx.cart.list(ctx.sessionKey!)
    const total = ctx.cart.total(ctx.sessionKey!)
    const order = ctx.orders.create(items, total, address, paymentMethod as 'card' | 'paypal' | 'crypto', ctx.products)
    ctx.cart.clear(ctx.sessionKey!)
    return { orderId: order.id, total: order.total, items: order.items.length }
  },

  // Pure transitions (go-home, go-back, continue-shopping, back-to-cart, checkout)
  // are auto-handled by the express middleware — no handlers needed.
})
```

- [ ] **Step 2: Commit**

```bash
git add src/agentable.handlers.ts
git commit -m "feat: add agentable.handlers.ts with scoped + fallback handlers"
```

---

### Task 8: agentable.conditions.ts

**Files:**
- Create: `examples-ecommerce/src/agentable.conditions.ts`

- [ ] **Step 1: Write conditions**

```typescript
// src/agentable.conditions.ts
import { defineConditions } from '@agentableui/core'
import type config from './agentable.config.js'
import type { AppContext } from './agentable.handlers.js'

export default defineConditions<typeof config, AppContext>({
  'cart-not-empty': {
    description: 'Cart must contain at least one item to proceed to checkout',
    check: (ctx) => !ctx.cart.isEmpty(ctx.sessionKey!),
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/agentable.conditions.ts
git commit -m "feat: add agentable.conditions.ts with cart-not-empty"
```

---

## Chunk 3: Express Server

### Task 9: Express server with agentable middleware

**Files:**
- Create: `examples-ecommerce/src/server/index.ts`
- Create: `examples-ecommerce/.agentable/keys.json`

- [ ] **Step 1: Pre-seed demo API keys**

Create `.agentable/keys.json` with pre-generated demo keys. Use the `@agentableui/core` key generation utility or manually create hashes.

```bash
cd /home/arsen/projects/agentableui/examples-ecommerce
mkdir -p .agentable
```

Write a small script or use Node to generate keys, or manually create the keys file. The simplest approach: create a known demo key and its SHA256 hash.

```typescript
// Quick one-off to generate the keys file — run with tsx
import { createHash } from 'crypto'
import { writeFileSync } from 'fs'

const demoKey = 'agui_k1_demo_user_key_123'
const hash = createHash('sha256').update(demoKey).digest('hex')

const keys = {
  keys: [
    {
      prefix: demoKey.slice(0, 12),
      name: 'demo-user',
      hash,
      role: 'user',
      createdAt: new Date().toISOString(),
      revokedAt: null,
    }
  ]
}

writeFileSync('.agentable/keys.json', JSON.stringify(keys, null, 2))
console.log('Demo key:', demoKey)
```

- [ ] **Step 2: Write Express server**

```typescript
// src/server/index.ts
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
```

- [ ] **Step 3: Verify server starts**

```bash
cd /home/arsen/projects/agentableui/examples-ecommerce
pnpm dev
```

Expected: Server starts, prints endpoints and demo key. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts .agentable/keys.json
git commit -m "feat: add Express server with agentable middleware"
```

---

## Chunk 4: Vite + React Frontend

### Task 10: Vite config + HTML entry

**Files:**
- Create: `examples-ecommerce/vite.config.ts`
- Create: `examples-ecommerce/index.html`

- [ ] **Step 1: Write vite.config.ts**

Since the Express server integrates Vite in middleware mode (see Task 9), this config is used by the embedded Vite server — no proxy needed.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 2: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentableUI Example Store</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/client/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts index.html
git commit -m "feat: add Vite config and HTML entry point"
```

---

### Task 11: React app shell + pages

**Files:**
- Create: `examples-ecommerce/src/client/main.tsx`
- Create: `examples-ecommerce/src/client/App.tsx`
- Create: `examples-ecommerce/src/client/pages/Home.tsx`
- Create: `examples-ecommerce/src/client/pages/SearchResults.tsx`
- Create: `examples-ecommerce/src/client/pages/ProductPage.tsx`
- Create: `examples-ecommerce/src/client/pages/Cart.tsx`
- Create: `examples-ecommerce/src/client/pages/Checkout.tsx`
- Create: `examples-ecommerce/src/client/pages/OrderConfirmation.tsx`
- Create: `examples-ecommerce/src/client/pages/Login.tsx`

- [ ] **Step 1: Write main.tsx**

```tsx
// src/client/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 2: Write App.tsx with routes**

```tsx
// src/client/App.tsx
import { Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home.js'
import { SearchResults } from './pages/SearchResults.js'
import { ProductPage } from './pages/ProductPage.js'
import { Cart } from './pages/Cart.js'
import { Checkout } from './pages/Checkout.js'
import { OrderConfirmation } from './pages/OrderConfirmation.js'
import { Login } from './pages/Login.js'

export function App() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #ddd', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1 style={{ margin: 0 }}>AgentableUI Example Store</h1>
        </Link>
        <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.875rem' }}>
          A demo e-commerce store powered by AgentableUI
        </p>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:id" element={<OrderConfirmation />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 3: Write page components**

Each page is a simple functional component that fetches data from `/api/*` endpoints and renders it. These are minimal — just enough to be a real browsable store. Use `fetch` directly (no state library).

**Home.tsx** — lists featured products, has a search form.
**SearchResults.tsx** — reads `?q=` param, fetches `/api/search?q=`, lists results.
**ProductPage.tsx** — fetches `/api/products/:id`, shows detail + "Add to Cart" button.
**Cart.tsx** — shows cart items (from local state or API), checkout button.
**Checkout.tsx** — shipping + payment form.
**OrderConfirmation.tsx** — shows order ID + summary.
**Login.tsx** — simple token input form.

Each page should be ~30-60 lines. Keep styling inline and minimal. The frontend exists to make the example runnable in a browser, not to be a design showcase.

- [ ] **Step 4: Commit**

```bash
git add src/client/
git commit -m "feat: add React frontend with all page components"
```

---

## Chunk 5: Demo Agent Script + README

### Task 12: Demo agent script

**Files:**
- Create: `examples-ecommerce/scripts/demo-agent.ts`

- [ ] **Step 1: Write the demo agent script**

```typescript
// scripts/demo-agent.ts
import { AgentableClient } from '@agentableui/sdk'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'agui_k1_demo_user_key_123'

async function main() {
  console.log('=== AgentableUI Demo Agent ===\n')

  // ── Phase 1: Public discovery (no auth) ──────────────────────────
  console.log('--- Phase 1: Public Discovery (unauthenticated) ---\n')

  const publicClient = new AgentableClient(BASE_URL, { role: 'public' })
  const publicManifest = await publicClient.discover()
  console.log(`Discovered: ${publicManifest.name} (role: ${publicManifest.role})`)
  console.log(`States available: ${Object.keys(publicManifest.states).join(', ')}`)
  console.log(`Current state: ${publicClient.currentState!.name}\n`)

  // 2. State graph (public view)
  const graph = publicClient.getStateGraph()
  console.log(`State graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} --[${edge.action}]--> ${edge.to}`)
  }
  console.log()

  // 3. Validate plan (structural check only)
  const plan = publicClient.validatePlan(['search', 'view-product', 'add-to-cart', 'checkout', 'submit-order'])
  console.log(`Plan valid: ${plan.valid}`)
  if (!plan.valid) {
    console.log(`  Failed at: ${plan.failedAt} — ${plan.reason}`)
  }
  console.log()

  // 4. Search (public action — no auth needed)
  console.log('--- Searching for "shoes" ---')
  const searchResult = await publicClient.execute('search', { query: 'shoes' })
  console.log(`State: ${publicClient.currentState!.name}`)
  if (searchResult.status === 'ok') {
    const results = searchResult.data.results as Array<{ id: string; name: string; price: number }>
    console.log(`Found ${results.length} products:`)
    for (const r of results) {
      console.log(`  ${r.id}: ${r.name} ($${r.price})`)
    }
  }
  console.log()

  // 5. View product (public action)
  const productId = 'shoe-001'
  console.log(`--- Viewing product ${productId} ---`)
  const viewResult = await publicClient.execute('view-product', { productId })
  console.log(`State: ${publicClient.currentState!.name}`)
  if (viewResult.status === 'ok') {
    console.log(`Product: ${viewResult.data.name} - $${viewResult.data.price} (stock: ${viewResult.data.stock})`)
  }
  console.log()

  // ── Phase 2: Auth redirect flow ──────────────────────────────────
  console.log('--- Phase 2: Auth Redirect (attempting add-to-cart without auth) ---\n')

  // 6. Attempt add-to-cart without auth → should get redirect to login
  const redirectResult = await publicClient.execute('add-to-cart', { productId, quantity: 1 })
  console.log(`Result status: ${redirectResult.status}`)
  if (redirectResult.status === 'redirect') {
    console.log(`Redirected to: ${redirectResult.state} (reason: ${redirectResult.reason})`)
    console.log(`Return to: ${redirectResult.returnTo}`)
  } else if (redirectResult.status === 'unauthorized') {
    console.log(`Unauthorized: ${redirectResult.message}`)
  }
  console.log()

  // ── Phase 3: Authenticated flow ──────────────────────────────────
  console.log('--- Phase 3: Authenticated Flow ---\n')

  // 7. Create authenticated client with user role
  const client = new AgentableClient(BASE_URL, { apiKey: API_KEY, role: 'user' })
  const manifest = await client.discover()
  console.log(`Authenticated as user — ${Object.keys(manifest.states).length} states available`)
  console.log(`States: ${Object.keys(manifest.states).join(', ')}`)
  console.log(`Current state: ${client.currentState!.name}\n`)

  // 8. Navigate to product page
  await client.execute('search', { query: 'shoes' })
  await client.execute('view-product', { productId })
  console.log(`Navigated to: ${client.currentState!.name}\n`)

  // 9. Add to cart (now authenticated — should succeed)
  console.log('--- Adding to cart (authenticated) ---')
  const addResult = await client.execute('add-to-cart', { productId, quantity: 2, giftWrap: true })
  console.log(`State: ${client.currentState!.name}`)
  if (addResult.status === 'ok') {
    console.log(`Added: ${addResult.data.added} x${addResult.data.quantity} (gift wrap: ${addResult.data.giftWrap})`)
  } else {
    console.log(`Unexpected: ${addResult.status}`, addResult)
  }
  console.log()

  // 10. Check conditions before checkout
  console.log('--- Checking conditions ---')
  const conditions = await client.checkConditions()
  for (const [name, cond] of Object.entries(conditions.conditions)) {
    console.log(`  ${name}: ${cond.met ? 'MET' : 'NOT MET'} — ${cond.description}`)
  }
  console.log()

  // 11. Checkout
  console.log('--- Proceeding to checkout ---')
  await client.execute('checkout')
  console.log(`State: ${client.currentState!.name}\n`)

  // 12. Submit order
  console.log('--- Submitting order ---')
  const orderResult = await client.execute('submit-order', {
    shippingAddress: '123 Main Street, Springfield, IL 62701',
    paymentMethod: 'card',
  })
  console.log(`State: ${client.currentState!.name}`)
  if (orderResult.status === 'ok') {
    console.log(`Order placed! ID: ${orderResult.data.orderId}, Total: $${orderResult.data.total}`)
  } else {
    console.log(`Result: ${orderResult.status}`, orderResult)
  }
  console.log()

  console.log('=== Demo complete ===')
}

main().catch(console.error)
```

- [ ] **Step 2: Verify demo runs end-to-end**

Start the server in one terminal:
```bash
cd /home/arsen/projects/agentableui/examples-ecommerce && pnpm dev
```

Run the demo in another:
```bash
cd /home/arsen/projects/agentableui/examples-ecommerce && pnpm demo
```

Expected: Three phases complete — public discovery, auth redirect, authenticated purchase flow.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo-agent.ts
git commit -m "feat: add demo agent script exercising full SDK flow"
```

---

### Task 13: README

**Files:**
- Create: `examples-ecommerce/README.md`

- [ ] **Step 1: Write README**

Cover: what this is, how to run, what it demonstrates, project structure, the demo agent script, and links to AgentableUI docs/packages.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage instructions"
```

---

## Chunk 6: Final Verification

### Task 14: End-to-end verification

- [ ] **Step 1: Install and build**

```bash
cd /home/arsen/projects/agentableui && pnpm install
cd examples-ecommerce
```

- [ ] **Step 2: Generate manifests**

```bash
pnpm generate
```

Verify `.agentable/` contains `agentable.public.json` and `agentable.user.json`.

- [ ] **Step 3: Start server and test endpoints manually**

```bash
pnpm dev &
sleep 2
curl http://localhost:3000/.well-known/agentable.json | jq .
curl http://localhost:3000/agentable/manifest/public | jq .
curl http://localhost:3000/api/products | jq '.[0]'
kill %1
```

- [ ] **Step 4: Run demo agent**

```bash
pnpm dev &
sleep 2
pnpm demo
kill %1
```

Expected: Full agent flow completes with no errors.

- [ ] **Step 5: Verify frontend is served by the same Express server**

```bash
pnpm dev &
sleep 3
curl -s http://localhost:3000/ | head -20
kill %1
```

Expected: HTML page loads (Vite runs in middleware mode inside Express — single process).

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
