import { Router, json, type Request } from 'express'
import type { AgentableConfig, HandlerFn, ConditionDef } from '@agentableui/core'
import { ManifestCache } from './cache'
import { AuthVerifier } from './pipeline/auth'
import { RateLimiter } from './pipeline/rate-limit'
import { wellKnownRoute } from './routes/well-known'
import { manifestRoute } from './routes/manifest'
import { conditionsRoute } from './routes/conditions'
import { executeRoute } from './routes/execute'

export interface MiddlewareOptions<TContext> {
  createContext: (req: Request) => TContext | Promise<TContext>
  keysPath?: string
}

export function agentableMiddleware<TContext>(
  config: AgentableConfig,
  handlers: Record<string, HandlerFn<TContext>>,
  conditions: Record<string, ConditionDef<TContext>>,
  options: MiddlewareOptions<TContext>
): Router {
  const cache = new ManifestCache(config)
  const authVerifier = new AuthVerifier(options.keysPath ?? '.agentable/keys.json')
  const rateLimiter = new RateLimiter(config.security.rateLimit)

  const router = Router()
  router.use(json())
  router.use(wellKnownRoute(cache))
  router.use(manifestRoute(cache))
  router.use(conditionsRoute(config, conditions, authVerifier, options.createContext))
  router.use(executeRoute(config, handlers, conditions, authVerifier, rateLimiter, options.createContext))

  return router
}
