import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface Product {
  id: string
  name: string
  price: number
  category: string
}

export function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          style={{ flex: 1, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer' }}>
          Search
        </button>
      </form>

      <h2 style={{ marginTop: 0 }}>Featured Products</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/products/${p.id}`}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '1rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem' }}>{p.name}</h3>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 'bold' }}>${p.price.toFixed(2)}</p>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>{p.category}</p>
          </Link>
        ))}
      </div>
      {products.length === 0 && <p style={{ color: '#999' }}>Loading products...</p>}
    </div>
  )
}
