import { Router, type Request } from 'express'
import type { AgentableConfig, ConditionsResponse } from '@agentableui/core'
import type { AuthVerifier } from '../pipeline/auth'

export function conditionsRoute<TContext>(
  config: AgentableConfig,
  conditions: Record<string, { description: string; check: (ctx: TContext) => Promise<boolean> | boolean }>,
  authVerifier: AuthVerifier,
  createContext: (req: Request) => TContext | Promise<TContext>
): Router {
  const router = Router()
  router.get('/agentable/conditions', async (req, res) => {
    // Auth check — conditions endpoint requires authentication
    if (config.security.requireApiKey) {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ status: 'unauthorized', message: 'API key required' })
        return
      }
      const keyInfo = await authVerifier.verify(authHeader.slice(7))
      if (!keyInfo) {
        res.status(401).json({ status: 'unauthorized', message: 'Invalid or revoked API key' })
        return
      }
    }

    try {
      const ctx = await createContext(req)
      const result: ConditionsResponse = { conditions: {} }
      for (const [name, condition] of Object.entries(conditions)) {
        const met = await condition.check(ctx)
        result.conditions[name] = { met, description: condition.description }
      }
      res.json(result)
    } catch {
      res.status(500).json({ error: 'Failed to check conditions' })
    }
  })
  return router
}
