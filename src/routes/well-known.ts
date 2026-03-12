import { Router } from 'express'
import type { ManifestCache } from '../cache'

export function wellKnownRoute(cache: ManifestCache): Router {
  const router = Router()
  router.get('/.well-known/agentable.json', (_req, res) => {
    res.type('application/json').send(cache.getMetaManifest())
  })
  return router
}
