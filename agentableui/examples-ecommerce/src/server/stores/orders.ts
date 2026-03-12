// src/server/stores/orders.ts

import type { CartItem } from './cart.js'
import type { ProductStore } from './products.js'

export interface Order {
  id: string
  items: CartItem[]
  total: number
  shippingAddress: string
  paymentMethod: 'card' | 'paypal' | 'crypto'
  createdAt: string
}

export class OrderService {
  private orders: Map<string, Order> = new Map()
  private nextId = 1

  create(
    items: CartItem[],
    total: number,
    shippingAddress: string,
    paymentMethod: 'card' | 'paypal' | 'crypto',
    productStore: ProductStore
  ): Order {
    for (const item of items) {
      const success = productStore.decrementStock(item.productId, item.quantity)
      if (!success) {
        throw new Error(`Insufficient stock for ${item.name}`)
      }
    }

    const order: Order = {
      id: `order-${this.nextId++}`,
      items: [...items],
      total,
      shippingAddress,
      paymentMethod,
      createdAt: new Date().toISOString(),
    }
    this.orders.set(order.id, order)
    return order
  }

  find(id: string): Order | undefined {
    return this.orders.get(id)
  }
}
