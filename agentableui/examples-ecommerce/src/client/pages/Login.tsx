import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Login() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In practice, agents authenticate via the agentable protocol's execute endpoint.
    // This form is a placeholder for the human-facing login page.
    navigate('/')
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto' }}>
      <h2 style={{ marginTop: 0 }}>Login</h2>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Agents are redirected here when they attempt an authenticated action without a valid API key.
        Provide a token to authenticate.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            API Token
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="agui_k1_..."
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
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
          Authenticate
        </button>
      </form>
    </div>
  )
}
