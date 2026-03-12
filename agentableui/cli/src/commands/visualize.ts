import { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig } from '../config-loader'
import type { AgentableConfig } from '@agentableui/core'

function mermaidSafe(name: string): string {
  return name.replace(/-/g, '_')
}

export function renderAscii(config: AgentableConfig): string {
  const lines: string[] = []
  lines.push(`${config.name} (entrypoint: ${config.entrypoint})`)
  lines.push('')

  for (const [stateName, state] of Object.entries(config.states)) {
    lines.push(`  ${stateName} ${state.route}`)

    for (const [actionName, action] of Object.entries(state.actions)) {
      const parts: string[] = []

      if (action.transitions) {
        const self = action.transitions === stateName ? ' (self)' : ''
        parts.push(`──${actionName}──> ${action.transitions}${self}`)
      } else {
        parts.push(`──${actionName}──> (self)`)
      }

      if (config.security.authenticatedActions.includes(actionName)) {
        parts.push('[auth]')
      }

      lines.push(`    ${parts.join(' ')}`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

export function renderMermaid(config: AgentableConfig): string {
  const lines: string[] = []
  lines.push('stateDiagram-v2')
  lines.push(`    [*] --> ${mermaidSafe(config.entrypoint)}`)

  for (const [stateName, state] of Object.entries(config.states)) {
    for (const [actionName, action] of Object.entries(state.actions)) {
      const from = mermaidSafe(stateName)
      const to = action.transitions ? mermaidSafe(action.transitions) : from
      lines.push(`    ${from} --> ${to} : ${actionName}`)
    }
  }

  return lines.join('\n')
}

export const visualizeCommand = new Command('visualize')
  .description('Print the state machine graph')
  .option('--config <path>', 'Path to config file', 'agentable.config.ts')
  .option('--format <format>', 'Output format: ascii or mermaid', 'ascii')
  .action(async (opts) => {
    const configPath = resolve(process.cwd(), opts.config)

    try {
      const config = await loadConfig(configPath)

      if (opts.format === 'mermaid') {
        console.log(renderMermaid(config))
      } else {
        console.log(renderAscii(config))
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })
