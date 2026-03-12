# @agentableui/cli — Design Spec

## Overview

CLI tool for AgentableUI that reads `agentable.config.ts` and generates static manifests, typed React hooks, and provides validation/visualization of the state machine. Also manages API keys.

## Commands

### `init`

Scaffolds starter files into the current directory:
- `agentable.config.ts` — minimal example config (2 states, 3 actions)
- `agentable.handlers.ts` — matching handler stubs
- `agentable.conditions.ts` — empty conditions file
- `server.ts` — Express server with `agentableMiddleware()` wired up, imports from the three config files
- Skips files that already exist (prints warning per file)
- No flags needed

### `generate`

Reads `agentable.config.ts` via jiti, outputs to `.agentable/`:
- `agentable.<role>.json` — one manifest per auth role (via core's `buildManifest()`)
- `agentable.meta.json` — meta-manifest (via core's `buildMetaManifest()`)
- `hooks.ts` — typed React hooks derived from config (see Generated Hooks section). **Skipped if `@agentableui/react` is not in dependencies** — prints "Skipping hooks.ts (@agentableui/react not installed)".
- `.gitignore` — contains `keys.json` (manifests and hooks should be committed)
- `--watch` flag: chokidar watches `agentable.config.ts`, `agentable.handlers.ts`, `agentable.conditions.ts`, re-generates on change with 300ms debounce
- `--config <path>` flag: override config file location (default: `agentable.config.ts` in cwd)

### `validate`

Static analysis of the config. Two modes:

**Default (config-only, always safe):**
- Orphan states (unreachable from entrypoint via BFS)
- Invalid transitions (referencing non-existent states)
- Duplicate action names across states that would collide in fallback handler resolution
- Empty states (states with no actions)

**`--full` (loads handlers + conditions via jiti, for CI environments):**
- All config-only checks above, plus:
- Missing handlers (non-pure-transition actions without a scoped or fallback handler)
- Undefined conditions (actions reference conditions not defined in conditions file)
- Unused handlers (handler keys that don't match any state.action or action)
- Unused conditions (conditions defined but never referenced by any action)

Exit code 1 if any errors found, 0 on success. Warnings (unused handlers/conditions) don't affect exit code.

Output format: one line per issue, prefixed with `error:` or `warn:`, includes state/action context.

### `visualize`

Prints the state machine graph. Default: ASCII list format. `--format mermaid` for mermaid.

**ASCII (default):**
```
test-store (entrypoint: home)

  home /
    ──search──> search-results
    ──view-product──> product-page

  search-results /search
    ──view-product──> product-page
    ──search──> search-results (self)
    ──go-home──> home

  product-page /products/:id
    ──add-to-cart──> cart [auth]
    ──go-back──> home
```

**Mermaid (`--format mermaid`):**
```
stateDiagram-v2
    [*] --> home
    home --> search_results : search
    home --> product_page : view-product
    search_results --> product_page : view-product
    search_results --> search_results : search
    search_results --> home : go-home
    product_page --> cart : add-to-cart
    product_page --> home : go-back
```

### `keys generate --name <name> [--role <role>]`

Creates an API key via core's `generateKey()`. Prints the full key (only shown once). Role defaults to `user`. Keys stored in `.agentable/keys.json`.

### `keys list`

Lists keys in table format via core's `listKeys()`. Columns: prefix, name, role, created, status.

### `keys revoke <prefix>`

Revokes a key by prefix via core's `revokeKey()`. No confirmation prompt (CLI tools should be scriptable).

## Architecture

```
cli/
├── src/
│   ├── index.ts              # commander program setup, register all commands
│   ├── config-loader.ts      # jiti-based config loader (+ optional handlers/conditions)
│   ├── commands/
│   │   ├── init.ts           # scaffold project files
│   │   ├── generate.ts       # build manifests + hooks
│   │   ├── validate.ts       # state machine integrity checks
│   │   ├── visualize.ts      # ASCII + mermaid output
│   │   └── keys.ts           # generate/list/revoke subcommands
│   └── generators/
│       ├── manifests.ts      # write .agentable/*.json files
│       └── hooks.ts          # write .agentable/hooks.ts (type generation)
├── tests/
│   ├── config-loader.test.ts
│   ├── generate.test.ts
│   ├── validate.test.ts
│   ├── visualize.test.ts
│   └── fixtures/
│       ├── valid-config.ts
│       ├── orphan-state-config.ts
│       ├── invalid-transition-config.ts
│       └── valid-handlers.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Config Loading

Uses `jiti` to import TypeScript config files at runtime. Resolves from cwd by default, `--config <path>` flag to override.

```typescript
// config-loader.ts
import { createJiti } from 'jiti'

export async function loadConfig(configPath?: string): Promise<AgentableConfig> {
  const jiti = createJiti(process.cwd())
  const resolved = configPath ?? './agentable.config.ts'
  const mod = await jiti.import(resolve(process.cwd(), resolved))
  const config = (mod as any).default ?? mod
  // validate it's a valid AgentableConfig shape
  return config
}

export async function loadHandlers(handlersPath?: string) { /* same pattern */ }
export async function loadConditions(conditionsPath?: string) { /* same pattern */ }
```

Error handling: if file not found, print clear error with expected path and exit 1. If TS syntax error, print jiti's error message and exit 1.

## Generated Hooks

The `generate` command produces `.agentable/hooks.ts` with **deep param typing**:

```typescript
// .agentable/hooks.ts — AUTO-GENERATED by @agentableui/cli, DO NOT EDIT
import { createHooks } from '@agentableui/react'

export type AppConfig = {
  states: {
    home: {
      actions: {
        search: { params: { query: string }; transitions: 'search-results' }
        'view-product': { params: { productId: string }; transitions: 'product-page' }
      }
    }
    'search-results': {
      actions: {
        'view-product': { params: { productId: string }; transitions: 'product-page' }
        search: { params: { query: string }; transitions: 'search-results' }
        'go-home': { params: {}; transitions: 'home' }
      }
    }
    'product-page': {
      actions: {
        'add-to-cart': {
          params: { productId: string; quantity?: number }
          transitions: 'cart'
          errors: 'OUT_OF_STOCK' | 'INVALID_QUANTITY'
        }
        'go-back': { params: {}; transitions: 'home' }
      }
    }
    cart: {
      actions: {
        checkout: { params: {}; transitions: 'checkout-flow' }
        'remove-item': { params: { itemId: string } }
        'continue-shopping': { params: {}; transitions: 'home' }
      }
    }
  }
}

export const {
  AgentableProvider,
  useAgentableState,
  useAgentableAction,
  useAgentableConditions,
} = createHooks<AppConfig>()
```

Type mapping from config param types:
- `string` → `string`
- `number` → `number`
- `boolean` → `boolean`
- `enum` with values → string literal union (e.g., `'card' | 'paypal' | 'crypto'`)
- `required: false` → optional property (`quantity?: number`)
- No `transitions` → omitted (self-transition)
- `errors` → string literal union

## .agentable/ Directory

- Created by `generate` if it doesn't exist
- `generate` creates `.agentable/.gitignore` containing `keys.json`
- Manifests (`*.json` except keys) and `hooks.ts` are meant to be committed
- `keys.json` is always gitignored (contains secrets)

## Dependencies

Runtime:
- `@agentableui/core` — workspace link
- `commander` — CLI framework
- `jiti` — TS config loading
- `chokidar` — file watching (`--watch`)

Dev:
- `tsup`, `vitest`, `typescript`, `eslint`, `typescript-eslint`, `@types/node`, `@eslint/js`

No `chalk` — use ANSI escape codes directly for the few colored outputs needed (keeps deps minimal).

## Package Setup

```json
{
  "name": "@agentableui/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "agentableui": "./dist/index.cjs" },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

tsup config: `entry: ['src/index.ts']`, `format: ['cjs', 'esm']`, `dts: true`, `banner` for CJS to add shebang.

## Testing Strategy

- **config-loader.test.ts** — loads fixture configs via jiti, verifies shape, tests error cases (missing file, bad syntax)
- **generate.test.ts** — loads valid config, runs manifest + hooks generators, asserts output file contents. Tests hooks skipping when react not installed.
- **validate.test.ts** — fixture configs with known issues: orphan states, invalid transitions, duplicate actions. Asserts correct error messages and exit behavior.
- **visualize.test.ts** — snapshot tests for ASCII and mermaid output from a known config
- Keys commands: thin wrappers, core already has coverage
