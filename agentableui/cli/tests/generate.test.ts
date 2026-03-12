import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolve } from 'node:path'
import { mkdtemp, rm, readFile, readdir, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/config-loader'
import { generateManifests } from '../src/generators/manifests'
import { generateHooks } from '../src/generators/hooks'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentable-cli-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true })
})

describe('generateManifests', () => {
  it('generates one manifest per auth role + meta manifest', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')

    await generateManifests(config, outputDir)

    const files = await readdir(outputDir)
    expect(files).toContain('agentable.public.json')
    expect(files).toContain('agentable.user.json')
    expect(files).toContain('agentable.meta.json')
  })

  it('writes valid JSON manifests with correct role', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')

    await generateManifests(config, outputDir)

    const publicManifest = JSON.parse(
      await readFile(join(outputDir, 'agentable.public.json'), 'utf-8')
    )
    expect(publicManifest.role).toBe('public')
    expect(publicManifest.name).toBe('test-app')
    expect(publicManifest.version).toBe('1.0')
    expect(publicManifest.states.home).toBeDefined()
  })

  it('writes meta manifest with correct structure', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')

    await generateManifests(config, outputDir)

    const meta = JSON.parse(
      await readFile(join(outputDir, 'agentable.meta.json'), 'utf-8')
    )
    expect(meta.agentable).toBe('1.0')
    expect(meta.manifests.public).toBeDefined()
    expect(meta.manifests.user).toBeDefined()
    expect(meta.execute).toBe('/agentable/execute')
  })

  it('creates .gitignore with keys.json', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')

    await generateManifests(config, outputDir)

    const gitignore = await readFile(join(outputDir, '.gitignore'), 'utf-8')
    expect(gitignore).toContain('keys.json')
  })
})

describe('generateHooks', () => {
  it('generates hooks.ts with typed config', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')
    await mkdir(outputDir, { recursive: true })

    await generateHooks(config, outputDir)

    const hooks = await readFile(join(outputDir, 'hooks.ts'), 'utf-8')
    expect(hooks).toContain('AUTO-GENERATED')
    expect(hooks).toContain('createHooks')
    expect(hooks).toContain('@agentableui/react')
  })

  it('includes state names as type keys', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')
    await mkdir(outputDir, { recursive: true })

    await generateHooks(config, outputDir)

    const hooks = await readFile(join(outputDir, 'hooks.ts'), 'utf-8')
    expect(hooks).toContain('home')
    expect(hooks).toContain('results')
    expect(hooks).toContain('about')
  })

  it('includes param types for actions', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')
    await mkdir(outputDir, { recursive: true })

    await generateHooks(config, outputDir)

    const hooks = await readFile(join(outputDir, 'hooks.ts'), 'utf-8')
    expect(hooks).toContain('query: string')
    expect(hooks).toContain("transitions: 'results'")
  })

  it('marks optional params with ?', async () => {
    const config = await loadConfig(resolve(__dirname, 'fixtures/valid-config.ts'))
    const outputDir = join(tempDir, '.agentable')
    await mkdir(outputDir, { recursive: true })

    await generateHooks(config, outputDir)

    const hooks = await readFile(join(outputDir, 'hooks.ts'), 'utf-8')
    // query is required, should not have ?
    expect(hooks).not.toMatch(/query\?/)
  })
})
