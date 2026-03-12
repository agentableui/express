import { createJiti } from 'jiti'
import { resolve } from 'node:path'
import type { AgentableConfig } from '@agentableui/core'

export async function loadConfig(configPath: string): Promise<AgentableConfig> {
  const jiti = createJiti(process.cwd())
  const absolutePath = resolve(configPath)
  const mod = await jiti.import(absolutePath) as { default?: AgentableConfig }
  const config = mod.default ?? mod
  return config as AgentableConfig
}

export async function loadHandlers(handlersPath: string): Promise<Record<string, unknown>> {
  const jiti = createJiti(process.cwd())
  const absolutePath = resolve(handlersPath)
  const mod = await jiti.import(absolutePath) as { default?: Record<string, unknown> }
  return (mod.default ?? mod) as Record<string, unknown>
}

export async function loadConditions(conditionsPath: string): Promise<Record<string, unknown>> {
  const jiti = createJiti(process.cwd())
  const absolutePath = resolve(conditionsPath)
  const mod = await jiti.import(absolutePath) as { default?: Record<string, unknown> }
  return (mod.default ?? mod) as Record<string, unknown>
}
