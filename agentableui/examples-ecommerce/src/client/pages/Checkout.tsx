import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Checkout() {
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState<'card' | 'paypal' | 'crypto'>('card')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app this would go through the agentable protocol.
    // For the demo UI we just navigate to a confirmation page.
    const orderId = `ORD-${Date.now()}`
    navigate(`/order/${orderId}`)
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Checkout</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Shipping Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            rows={3}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Payment Method
          </label>
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as 'card' | 'paypal' | 'crypto')}
            style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="card">Credit Card</option>
            <option value="paypal">PayPal</option>
            <option value="crypto">Crypto</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Submit Order
          </button>
          <Link to="/cart" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none', color: '#2563eb' }}>
            Back to Cart
          </Link>
        </div>
      </form>
    </div>
  )
}
