import { defineAgentable } from '@agentableui/core'

export default defineAgentable({
  name: 'test-app',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',
  states: {
    home: {
      route: '/',
      description: 'Home page',
      actions: {
        search: {
          params: { query: { type: 'string', required: true } },
          transitions: 'results',
        },
        'go-about': { transitions: 'about' },
      },
    },
    results: {
      route: '/results',
      description: 'Search results',
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
    public: ['home', 'results', 'about'],
    user: '*',
  },
  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['search', 'go-home', 'go-about'],
    authenticatedActions: [],
  },
})
