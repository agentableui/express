import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildManifest, buildMetaManifest } from '@agentableui/core'
import type { AgentableConfig } from '@agentableui/core'

export async function generateManifests(config: AgentableConfig, outputDir: string): Promise<string[]> {
  await mkdir(outputDir, { recursive: true })

  const written: string[] = []

  // Generate one manifest per auth role
  for (const role of Object.keys(config.auth)) {
    const manifest = buildManifest(config, role)
    const filePath = join(outputDir, `agentable.${role}.json`)
    await writeFile(filePath, JSON.stringify(manifest, null, 2) + '\n')
    written.push(filePath)
  }

  // Generate meta manifest
  const meta = buildMetaManifest(config)
  const metaPath = join(outputDir, 'agentable.meta.json')
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n')
  written.push(metaPath)

  // Create .gitignore for keys.json
  const gitignorePath = join(outputDir, '.gitignore')
  await writeFile(gitignorePath, 'keys.json\n')

  return written
}
