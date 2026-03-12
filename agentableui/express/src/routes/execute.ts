import { Router, type Request } from 'express'
import {
  resolveHandler, validateParams,
  AgentableError, AgentableRedirect,
} from '@agentableui/core'
import type { AgentableConfig, HandlerFn, ConditionDef } from '@agentableui/core'
import type { AuthVerifier } from '../pipeline/auth'
import type { RateLimiter } from '../pipeline/rate-limit'
import { parseExecuteRequest, validateAction } from '../pipeline/validate'
import type { Logger } from '../middleware'

export function executeRoute<TContext>(
  config: AgentableConfig,
  handlers: Record<string, HandlerFn<TContext>>,
  conditions: Record<string, ConditionDef<TContext>>,
  authVerifier: AuthVerifier,
  rateLimiter: RateLimiter,
  createContext: (req: Request) => TContext | Promise<TContext>,
  logger?: Logger
): Router {
  const router = Router()

  router.post('/agentable/execute', async (req, res) => {
    // Step 1: Parse request
    const parsed = parseExecuteRequest(req.body)
    if (Array.isArray(parsed)) {
      res.status(400).json({ status: 'invalid', errors: parsed })
      return
    }
    const { action, params, currentState, returnTo } = parsed

    // Validate returnTo
    if (returnTo && !config.states[returnTo]) {
      res.status(400).json({
        status: 'invalid',
        errors: [{ param: 'returnTo', message: `Unknown state "${returnTo}"` }],
      })
      return
    }

    // Steps 2-3: Validate state and action
    const actionErrors = validateAction(config, currentState, action)
    if (actionErrors.length) {
      res.status(400).json({ status: 'invalid', errors: actionErrors })
      return
    }

    const actionConfig = config.states[currentState].actions[action]

    // Step 4: Validate params
    const paramErrors = validateParams(actionConfig, params)
    if (paramErrors.length) {
      res.status(400).json({ status: 'invalid', errors: paramErrors })
      return
    }

    // Step 5: Auth check
    const isAuthenticated = config.security.authenticatedActions.includes(action)
    const requiresKey = config.security.requireApiKey || isAuthenticated
    let apiKey: string | undefined

    if (requiresKey) {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        logger?.warn('Unauthorized access attempt', { action })
        res.status(401).json({
          status: 'unauthorized',
          message: isAuthenticated
            ? `API key required for action ${action}`
            : 'API key required',
        })
        return
      }
      apiKey = authHeader.slice(7)
      const keyInfo = await authVerifier.verify(apiKey)
      if (!keyInfo) {
        res.status(401).json({ status: 'unauthorized', message: 'Invalid or revoked API key' })
        return
      }
    }

    // Step 6: Rate limit
    if (apiKey) {
      const rateResult = rateLimiter.check(apiKey)
      if (!rateResult.allowed) {
        logger?.warn('Rate limit exceeded', { apiKey: apiKey?.slice(0, 12) })
        res.status(429).json({ status: 'rate-limited', retryAfter: rateResult.retryAfter })
        return
      }
    }

    // Create context once
    let ctx: TContext
    try {
      ctx = await createContext(req)
    } catch (err) {
      logger?.error('Context creation failed', { error: (err as Error).message })
      res.status(500).json({ error: 'Failed to create context' })
      return
    }

    // Step 7: Conditions
    if (actionConfig.available) {
      const condition = conditions[actionConfig.available]
      if (!condition) {
        res.status(500).json({
          error: `Configuration error: condition "${actionConfig.available}" referenced by action "${action}" is not defined`,
        })
        return
      }
      try {
        const met = await condition.check(ctx)
        if (!met) {
          res.status(409).json({
            status: 'unavailable',
            state: currentState,
            condition: actionConfig.available,
            message: condition.description,
          })
          return
        }
      } catch {
        logger?.error('Condition check failed', { condition: actionConfig.available })
        res.status(500).json({ error: 'Condition check failed' })
        return
      }
    }

    // Step 8: Resolve handler
    let handler: HandlerFn<TContext> | null
    try {
      handler = resolveHandler(currentState, action, handlers, actionConfig)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
      return
    }

    // Step 9: Run handler
    try {
      const data = handler ? await handler(params, ctx) : {}

      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        res.status(500).json({ error: 'Handler must return an object' })
        return
      }

      // Step 10: Determine response state
      let responseState: string
      if (actionConfig.returnToPrevious && returnTo) {
        responseState = returnTo
      } else {
        responseState = actionConfig.transitions ?? currentState
      }

      // Step 11: Return success
      res.json({ status: 'ok', state: responseState, data })
    } catch (err) {
      if (err instanceof AgentableError) {
        res.status(422).json({
          status: 'error',
          state: currentState,
          error: { code: err.code, message: err.message },
        })
      } else if (err instanceof AgentableRedirect) {
        const redirectTarget = actionConfig.redirects?.[err.reason]
        if (!redirectTarget) {
          res.status(500).json({ error: `No redirect target for reason: "${err.reason}"` })
          return
        }
        res.json({
          status: 'redirect',
          state: redirectTarget,
          reason: err.reason,
          returnTo: currentState,
        })
      } else {
        logger?.error('Handler crashed', { action, error: err instanceof Error ? err.message : String(err) })
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  })

  return router
}
