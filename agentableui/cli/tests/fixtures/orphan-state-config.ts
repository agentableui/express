import { defineAgentable } from '@agentableui/core'

export default defineAgentable({
  name: 'test-orphan',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',
  states: {
    home: {
      route: '/',
      description: 'Home',
      actions: {
        'go-about': { transitions: 'about' },
      },
    },
    about: {
      route: '/about',
      description: 'About',
      actions: {
        'go-home': { transitions: 'home' },
      },
    },
    orphan: {
      route: '/orphan',
      description: 'Unreachable state',
      actions: {
        'go-home': { transitions: 'home' },
      },
    },
  },
  auth: { public: '*' },
  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['go-home', 'go-about'],
    authenticatedActions: [],
  },
})
