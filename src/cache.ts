import { buildManifest, buildMetaManifest } from '@agentableui/core'
import type { AgentableConfig } from '@agentableui/core'

export class ManifestCache {
  private manifests = new Map<string, { json: string; hash: string }>()
  private metaJson: string

  constructor(config: AgentableConfig) {
    const meta = buildMetaManifest(config)
    this.metaJson = JSON.stringify(meta)

    for (const role of Object.keys(config.auth)) {
      const manifest = buildManifest(config, role)
      this.manifests.set(role, {
        json: JSON.stringify(manifest),
        hash: manifest.versionHash,
      })
    }
  }

  getMetaManifest(): string {
    return this.metaJson
  }

  getRoleManifest(role: string): { json: string; hash: string } | null {
    return this.manifests.get(role) ?? null
  }
}
