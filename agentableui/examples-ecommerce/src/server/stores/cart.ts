// src/server/stores/cart.ts

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  giftWrap: boolean
}

export class CartService {
  private carts: Map<string, CartItem[]> = new Map()
  private nextItemId = 1

  private getCart(sessionKey: string): CartItem[] {
    if (!this.carts.has(sessionKey)) {
      this.carts.set(sessionKey, [])
    }
    return this.carts.get(sessionKey)!
  }

  add(sessionKey: string, productId: string, name: string, price: number, quantity: number, giftWrap: boolean): CartItem {
    const cart = this.getCart(sessionKey)
    const existing = cart.find(item => item.productId === productId && item.giftWrap === giftWrap)
    if (existing) {
      existing.quantity += quantity
      return existing
    }
    const item: CartItem = {
      id: `item-${this.nextItemId++}`,
      productId,
      name,
      price,
      quantity,
      giftWrap,
    }
    cart.push(item)
    return item
  }

  remove(sessionKey: string, itemId: string): boolean {
    const cart = this.getCart(sessionKey)
    const index = cart.findIndex(item => item.id === itemId)
    if (index === -1) return false
    cart.splice(index, 1)
    return true
  }

  list(sessionKey: string): CartItem[] {
    return this.getCart(sessionKey)
  }

  isEmpty(sessionKey: string): boolean {
    return this.getCart(sessionKey).length === 0
  }

  total(sessionKey: string): number {
    return this.getCart(sessionKey).reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  clear(sessionKey: string): void {
    this.carts.set(sessionKey, [])
  }
}
