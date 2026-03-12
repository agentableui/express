# AgentableUI Example Store

A fully functional e-commerce store demonstrating all AgentableUI features end-to-end.

## What This Demonstrates

- **State machine config** (`agentable.config.ts`) — 7 states, typed params (string/number/boolean/enum), auth redirects, conditions
- **Scoped + fallback handlers** (`agentable.handlers.ts`) — `product-page.add-to-cart` (scoped) vs `view-product` (fallback)
- **Auto-passthrough** — pure transitions like `go-home`, `go-back` need no handler code
- **Conditions** (`agentable.conditions.ts`) — `cart-not-empty` blocks checkout when cart is empty
- **Error codes** — `OUT_OF_STOCK`, `INVALID_QUANTITY`, `PAYMENT_FAILED`, `INVALID_ADDRESS`
- **Auth roles** — public manifest (4 states) vs user manifest (all 7 states)
- **Auth redirects + returnToPrevious** — unauthenticated `add-to-cart` redirects to login
- **Express middleware** — single `agentableMiddleware()` call serves all protocol endpoints
- **SDK agent flow** — discover, navigate, execute, check conditions, complete purchase
- **Meta-manifest discovery** — `/.well-known/agentable.json`

## Quick Start

```bash
pnpm install
pnpm dev         # starts Express + Vite on http://localhost:3000
```

In another terminal:

```bash
pnpm demo        # runs the demo agent script
```

## Project Structure

```
src/
├── server/
│   ├── index.ts              # Express app + agentable middleware + Vite dev server
│   ├── stores/
│   │   ├── products.ts       # In-memory product catalog (10 seed products)
│   │   ├── cart.ts           # Per-session cart service
│   │   └── orders.ts         # Order creation + stock management
│   └── auth.ts               # Session key extraction from Bearer token
├── client/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # React Router routes + layout
│   └── pages/                # 7 page components matching state machine states
├── agentable.config.ts       # State machine definition
├── agentable.handlers.ts     # Action handlers
└── agentable.conditions.ts   # Runtime conditions
scripts/
└── demo-agent.ts             # SDK-based demo agent script
```

## AgentableUI Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/agentable.json` | GET | Meta-manifest (discovery) |
| `/agentable/manifest/:role` | GET | Role-specific manifest |
| `/agentable/execute` | POST | Execute action |
| `/agentable/conditions` | GET | Query runtime conditions |

## Demo API Key

Pre-seeded for testing: `agui_k1_demo_user_key_123` (role: `user`)

## Packages Used

- [`@agentableui/core`](https://github.com/agentableui/core) — config, handlers, conditions, errors
- [`@agentableui/express`](https://github.com/agentableui/express) — Express middleware
- [`@agentableui/sdk`](https://github.com/agentableui/sdk) — Agent-side client
- [`@agentableui/cli`](https://github.com/agentableui/cli) — Manifest generation
- [`@agentableui/react`](https://github.com/agentableui/react) — React hooks (dev-time validation)
