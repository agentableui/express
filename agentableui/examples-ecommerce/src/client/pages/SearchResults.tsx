import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

interface Product {
  id: string
  name: string
  price: number
  category: string
}

export function SearchResults() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [results, setResults] = useState<Product[]>([])
  const [query, setQuery] = useState(q)
  const navigate = useNavigate()

  useEffect(() => {
    if (!q) return
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setResults)
      .catch(() => setResults([]))
  }, [q])

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

      <h2 style={{ marginTop: 0 }}>Results for "{q}"</h2>
      {results.length === 0 && q && <p style={{ color: '#999' }}>No products found.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((p) => (
          <li key={p.id} style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0' }}>
            <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <strong>{p.name}</strong> — ${p.price.toFixed(2)}{' '}
              <span style={{ color: '#666', fontSize: '0.875rem' }}>({p.category})</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/">Back to Home</Link>
    </div>
  )
}
