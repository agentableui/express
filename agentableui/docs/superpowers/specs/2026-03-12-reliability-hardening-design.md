# AgentableUI Reliability Hardening — Design Spec

## Overview

Full reliability pass across all 4 packages (core, express, sdk, cli). Fixes 14 identified issues: critical bugs, security holes, silent failures, and test gaps. Adds ~80+ tests. No new features, no API changes, no new dependencies.

## Scope

### In Scope
- Fix bugs that break correctness (NaN validation, hash determinism, entrypoint accessibility)
- Fix security holes (condition bypass, returnTo injection)
- Fix resource leaks (rate limiter memory)
- Add missing test coverage (SDK client at 0%, express edge cases)
- Add opt-in logging hooks (zero new deps)
- Harden error handling (corruption detection, fetch timeouts, return type validation)

### Out of Scope
- New features or public API changes
- Refactoring unrelated code
- New dependencies
- Performance optimization
- Documentation site

---

## Section 1: Core Package Fixes

### 1.1 NaN/Infinity Rejection in validateParams

**File:** `core/src/validation/params.ts`

**Bug:** `typeof NaN === 'number'` is true in JS, so NaN and Infinity pass number validation.

**Fix:** After the `typeof` check, add:
```typescript
if (typeof value === 'number' && !Number.isFinite(value)) {
  errors.push({ param: name, message: `Expected finite number, got ${value}` })
  continue
}
```

**Tests to add:**
- `validateParams` rejects `NaN`
- `validateParams` rejects `Infinity`
- `validateParams` rejects `-Infinity`
- `validateParams` still accepts `0`, negative numbers, floats

### 1.2 Deterministic Version Hash

**File:** `core/src/manifest/hash.ts`

**Bug:** `JSON.stringify` preserves insertion order, but manifests built with different property orders produce different hashes. Not a problem today (single code path builds manifests), but fragile.

**Note:** This changes the hash output. Any existing `.agentable/*.json` files will get new `versionHash` values on next `generate`. This invalidates existing ETag caches on first request post-deploy — acceptable since ETags are caches, not contracts. This is a correctness fix, not a breaking change.

**Fix:** Replace with sorted JSON serialization:
```typescript
function sortedStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(sortedStringify).join(',') + ']'
  const sorted = Object.keys(obj as Record<string, unknown>).sort()
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + sortedStringify((obj as Record<string, unknown>)[k])).join(',') + '}'
}

export function computeVersionHash(manifest: object): string {
  const content = sortedStringify(manifest)
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}
```

**Tests to add:**
- Same manifest with properties in different order produces same hash
- Hash changes when content changes
- Hash is deterministic across multiple calls

### 1.3 Entrypoint Accessibility Validation

**File:** `core/src/manifest/builder.ts`

**Bug:** `defineAgentable` validates that the entrypoint exists in `config.states`, but `buildManifest` doesn't check that the entrypoint is accessible for the specific role. If a role's allowed states (array form, not `'*'`) don't include the entrypoint, the manifest has `entrypoint: "home"` but no `states.home`. Agent starts at a nonexistent state. This only affects non-wildcard roles.

**Fix:** After computing `stateNames`, validate:
```typescript
if (!stateNames.has(config.entrypoint)) {
  throw new Error(`Entrypoint "${config.entrypoint}" is not accessible by role "${role}"`)
}
```

**Tests to add:**
- `buildManifest` throws when entrypoint not in role's state list
- `buildManifest` works when entrypoint is in role's state list (existing test, verify)

### 1.4 Keys Store Corruption Handling

**File:** `core/src/keys/store.ts`

**Bug:** Both "file not found" and "JSON parse error" are caught by the same `catch` block, returning `{ keys: [] }`. Corrupted files are silently treated as empty.

**Fix:** Separate the error cases:
```typescript
export async function loadKeys(storePath: string): Promise<KeyStore> {
  let content: string
  try {
    content = await readFile(storePath, 'utf-8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { keys: [] }
    throw err
  }
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`Corrupted keys file at ${storePath}: invalid JSON`)
  }
}
```

**Tests to add:**
- Returns empty on ENOENT (file not found) — verify existing behavior
- Throws descriptive error on malformed JSON
- Throws on other read errors (permissions)

### 1.5 Additional Core Edge Case Tests

New tests with no code changes:
- Enum param validation with non-string value
- `null` value for optional params (verify current behavior)
- Rate limit window format — document that no validation exists (defer fix to v2)
- `defineAgentable` with empty `states: {}`

---

## Section 2: Express Package Fixes

### 2.1 Condition Existence Check

**File:** `express/src/routes/execute.ts`

**Bug:** If `action.available` references a condition name not in the conditions object, `conditions[name]` is `undefined`, and the `if (condition)` check silently skips validation — allowing the action.

**Fix:**
```typescript
if (actionConfig.available) {
  const condition = conditions[actionConfig.available]
  if (!condition) {
    return res.status(500).json({
      error: `Configuration error: condition "${actionConfig.available}" referenced by action "${action}" is not defined`
    })
  }
  // ... existing condition check logic
}
```

**Tests to add:**
- Action with undefined condition returns 500 with clear message
- Action with defined condition still works (existing test)

### 2.2 RateLimiter Memory Cleanup

**File:** `express/src/pipeline/rate-limit.ts`

**Bug:** `buckets` Map grows unbounded — every unique API key adds an entry that's never removed.

**Fix:** Add periodic cleanup of stale buckets:
```typescript
class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private lastCleanup = Date.now()

  check(apiKey: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()

    // Cleanup stale buckets every window interval
    if (now - this.lastCleanup > this.windowMs) {
      for (const [key, bucket] of this.buckets) {
        if (now - bucket.windowStart > this.windowMs) {
          this.buckets.delete(key)
        }
      }
      this.lastCleanup = now
    }

    // ... existing check logic
  }
}
```

**Tests to add:**
- Stale buckets are cleaned up after window expires
- Active buckets are preserved during cleanup
- Memory doesn't grow with unique keys after cleanup runs

### 2.3 returnTo Validation

**File:** `express/src/routes/execute.ts`

**Bug:** `returnTo` from the request body is agent-supplied and used without validating it exists in the manifest states.

**Fix:** Immediately after `parseExecuteRequest` extracts `returnTo` (before auth check, before handler execution), validate:
```typescript
if (returnTo && !config.states[returnTo]) {
  return res.status(400).json({
    status: 'invalid',
    errors: [{ param: 'returnTo', message: `Unknown state "${returnTo}"` }]
  })
}
```

**Placement:** This MUST be before handler execution. The validation goes right after the `parsed` destructuring (after `parseExecuteRequest`) and before the auth/rate-limit checks.

**Tests to add:**
- Invalid returnTo returns 400
- Valid returnTo works (existing test)

### 2.4 Handler Return Type Validation

**File:** `express/src/routes/execute.ts`

**Bug:** If a handler returns `null`, a string, or a number instead of a Record, the response data is malformed.

**Fix:** After handler execution:
```typescript
const data = handler ? await handler(params, ctx) : {}
if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
  // good
} else {
  return res.status(500).json({ error: 'Handler must return an object' })
}
```

**Tests to add:**
- Handler returning `null` → 500
- Handler returning string → 500
- Handler returning array → 500
- Handler returning `{}` → works
- Handler returning object with data → works

### 2.5 Optional Logger

**File:** `express/src/middleware.ts` (options type), used in routes

**Design:** Add optional `logger` to `MiddlewareOptions`:
```typescript
export interface MiddlewareOptions<TContext> {
  createContext: (req: Request) => TContext | Promise<TContext>
  logger?: {
    error: (message: string, details?: Record<string, unknown>) => void
    warn: (message: string, details?: Record<string, unknown>) => void
    info: (message: string, details?: Record<string, unknown>) => void
  }
}
```

Log at these points:
- `error`: context creation failure, handler crash, condition check crash, configuration errors
- `warn`: rate limit hit, unauthorized access attempt
- `info`: (none in v1 — available for future use)

No-op when `logger` is not provided. Zero behavior change for existing users.

**Tests to add:**
- Logger.error called on handler crash
- Logger.warn called on rate limit
- Logger.warn called on unauthorized
- No crash when logger is not provided (existing behavior preserved)

### 2.6 Additional Express Edge Case Tests

New tests with no code changes:
- Malformed Bearer token (no space, extra spaces)
- Empty request body `{}`
- Request body as array `[]`
- Missing `action` field in execute request
- Missing `currentState` field in execute request
- Handler that throws a non-Error object
- Very long action/state names (no crash)

---

## Section 3: SDK Hardening

### 3.1 AgentableClient Test Suite

**File:** New `sdk/tests/client.test.ts`

Uses `vi.stubGlobal('fetch', ...)` to mock fetch. Tests all methods:

**discover() tests:**
- Fetches meta-manifest then role manifest
- Sets currentState to entrypoint
- Throws on network error
- Throws when role not found in meta-manifest (with available roles in message)
- Handles 304 Not Modified (ETag caching)
- Passes API key header when provided

**execute() tests:**
- Throws if called before discover()
- Sends correct POST body (action, params, currentState)
- Sends API key in Authorization header
- Updates currentState on `ok` response
- Updates currentState on `redirect` response + stores returnTo
- Does NOT update currentState on `error` response
- Does NOT update currentState on `unavailable` response
- Does NOT update currentState on `unauthorized` response
- Does NOT update currentState on `rate-limited` response
- Handles network error gracefully (currentState unchanged)

**checkConditions() tests:**
- Throws if called before discover()
- Returns parsed conditions response
- Sends API key header

**~20 tests total.**

### 3.2 Fetch Timeout

**File:** `sdk/src/discovery.ts` and `sdk/src/client.ts`

**Fix:** Add timeout option to client, pass through to all fetch calls:
```typescript
interface AgentableClientOptions {
  apiKey?: string
  role?: string
  timeout?: number  // ms, default 30000
}

// In fetch calls:
const res = await fetch(url, {
  ...opts,
  signal: AbortSignal.timeout(this.timeout),
})
```

**Tests to add:**
- Fetch timeout throws with clear message
- Custom timeout value is respected

### 3.3 State Validation on Response

**File:** `sdk/src/client.ts`

**Bug:** If `response.state` is not in the manifest, currentState silently doesn't update.

**Fix:** Inside the existing `if (response.status === 'ok' || response.status === 'redirect')` guard (which must be preserved — other status types like `error`, `unavailable` also carry a `state` field but should NOT trigger state updates), replace the silent skip:
```typescript
if (response.status === 'ok' || response.status === 'redirect') {
  // ... existing redirect handling ...
  const newState = this.manifest?.states[response.state]
  if (!newState) {
    throw new Error(`Server returned unknown state "${response.state}"`)
  }
  this.currentState = { name: response.state, actions: newState.actions }
}
// Other statuses (error, unavailable, etc.) — currentState unchanged, no validation needed
```

**Critical:** The outer `if (response.status === 'ok' || response.status === 'redirect')` guard MUST remain. The throw only fires for success/redirect responses with invalid states.

**Tests to add:**
- Throws on unknown response state (ok response)
- Does NOT throw for error responses with state field
- Works with valid response state (existing)

### 3.4 Better Discovery Error Messages

**File:** `sdk/src/client.ts`

**Fix:** When role not found:
```typescript
const manifestPath = meta.manifests[this.role]
if (!manifestPath) {
  const available = Object.keys(meta.manifests).join(', ')
  throw new Error(`Role "${this.role}" not found. Available roles: ${available}`)
}
```

**Tests:** Covered by client test suite above.

---

## Section 4: CLI Fixes

### 4.1 Redirect Target Validation

**File:** `cli/src/commands/validate.ts`

**Bug:** `validateConfig` checks `action.transitions` targets but not `action.redirects` targets. Additionally, `findReachableStates` walks redirect targets without checking they exist in `config.states` — a nonexistent redirect target gets added to `visited` and silently skipped (line 20: `if (!state) continue`), which suppresses orphan warnings on the path.

**Fix:** Two changes:

1. Add redirect validation in the transition check loop (in `validateConfig`):
2. Guard `findReachableStates` to only enqueue targets that exist in `config.states`:

Redirect validation:
```typescript
if (action.redirects) {
  for (const [reason, target] of Object.entries(action.redirects)) {
    if (!stateNames.has(target)) {
      errors.push(
        `error: state "${stateName}" action "${actionName}" redirects "${reason}" to unknown state "${target}"`
      )
    }
  }
}
```

Also guard `findReachableStates`:
```typescript
if (action.redirects) {
  for (const target of Object.values(action.redirects)) {
    if (config.states[target] && !visited.has(target)) queue.push(target)
  }
}
```

**Tests to add:**
- Config with invalid redirect target produces error
- Config with valid redirect targets passes
- Nonexistent redirect target doesn't suppress orphan detection on its path

### 4.2 Mermaid Escaping

**File:** `cli/src/commands/visualize.ts`

**Bug:** `mermaidSafe()` only replaces hyphens. Dots, spaces, and other chars break Mermaid syntax.

**Fix:**
```typescript
function mermaidSafe(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_')
}
```

**Note:** `mermaidSafe()` is only applied to state identifiers (the `from` and `to` positions). Action names appear after `:` as text labels and do not require identifier escaping — hyphens and spaces are valid in Mermaid labels.

**Tests to add:**
- State name with dots is escaped
- State name with spaces is escaped
- State name with only valid chars is unchanged

---

## Test Count Summary

| Package | New Tests | Existing | Total |
|---------|-----------|----------|-------|
| core | ~15 | 39 | ~54 |
| express | ~30 | 24 | ~54 |
| sdk | ~24 | 4 | ~28 |
| cli | ~6 | 26 | ~32 |
| **Total** | **~75** | **93** | **~168** |

## Files Changed Summary

| Package | Files Modified | Files Created |
|---------|---------------|---------------|
| core | 4 (params.ts, hash.ts, builder.ts, store.ts) | 0 |
| express | 3 (execute.ts, rate-limit.ts, middleware.ts) | 0 |
| sdk | 2 (client.ts, discovery.ts) | 1 (client.test.ts) |
| cli | 2 (validate.ts, visualize.ts) | 0 |
| **Total** | **11** | **1** |

## Non-Goals

- No breaking API changes — all fixes are backward compatible (hash change in 1.2 invalidates ETag caches once, which is expected)
- No new runtime dependencies
- Logger is opt-in — existing users see zero behavior change
- No performance work — correctness first
