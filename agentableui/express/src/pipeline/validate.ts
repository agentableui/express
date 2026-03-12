import type { AgentableConfig, ValidationError } from '@agentableui/core'

export interface ExecuteRequest {
  action: string
  params: Record<string, unknown>
  currentState: string
  returnTo?: string
}

export function parseExecuteRequest(body: unknown): ExecuteRequest | ValidationError[] {
  if (!body || typeof body !== 'object') {
    return [{ param: 'body', message: 'Request body must be a JSON object' }]
  }
  const b = body as Record<string, unknown>
  const errors: ValidationError[] = []

  if (typeof b.action !== 'string' || !b.action) {
    errors.push({ param: 'action', message: '"action" is required and must be a string' })
  }
  if (typeof b.currentState !== 'string' || !b.currentState) {
    errors.push({ param: 'currentState', message: '"currentState" is required and must be a string' })
  }
  if (errors.length) return errors

  return {
    action: b.action as string,
    params: (b.params as Record<string, unknown>) ?? {},
    currentState: b.currentState as string,
    returnTo: typeof b.returnTo === 'string' ? b.returnTo : undefined,
  }
}

export function validateAction(
  config: AgentableConfig,
  currentState: string,
  action: string
): ValidationError[] {
  const state = config.states[currentState]
  if (!state) {
    return [{ param: 'currentState', message: `Unknown state: "${currentState}"` }]
  }
  const actionConfig = state.actions[action]
  if (!actionConfig) {
    return [{ param: 'action', message: `Action "${action}" not available in state "${currentState}"` }]
  }
  return []
}
