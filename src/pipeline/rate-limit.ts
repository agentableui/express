import type { RateLimitConfig } from '@agentableui/core'

interface Bucket {
  tokens: number
  windowStart: number
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/)
  if (!match) throw new Error(`Invalid rate limit window: "${window}"`)
  const value = parseInt(match[1], 10)
  switch (match[2]) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    default: throw new Error(`Invalid rate limit window unit: "${match[2]}"`)
  }
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private maxTokens: number
  private windowMs: number

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.requests
    this.windowMs = parseWindow(config.window)
  }

  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      bucket = { tokens: this.maxTokens, windowStart: now }
      this.buckets.set(key, bucket)
    }

    if (bucket.tokens > 0) {
      bucket.tokens--
      return { allowed: true }
    }

    const retryAfter = Math.ceil((bucket.windowStart + this.windowMs - now) / 1000)
    return { allowed: false, retryAfter }
  }
}
