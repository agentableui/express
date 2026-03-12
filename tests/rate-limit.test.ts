import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RateLimiter } from '../src/pipeline/rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ requests: 3, window: '1m', scope: 'per-key' })
  })

  it('allows requests within limit', () => {
    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(true)
  })

  it('blocks after limit exceeded', () => {
    limiter.check('key1')
    limiter.check('key1')
    limiter.check('key1')
    const result = limiter.check('key1')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    limiter.check('key1')
    limiter.check('key1')
    limiter.check('key1')
    expect(limiter.check('key1').allowed).toBe(false)
    expect(limiter.check('key2').allowed).toBe(true)
  })

  it('parses window string correctly', () => {
    const secLimiter = new RateLimiter({ requests: 1, window: '30s', scope: 'per-key' })
    secLimiter.check('k')
    const result = secLimiter.check('k')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeLessThanOrEqual(30)
  })

  it('resets after window expires', () => {
    vi.useFakeTimers()
    limiter.check('key1')
    limiter.check('key1')
    limiter.check('key1')
    expect(limiter.check('key1').allowed).toBe(false)
    vi.advanceTimersByTime(60_001)
    expect(limiter.check('key1').allowed).toBe(true)
    vi.useRealTimers()
  })
})
