import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { loadKeys } from '@agentableui/core'
import type { StoredKey } from '@agentableui/core'

export class AuthVerifier {
  private keysPath: string
  private cachedKeys: StoredKey[] = []
  private lastMtime = 0

  constructor(keysPath: string) {
    this.keysPath = keysPath
  }

  async verify(apiKey: string): Promise<{ name: string; role: string } | null> {
    await this.reloadIfChanged()
    const hash = createHash('sha256').update(apiKey).digest('hex')
    const stored = this.cachedKeys.find(k => k.hash === hash)
    if (!stored || stored.revokedAt) return null
    return { name: stored.name, role: stored.role }
  }

  private async reloadIfChanged(): Promise<void> {
    try {
      const s = await stat(this.keysPath)
      const mtime = s.mtimeMs
      if (mtime !== this.lastMtime) {
        const store = await loadKeys(this.keysPath)
        this.cachedKeys = store.keys
        this.lastMtime = mtime
      }
    } catch {
      this.cachedKeys = []
    }
  }
}
