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

  it('cleans up stale buckets after window expires', () => {
    vi.useFakeTimers()
    limiter.check('stale-key')
    expect(limiter.bucketCount).toBe(1)
    vi.advanceTimersByTime(60_001) // past window
    limiter.check('new-key') // triggers cleanup
    expect(limiter.bucketCount).toBe(1) // only new-key remains
    vi.useRealTimers()
  })

  it('preserves active buckets during cleanup', () => {
    vi.useFakeTimers()
    limiter.check('key1')
    vi.advanceTimersByTime(30_000) // half window
    limiter.check('key2')
    vi.advanceTimersByTime(31_000) // key1 expired, key2 still active
    limiter.check('key3') // triggers cleanup
    expect(limiter.bucketCount).toBe(2) // key2 and key3
    vi.useRealTimers()
  })

  it('does not grow unbounded with unique keys', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 100; i++) {
      limiter.check(`key-${i}`)
    }
    expect(limiter.bucketCount).toBe(100)
    vi.advanceTimersByTime(60_001)
    limiter.check('trigger-cleanup')
    expect(limiter.bucketCount).toBe(1) // only trigger-cleanup
    vi.useRealTimers()
  })
})
