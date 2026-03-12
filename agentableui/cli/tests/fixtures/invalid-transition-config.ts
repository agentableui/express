// NOTE: We can't use defineAgentable() here because it already validates transitions.
// Instead we export the raw config shape for testing our validator independently.
export default {
  name: 'test-invalid',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',
  states: {
    home: {
      route: '/',
      description: 'Home',
      actions: {
        'go-nowhere': { transitions: 'nonexistent' },
        search: {
          params: { query: { type: 'string' as const, required: true } },
          transitions: 'results',
        },
      },
    },
    results: {
      route: '/results',
      description: 'Results',
      actions: {
        'go-home': { transitions: 'home' },
      },
    },
  },
  auth: { public: '*' as const },
  security: {
    requireApiKey: false,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' as const },
    publicActions: ['search', 'go-home', 'go-nowhere'],
    authenticatedActions: [],
  },
}
