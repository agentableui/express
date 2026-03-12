# @agentableui/cli — Design Spec

## Overview

CLI tool for AgentableUI that reads `agentable.config.ts` and generates static manifests, typed React hooks, and provides validation/visualization of the state machine. Also manages API keys.

## Commands

### `init`

Scaffolds starter files into the current directory:
- `agentable.config.ts` — minimal example (2 states, 2 actions)
- `agentable.handlers.ts` — matching handler stubs
- `agentable.conditions.ts` — empty conditions
- Skips existing files with a warning

### `generate`

Reads `agentable.config.ts` via jiti, outputs to `.agentable/`:
- `agentable.<role>.json` — one manifest per auth role (via core's `buildManifest()`)
- `agentable.meta.json` — meta-manifest (via core's `buildMetaManifest()`)
- `hooks.ts` — typed React hooks derived from config (see Generated Hooks section)
- `--watch` flag: chokidar watches config/handlers/conditions files, re-generates on change

### `validate`

Static analysis of config + handlers + conditions:
- Orphan states (unreachable from entrypoint)
- Invalid transitions (referencing non-existent states)
- Missing handlers (non-pure-transition actions without a handler)
- Undefined conditions (actions referencing conditions not in conditions file)
- Exit code 1 on errors, 0 on success

### `visualize`

Prints the state machine graph.
- Default: ASCII (`home ──search──> results`)
- `--format mermaid`: outputs `stateDiagram-v2` syntax
- Self-transitions shown as loops

### `keys generate --name <name> [--role <role>]`

Creates an API key via core's `generateKey()`. Prints the full key (only shown once). Defaults to `.agentable/keys.json`.

### `keys list`

Lists keys in table format via core's `listKeys()`.

### `keys revoke <prefix>`

Revokes a key by prefix via core's `revokeKey()`.

## Architecture

```
cli/
├── src/
│   ├── index.ts              # commander program, register commands
│   ├── config-loader.ts      # jiti-based TS config loader
│   ├── commands/
│   │   ├── init.ts           # scaffold project files
│   │   ├── generate.ts       # build manifests + hooks
│   │   ├── validate.ts       # state machine integrity checks
│   │   ├── visualize.ts      # ASCII + mermaid output
│   │   └── keys.ts           # generate/list/revoke subcommands
│   └── generators/
│       ├── manifests.ts      # write .agentable/*.json
│       └── hooks.ts          # write .agentable/hooks.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Config Loading

Uses `jiti` to import `agentable.config.ts` at runtime. Resolves from cwd by default, `--config <path>` flag to override. The loaded module's default export is expected to be the return value of `defineAgentable()`.

For `validate`, also loads `agentable.handlers.ts` and `agentable.conditions.ts` to cross-check handler/condition coverage.

## Generated Hooks

The `generate` command produces `.agentable/hooks.ts`:

```typescript
// .agentable/hooks.ts — AUTO-GENERATED, DO NOT EDIT
import { createHooks } from '@agentableui/react'

export type AppConfig = {
  states: {
    home: { actions: 'search' | 'view-product' }
    'search-results': { actions: 'view-product' | 'search' | 'go-home' }
    'product-page': { actions: 'add-to-cart' | 'go-back' }
    cart: { actions: 'checkout' | 'remove-item' | 'continue-shopping' }
  }
}

export const {
  AgentableProvider,
  useAgentableState,
  useAgentableAction,
  useAgentableConditions,
} = createHooks<AppConfig>()
```

The React package provides `createHooks<T>()` as a generic factory. The CLI generates the typed invocation. Consumers import from `.agentable/hooks` for full autocomplete.

## Dependencies

- `@agentableui/core` — workspace link (buildManifest, buildMetaManifest, generateKey, listKeys, revokeKey, validateParams)
- `commander` — CLI framework
- `jiti` — TS config loading
- `chokidar` — file watching (for `--watch`)
- `chalk` — terminal colors (optional, for visualize/validate output)

Dev dependencies follow the same pattern as other packages: tsup, vitest, typescript, eslint.

## Package Setup

Follows existing conventions:
- `package.json` with `"bin": { "agentableui": "./dist/index.cjs" }`
- tsup builds to dist/ (CJS + ESM + DTS)
- Shebang `#!/usr/bin/env node` in entry
- `"type": "module"` with CJS dist for bin compatibility

## Testing

- Unit tests for each command module using vitest
- Config loader tests with fixture configs
- Validate tests with known-bad configs (orphan states, invalid transitions, etc.)
- Generate tests that assert output file contents
- Visualize tests that snapshot ASCII/mermaid output
- Keys tests thin (core already tested)
