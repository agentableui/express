import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  category: string
}

export function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct)
      .catch(() => setProduct(null))
  }, [id])

  if (!product) return <p style={{ color: '#999' }}>Loading product...</p>

  return (
    <div>
      <Link to="/" style={{ color: '#666', fontSize: '0.875rem' }}>&larr; Back</Link>
      <h2 style={{ marginTop: '0.5rem' }}>{product.name}</h2>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>{product.category}</p>
      <p>{product.description}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${product.price.toFixed(2)}</p>
      <p style={{ color: product.stock > 0 ? 'green' : 'red' }}>
        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
      </p>
      <button
        onClick={() => navigate('/cart')}
        disabled={product.stock === 0}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
          background: product.stock > 0 ? '#2563eb' : '#ccc',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
        }}
      >
        Add to Cart
      </button>
    </div>
  )
}
