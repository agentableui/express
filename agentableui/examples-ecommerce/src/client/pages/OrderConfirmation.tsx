import { useParams, Link } from 'react-router-dom'

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()

  return (
    <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
      <h2 style={{ color: 'green' }}>Order Confirmed!</h2>
      <p style={{ fontSize: '1.125rem' }}>
        Your order <strong>{id}</strong> has been placed successfully.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: '#2563eb',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 4,
        }}
      >
        Back to Home
      </Link>
    </div>
  )
}
