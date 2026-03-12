import { defineHandlers, AgentableError } from '@agentableui/core'
import type config from './agentable.config.js'
import type { ProductStore } from './server/stores/products.js'
import type { CartService } from './server/stores/cart.js'
import type { OrderService } from './server/stores/orders.js'

export type AppContext = {
  products: ProductStore
  cart: CartService
  orders: OrderService
  sessionKey: string | null
}

export default defineHandlers<typeof config>()<AppContext>({
  // Fallback: search (shared across home + search-results)
  'search': async ({ query }, ctx) => {
    const results = ctx.products.search(query as string)
    return { results: results.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category })) }
  },

  // Fallback: view-product (shared across home + search-results)
  'view-product': async ({ productId }, ctx) => {
    const product = ctx.products.find(productId as string)
    if (!product) {
      throw new AgentableError('NOT_FOUND', `Product ${productId} not found`)
    }
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      inStock: product.stock > 0,
    }
  },

  // Scoped: product-page.add-to-cart
  'product-page.add-to-cart': async ({ productId, quantity, giftWrap }, ctx) => {
    const product = ctx.products.find(productId as string)
    if (!product) {
      throw new AgentableError('NOT_FOUND', `Product ${productId} not found`)
    }
    const qty = (quantity as number | undefined) ?? 1
    if (qty < 1 || !Number.isInteger(qty)) {
      throw new AgentableError('INVALID_QUANTITY', `Quantity must be a positive integer`)
    }
    if (product.stock < qty) {
      throw new AgentableError('OUT_OF_STOCK', `${product.name} only has ${product.stock} in stock`)
    }
    const wrap = (giftWrap as boolean | undefined) ?? false
    const item = ctx.cart.add(ctx.sessionKey!, product.id, product.name, product.price, qty, wrap)
    return { added: product.name, quantity: qty, giftWrap: wrap, cartItemId: item.id }
  },

  // Scoped: cart.remove-item
  'cart.remove-item': async ({ itemId }, ctx) => {
    const removed = ctx.cart.remove(ctx.sessionKey!, itemId as string)
    if (!removed) {
      throw new AgentableError('NOT_FOUND', `Cart item ${itemId} not found`)
    }
    return { removed: itemId, items: ctx.cart.list(ctx.sessionKey!) }
  },

  // Scoped: cart.checkout (has `available` condition so not a pure transition — needs explicit handler)
  'cart.checkout': async (_params, _ctx) => {
    return {}
  },

  // Scoped: checkout.submit-order
  'checkout.submit-order': async ({ shippingAddress, paymentMethod }, ctx) => {
    const address = shippingAddress as string
    if (address.trim().length < 10) {
      throw new AgentableError('INVALID_ADDRESS', 'Shipping address is too short')
    }

    // Simulate payment failure for 'crypto' 50% of the time (demo purposes)
    if (paymentMethod === 'crypto' && Math.random() < 0.5) {
      throw new AgentableError('PAYMENT_FAILED', 'Crypto payment failed — please try again')
    }

    const items = ctx.cart.list(ctx.sessionKey!)
    const total = ctx.cart.total(ctx.sessionKey!)
    const order = ctx.orders.create(items, total, address, paymentMethod as 'card' | 'paypal' | 'crypto', ctx.products)
    ctx.cart.clear(ctx.sessionKey!)
    return { orderId: order.id, total: order.total, items: order.items.length }
  },
})
