import { Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home.js'
import { SearchResults } from './pages/SearchResults.js'
import { ProductPage } from './pages/ProductPage.js'
import { Cart } from './pages/Cart.js'
import { Checkout } from './pages/Checkout.js'
import { OrderConfirmation } from './pages/OrderConfirmation.js'
import { Login } from './pages/Login.js'

export function App() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #ddd', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1 style={{ margin: 0 }}>AgentableUI Example Store</h1>
        </Link>
        <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.875rem' }}>
          A demo e-commerce store powered by AgentableUI
        </p>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:id" element={<OrderConfirmation />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  )
}
