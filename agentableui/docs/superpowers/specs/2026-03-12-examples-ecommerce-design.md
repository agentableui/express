# Examples E-Commerce Store — Design Spec

## Overview

A fully functional e-commerce store demonstrating AgentableUI end-to-end. Real in-memory backend (products, cart, orders, auth), Vite+React frontend, Express server with `@agentableui/express` middleware. An agent can discover the manifest, browse products, search, add to cart, and checkout — all through the AgentableUI protocol.

**Repo:** `agentableui/examples-ecommerce` (separate repo, not part of the monorepo)

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Backend:** Express + TypeScript
- **Data:** In-memory stores (no database — zero setup to run)
- **AgentableUI packages:** core, react, cli, express, sdk

## State Machine

Based on the CLAUDE.md e-commerce example (uses `checkout-flow` renamed to `checkout` for brevity):

```
home → search-results → product-page → cart → checkout → order-confirmation
                              ↓                    ↑
                            login ─────────────────┘
                        (returnToPrevious)
```

### States

| State | Route | Description |
|-------|-------|-------------|
| `home` | `/` | Landing page with featured products |
| `search-results` | `/search` | Search results listing |
| `product-page` | `/products/:id` | Product detail page |
| `cart` | `/cart` | Shopping cart |
| `checkout` | `/checkout` | Checkout flow |
| `order-confirmation` | `/order/:id` | Order confirmation |
| `login` | `/login` | Login page for auth redirects |

### Actions

| State | Action | Params | Transitions | Notes |
|-------|--------|--------|-------------|-------|
| `home` | `search` | `query: string (required)` | `search-results` | |
| `home` | `view-product` | `productId: string (required)` | `product-page` | |
| `search-results` | `view-product` | `productId: string (required)` | `product-page` | |
| `search-results` | `search` | `query: string (required)` | `search-results` | Self-transition |
| `search-results` | `go-home` | — | `home` | Pure transition |
| `product-page` | `add-to-cart` | `productId: string (required)`, `quantity: number (optional)`, `giftWrap: boolean (optional)` | `cart` | Errors: `OUT_OF_STOCK`, `INVALID_QUANTITY`. Redirects: `auth-required` → `login` |
| `product-page` | `go-back` | — | `home` | Pure transition |
| `cart` | `checkout` | — | `checkout` | Condition: `cart-not-empty` |
| `cart` | `remove-item` | `itemId: string (required)` | — | Self-transition |
| `cart` | `continue-shopping` | — | `home` | Pure transition |
| `checkout` | `submit-order` | `shippingAddress: string (required)`, `paymentMethod: enum[card,paypal,crypto] (required)` | `order-confirmation` | Errors: `PAYMENT_FAILED`, `INVALID_ADDRESS` |
| `checkout` | `back-to-cart` | — | `cart` | Pure transition |
| `order-confirmation` | `go-home` | — | `home` | Pure transition |
| `login` | `authenticate` | `token: string (required)` | `home` | `returnToPrevious: true` |

### Features Demonstrated

- Typed params: string, number, boolean, enum (all four types)
- Auth redirects + `returnToPrevious`
- Conditions (`cart-not-empty`)
- Error codes (`OUT_OF_STOCK`, `PAYMENT_FAILED`, `INVALID_ADDRESS`, `INVALID_QUANTITY`)
- Scoped handlers (`home.search`, `product-page.add-to-cart`) vs fallback handlers (`view-product`)
- Auto-passthrough for pure transitions (`go-home`, `go-back`, `continue-shopping`, `back-to-cart`)
- Auth roles: public manifest (home, search-results, product-page, login) and user manifest (all states)
- API key auth + per-key rate limiting
- Security config block (`requireApiKey`, `rateLimit`, `publicActions`, `authenticatedActions`)
- Meta-manifest discovery (`/.well-known/agentable.json`)
- Manifest `versionHash` + ETag caching (handled by express middleware)
- Action and param `description` fields for LLM agent consumption

## In-Memory Backend

### ProductStore

~10 seed products with fields: `id`, `name`, `description`, `price`, `stock`, `category`, `imageUrl`. Supports `search(query)` (substring match on name/description/category), `find(id)`, and `list()`.

### CartService

Per-session cart keyed by API key. Supports `add(productId, quantity)`, `remove(itemId)`, `list()`, `isEmpty`, `clear()`. Validates stock on add.

### OrderService

Creates orders from cart contents. Decrements product stock atomically. Returns order with `id`, `items`, `total`, `shippingAddress`, `paymentMethod`, `createdAt`.

### AuthService

Validates API keys. Pre-seeded with a few demo keys. Maps keys to user sessions for cart isolation.

## Auth Roles

| Role | Accessible States |
|------|-------------------|
| `public` | home, search-results, product-page, login |
| `user` | all states |

Public actions: `search`, `view-product`, `go-home`, `go-back`, `continue-shopping`
Authenticated actions: `add-to-cart`, `checkout`, `submit-order`, `remove-item`

## Project Structure

```
examples-ecommerce/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── server/
│   │   ├── index.ts              # Express app setup + agentable middleware
│   │   ├── stores/
│   │   │   ├── products.ts       # In-memory product catalog (~10 seed products)
│   │   │   ├── cart.ts           # Per-session cart service
│   │   │   └── orders.ts        # Order creation + stock management
│   │   └── auth.ts              # API key validation
│   ├── client/
│   │   ├── main.tsx             # Vite entry point
│   │   ├── App.tsx              # React Router routes + layout
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── SearchResults.tsx
│   │       ├── ProductPage.tsx
│   │       ├── Cart.tsx
│   │       ├── Checkout.tsx
│   │       ├── OrderConfirmation.tsx
│   │       └── Login.tsx
│   ├── agentable.config.ts      # State machine definition
│   ├── agentable.handlers.ts    # Action handlers (scoped + fallback)
│   └── agentable.conditions.ts  # Runtime conditions (cart-not-empty)
├── .agentable/                   # Generated manifests
└── scripts/
    └── demo-agent.ts            # SDK-based demo agent script
```

## Demo Agent Script

`scripts/demo-agent.ts` uses `@agentableui/sdk` to walk through the full agent flow:

1. `discover()` — fetch meta-manifest (`/.well-known/agentable.json`) + public manifest
2. `getStateGraph()` — print the state graph overview
3. `validatePlan(['search', 'view-product', 'add-to-cart', 'checkout', 'submit-order'])` — validate the planned action sequence
4. `execute('search', { query: 'shoes' })` — search products
5. `execute('view-product', { productId: '...' })` — view a result
6. Attempt `add-to-cart` without auth → observe redirect to login
7. `execute('authenticate', { token: 'demo-key' })` — authenticate
8. `execute('add-to-cart', { productId: '...', quantity: 1 })` — add to cart
9. `checkConditions()` — verify `cart-not-empty` is met before checkout
10. `execute('checkout')` — proceed to checkout
11. `execute('submit-order', { shippingAddress: '...', paymentMethod: 'card' })` — place order
12. Print order confirmation

This serves as both a runnable demo and a smoke test.

## Developer Experience

### Running the Example

```bash
git clone https://github.com/agentableui/examples-ecommerce
cd examples-ecommerce
pnpm install
pnpm generate    # npx agentableui generate → builds manifests
pnpm dev         # starts Express server (serves API + Vite dev frontend)
pnpm demo        # runs demo-agent.ts against the running server
```

### What Developers Learn

By reading and running this example, developers understand:
- How to structure agentable.config.ts, handlers, and conditions
- How the Express middleware wires everything together
- How manifests are generated and served
- How an agent interacts with the store through the SDK
- How auth, redirects, conditions, and errors work in practice

## Non-Goals

- No persistent database (in-memory only)
- No production deployment config
- No payment processing (simulated)
- No admin role manifest (public + user only)
- No frontend state management library (simple React state)
