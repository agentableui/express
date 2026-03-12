import { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig, loadHandlers, loadConditions } from '../config-loader'
import type { AgentableConfig } from '@agentableui/core'

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

function findReachableStates(config: AgentableConfig): Set<string> {
  const visited = new Set<string>()
  const queue = [config.entrypoint]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const state = config.states[current]
    if (!state) continue

    for (const action of Object.values(state.actions)) {
      if (action.transitions && !visited.has(action.transitions)) {
        queue.push(action.transitions)
      }
      if (action.redirects) {
        for (const target of Object.values(action.redirects)) {
          if (!visited.has(target)) queue.push(target)
        }
      }
    }
  }

  return visited
}

export function validateConfig(config: AgentableConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const stateNames = new Set(Object.keys(config.states))

  // Check invalid transitions
  for (const [stateName, state] of Object.entries(config.states)) {
    for (const [actionName, action] of Object.entries(state.actions)) {
      if (action.transitions && !stateNames.has(action.transitions)) {
        errors.push(
          `error: state "${stateName}" action "${actionName}" transitions to unknown state "${action.transitions}"`
        )
      }
    }
  }

  // Check orphan states (unreachable from entrypoint)
  const reachable = findReachableStates(config)
  for (const stateName of stateNames) {
    if (!reachable.has(stateName)) {
      errors.push(`error: state "${stateName}" is orphan (unreachable from entrypoint "${config.entrypoint}")`)
    }
  }

  // Check empty states
  for (const [stateName, state] of Object.entries(config.states)) {
    if (Object.keys(state.actions).length === 0) {
      warnings.push(`warn: state "${stateName}" has no actions`)
    }
  }

  return { errors, warnings }
}

export interface FullValidationResult extends ValidationResult {
  handlerErrors: string[]
  handlerWarnings: string[]
}

function isPureTransition(action: { params?: unknown; errors?: unknown; redirects?: unknown; available?: unknown; returnToPrevious?: unknown; transitions?: unknown }): boolean {
  return !!action.transitions && !action.params && !action.errors && !action.redirects && !action.available && !action.returnToPrevious
}

export function validateFull(
  config: AgentableConfig,
  handlerKeys: string[],
  conditionKeys: string[],
): FullValidationResult {
  const base = validateConfig(config)
  const handlerErrors: string[] = []
  const handlerWarnings: string[] = []
  const handlerKeySet = new Set(handlerKeys)
  const conditionKeySet = new Set(conditionKeys)
  const usedHandlerKeys = new Set<string>()
  const usedConditionKeys = new Set<string>()

  for (const [stateName, state] of Object.entries(config.states)) {
    for (const [actionName, action] of Object.entries(state.actions)) {
      // Check handler exists for non-pure-transition actions
      if (!isPureTransition(action)) {
        const scopedKey = `${stateName}.${actionName}`
        if (handlerKeySet.has(scopedKey)) {
          usedHandlerKeys.add(scopedKey)
        } else if (handlerKeySet.has(actionName)) {
          usedHandlerKeys.add(actionName)
        } else {
          handlerErrors.push(
            `error: no handler for action "${actionName}" in state "${stateName}" (expected "${scopedKey}" or "${actionName}")`
          )
        }
      }

      // Check condition exists
      if (action.available) {
        usedConditionKeys.add(action.available)
        if (!conditionKeySet.has(action.available)) {
          handlerErrors.push(
            `error: action "${actionName}" in state "${stateName}" references undefined condition "${action.available}"`
          )
        }
      }
    }
  }

  // Check unused handlers
  for (const key of handlerKeys) {
    if (!usedHandlerKeys.has(key)) {
      handlerWarnings.push(`warn: handler "${key}" is defined but never matched`)
    }
  }

  // Check unused conditions
  for (const key of conditionKeys) {
    if (!usedConditionKeys.has(key)) {
      handlerWarnings.push(`warn: condition "${key}" is defined but never referenced`)
    }
  }

  return {
    errors: [...base.errors, ...handlerErrors],
    warnings: [...base.warnings, ...handlerWarnings],
    handlerErrors,
    handlerWarnings,
  }
}

export const validateCommand = new Command('validate')
  .description('Validate agentable config for errors')
  .option('--config <path>', 'Path to config file', 'agentable.config.ts')
  .option('--full', 'Also validate handlers and conditions (requires loading them)')
  .action(async (opts) => {
    const configPath = resolve(process.cwd(), opts.config)

    try {
      const config = await loadConfig(configPath)

      if (opts.full) {
        const handlers = await loadHandlers(resolve(process.cwd(), 'agentable.handlers.ts'))
        const conditions = await loadConditions(resolve(process.cwd(), 'agentable.conditions.ts'))
        const result = validateFull(config, Object.keys(handlers), Object.keys(conditions))
        result.errors.forEach(e => console.log(e))
        result.warnings.forEach(w => console.log(w))

        if (result.errors.length > 0) {
          console.log(`\n${result.errors.length} error(s), ${result.warnings.length} warning(s)`)
          process.exit(1)
        }
        console.log(`\nValid. ${result.warnings.length} warning(s)`)
      } else {
        const result = validateConfig(config)
        result.errors.forEach(e => console.log(e))
        result.warnings.forEach(w => console.log(w))

        if (result.errors.length > 0) {
          console.log(`\n${result.errors.length} error(s), ${result.warnings.length} warning(s)`)
          process.exit(1)
        }
        console.log(`\nValid. ${result.warnings.length} warning(s)`)
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })
