import { Command } from 'commander'
import { writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const FILES: Record<string, string> = {
  'agentable.config.ts': `import { defineAgentable } from '@agentableui/core'

export default defineAgentable({
  name: 'my-app',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',

  states: {
    home: {
      route: '/',
      description: 'Landing page',
      actions: {
        'view-about': {
          description: 'Navigate to about page',
          transitions: 'about',
        },
        search: {
          description: 'Search for content',
          params: {
            query: { type: 'string', required: true, description: 'Search query' },
          },
          transitions: 'results',
        },
      },
    },
    results: {
      route: '/results',
      description: 'Search results page',
      actions: {
        'go-home': { transitions: 'home' },
      },
    },
    about: {
      route: '/about',
      description: 'About page',
      actions: {
        'go-home': { transitions: 'home' },
      },
    },
  },

  auth: {
    public: '*',
  },

  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['view-about', 'search', 'go-home'],
    authenticatedActions: [],
  },
})
`,

  'agentable.handlers.ts': `import { defineHandlers } from '@agentableui/core'
import type config from './agentable.config'

type AppContext = {
  // Add your app dependencies here (db, services, etc.)
}

export default defineHandlers<typeof config>()<AppContext>({
  'home.search': async ({ query }) => {
    // TODO: implement search logic
    return { results: [] }
  },

  // Pure transitions (view-about, go-home) are auto-handled — no handler needed.
})
`,

  'agentable.conditions.ts': `import { defineConditions } from '@agentableui/core'
import type config from './agentable.config'

type AppContext = {
  // Same as handlers AppContext
}

export default defineConditions<typeof config, AppContext>({
  // Define conditions here, e.g.:
  // 'cart-not-empty': {
  //   description: 'Cart must contain at least one item',
  //   check: async (ctx) => !ctx.cart.isEmpty,
  // },
})
`,

  'server.ts': `import express from 'express'
import { agentableMiddleware } from '@agentableui/express'
import config from './agentable.config'
import handlers from './agentable.handlers'
import conditions from './agentable.conditions'

const app = express()

app.use(agentableMiddleware(config, handlers, conditions, {
  createContext: (req) => ({
    // Build your AppContext from the request
  }),
}))

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  console.log(\`AgentableUI server running on http://localhost:\${port}\`)
  console.log(\`Discovery: http://localhost:\${port}/.well-known/agentable.json\`)
})
`,
}

export interface ScaffoldResult {
  created: string[]
  skipped: string[]
}

export async function scaffoldProject(dir: string): Promise<ScaffoldResult> {
  const created: string[] = []
  const skipped: string[] = []

  for (const [filename, content] of Object.entries(FILES)) {
    const filePath = join(dir, filename)
    try {
      await access(filePath)
      skipped.push(filename)
    } catch {
      await writeFile(filePath, content)
      created.push(filename)
    }
  }

  return { created, skipped }
}

export const initCommand = new Command('init')
  .description('Scaffold AgentableUI config, handlers, conditions, and server')
  .action(async () => {
    const result = await scaffoldProject(process.cwd())

    if (result.created.length > 0) {
      console.log('Created:')
      result.created.forEach(f => console.log(`  ${f}`))
    }
    if (result.skipped.length > 0) {
      console.log('Skipped (already exist):')
      result.skipped.forEach(f => console.log(`  ${f}`))
    }

    if (result.created.length > 0) {
      console.log('\nNext steps:')
      console.log('  1. Edit agentable.config.ts to define your state machine')
      console.log('  2. Run: npx agentableui generate')
      console.log('  3. Run: npx agentableui validate')
    }
  })
