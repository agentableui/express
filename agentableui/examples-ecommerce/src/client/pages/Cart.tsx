import { Link } from 'react-router-dom'

export function Cart() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Your Cart</h2>
      <p style={{ color: '#666' }}>
        Cart operations are managed through the AgentableUI protocol.
        This page serves as a placeholder for the human-facing UI.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <Link
          to="/checkout"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#2563eb',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 4,
          }}
        >
          Proceed to Checkout
        </Link>
        <Link to="/" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none', color: '#2563eb' }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
