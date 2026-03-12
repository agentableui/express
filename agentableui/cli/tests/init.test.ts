import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffoldProject } from '../src/commands/init'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentable-init-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true })
})

describe('scaffoldProject', () => {
  it('creates all four files', async () => {
    const result = await scaffoldProject(tempDir)
    expect(result.created).toContain('agentable.config.ts')
    expect(result.created).toContain('agentable.handlers.ts')
    expect(result.created).toContain('agentable.conditions.ts')
    expect(result.created).toContain('server.ts')
  })

  it('generates valid config file', async () => {
    await scaffoldProject(tempDir)
    const content = await readFile(join(tempDir, 'agentable.config.ts'), 'utf-8')
    expect(content).toContain('defineAgentable')
    expect(content).toContain('entrypoint')
    expect(content).toContain('states')
  })

  it('generates handlers file', async () => {
    await scaffoldProject(tempDir)
    const content = await readFile(join(tempDir, 'agentable.handlers.ts'), 'utf-8')
    expect(content).toContain('defineHandlers')
  })

  it('generates conditions file', async () => {
    await scaffoldProject(tempDir)
    const content = await readFile(join(tempDir, 'agentable.conditions.ts'), 'utf-8')
    expect(content).toContain('defineConditions')
  })

  it('generates server file with middleware', async () => {
    await scaffoldProject(tempDir)
    const content = await readFile(join(tempDir, 'server.ts'), 'utf-8')
    expect(content).toContain('agentableMiddleware')
    expect(content).toContain('express')
  })

  it('skips existing files', async () => {
    await scaffoldProject(tempDir)
    const result = await scaffoldProject(tempDir)
    expect(result.created).toHaveLength(0)
    expect(result.skipped).toHaveLength(4)
  })
})
