import { defineAgentable } from '@agentableui/core'

export default defineAgentable({
  name: 'example-store',
  baseUrl: 'http://localhost:3000',
  entrypoint: 'home',

  states: {
    'home': {
      route: '/',
      description: 'Landing page with featured products and search',
      actions: {
        'search': {
          description: 'Search for products by keyword',
          params: { query: { type: 'string', required: true, description: 'Search query' } },
          transitions: 'search-results',
        },
        'view-product': {
          description: 'Navigate to a product detail page',
          params: { productId: { type: 'string', required: true, description: 'Product ID' } },
          transitions: 'product-page',
        },
      },
    },

    'search-results': {
      route: '/search',
      description: 'Search results listing matching products',
      actions: {
        'view-product': {
          description: 'View a product from search results',
          params: { productId: { type: 'string', required: true, description: 'Product ID' } },
          transitions: 'product-page',
        },
        'search': {
          description: 'Refine search with a new query',
          params: { query: { type: 'string', required: true, description: 'Search query' } },
          transitions: 'search-results',
        },
        'go-home': {
          description: 'Return to the home page',
          transitions: 'home',
        },
      },
    },

    'product-page': {
      route: '/products/:id',
      description: 'Product detail page with name, price, stock, and add-to-cart',
      actions: {
        'add-to-cart': {
          description: 'Add this product to your shopping cart',
          params: {
            productId: { type: 'string', required: true, description: 'Product ID' },
            quantity: { type: 'number', required: false, description: 'Quantity (default 1)' },
            giftWrap: { type: 'boolean', required: false, description: 'Gift wrap the item' },
          },
          transitions: 'cart',
          errors: ['OUT_OF_STOCK', 'INVALID_QUANTITY'],
          redirects: { 'auth-required': 'login' },
        },
        'go-back': {
          description: 'Go back to the home page',
          transitions: 'home',
        },
      },
    },

    'cart': {
      route: '/cart',
      description: 'Shopping cart with items, quantities, and totals',
      actions: {
        'checkout': {
          description: 'Proceed to checkout',
          transitions: 'checkout',
          available: 'cart-not-empty',
        },
        'remove-item': {
          description: 'Remove an item from the cart',
          params: { itemId: { type: 'string', required: true, description: 'Cart item ID' } },
        },
        'continue-shopping': {
          description: 'Return to the home page to browse more',
          transitions: 'home',
        },
      },
    },

    'checkout': {
      route: '/checkout',
      description: 'Checkout flow — enter shipping and payment details',
      actions: {
        'submit-order': {
          description: 'Submit the order with shipping and payment info',
          params: {
            shippingAddress: { type: 'string', required: true, description: 'Full shipping address' },
            paymentMethod: { type: 'enum', values: ['card', 'paypal', 'crypto'], required: true, description: 'Payment method' },
          },
          transitions: 'order-confirmation',
          errors: ['PAYMENT_FAILED', 'INVALID_ADDRESS'],
        },
        'back-to-cart': {
          description: 'Go back to cart to make changes',
          transitions: 'cart',
        },
      },
    },

    'order-confirmation': {
      route: '/order/:id',
      description: 'Order confirmation with order details and ID',
      actions: {
        'go-home': {
          description: 'Return to the home page',
          transitions: 'home',
        },
      },
    },

    'login': {
      route: '/login',
      description: 'Login page — agents are redirected here when auth is required',
      actions: {
        'authenticate': {
          description: 'Authenticate with an API token',
          params: { token: { type: 'string', required: true, description: 'API key or auth token' } },
          transitions: 'home',
          returnToPrevious: true,
        },
      },
    },
  },

  auth: {
    public: ['home', 'search-results', 'product-page', 'login'],
    user: ['home', 'search-results', 'product-page', 'cart', 'checkout', 'order-confirmation', 'login'],
  },

  security: {
    requireApiKey: true,
    rateLimit: { requests: 100, window: '1m', scope: 'per-key' },
    publicActions: ['search', 'view-product', 'go-home', 'go-back', 'continue-shopping'],
    authenticatedActions: ['add-to-cart', 'checkout', 'submit-order', 'remove-item'],
  },
})
