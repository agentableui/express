// src/server/stores/products.ts

export interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  category: string
  imageUrl: string
}

const seedProducts: Product[] = [
  { id: 'shoe-001', name: 'Red Running Shoes', description: 'Lightweight running shoes in bold red', price: 89.99, stock: 15, category: 'shoes', imageUrl: '/images/red-shoes.jpg' },
  { id: 'shoe-002', name: 'Blue Trail Sneakers', description: 'Durable sneakers for trail running', price: 109.99, stock: 8, category: 'shoes', imageUrl: '/images/blue-sneakers.jpg' },
  { id: 'shirt-001', name: 'Cotton Crew T-Shirt', description: 'Classic cotton t-shirt in white', price: 24.99, stock: 50, category: 'shirts', imageUrl: '/images/white-tshirt.jpg' },
  { id: 'shirt-002', name: 'Slim Fit Oxford Shirt', description: 'Formal oxford shirt in light blue', price: 59.99, stock: 20, category: 'shirts', imageUrl: '/images/oxford-shirt.jpg' },
  { id: 'jacket-001', name: 'Waterproof Rain Jacket', description: 'Lightweight jacket for rainy days', price: 129.99, stock: 12, category: 'jackets', imageUrl: '/images/rain-jacket.jpg' },
  { id: 'jacket-002', name: 'Fleece Zip-Up', description: 'Warm fleece jacket with full zip', price: 74.99, stock: 25, category: 'jackets', imageUrl: '/images/fleece-jacket.jpg' },
  { id: 'pants-001', name: 'Slim Chino Pants', description: 'Tailored chino pants in khaki', price: 49.99, stock: 30, category: 'pants', imageUrl: '/images/chino-pants.jpg' },
  { id: 'pants-002', name: 'Stretch Denim Jeans', description: 'Comfortable stretch jeans in dark wash', price: 69.99, stock: 0, category: 'pants', imageUrl: '/images/denim-jeans.jpg' },
  { id: 'acc-001', name: 'Leather Belt', description: 'Genuine leather belt with brass buckle', price: 34.99, stock: 40, category: 'accessories', imageUrl: '/images/leather-belt.jpg' },
  { id: 'acc-002', name: 'Wool Beanie', description: 'Warm wool beanie in charcoal grey', price: 19.99, stock: 60, category: 'accessories', imageUrl: '/images/wool-beanie.jpg' },
]

export class ProductStore {
  private products: Map<string, Product>

  constructor() {
    this.products = new Map(seedProducts.map(p => [p.id, { ...p }]))
  }

  list(): Product[] {
    return Array.from(this.products.values())
  }

  find(id: string): Product | undefined {
    return this.products.get(id)
  }

  search(query: string): Product[] {
    const q = query.toLowerCase()
    return this.list().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }

  decrementStock(id: string, quantity: number): boolean {
    const product = this.products.get(id)
    if (!product || product.stock < quantity) return false
    product.stock -= quantity
    return true
  }
}
