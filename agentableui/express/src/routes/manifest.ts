import { Router } from 'express'
import type { ManifestCache } from '../cache'

export function manifestRoute(cache: ManifestCache): Router {
  const router = Router()
  router.get('/agentable/manifest/:role', (req, res) => {
    const entry = cache.getRoleManifest(req.params.role)
    if (!entry) {
      res.status(404).json({ error: `Unknown role: "${req.params.role}"` })
      return
    }
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch === entry.hash) {
      res.status(304).end()
      return
    }
    res.set('ETag', entry.hash).type('application/json').send(entry.json)
  })
  return router
}
