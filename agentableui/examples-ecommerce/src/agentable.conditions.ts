import { defineConditions } from '@agentableui/core'
import type config from './agentable.config.js'
import type { AppContext } from './agentable.handlers.js'

export default defineConditions<typeof config, AppContext>({
  'cart-not-empty': {
    description: 'Cart must contain at least one item to proceed to checkout',
    check: (ctx) => !ctx.cart.isEmpty(ctx.sessionKey!),
  },
})
