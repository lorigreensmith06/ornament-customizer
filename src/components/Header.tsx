import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

function SnowflakeMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      aria-hidden="true">
      <path d="M12 2v20M12 2l-2 3M12 2l2 3M12 22l-2-3M12 22l2-3" />
      <path d="M3.3 7l17.4 10M3.3 7l.9 3.5M3.3 7l3.5-.9M20.7 17l-.9-3.5M20.7 17l-3.5.9" />
      <path d="M20.7 7L3.3 17M20.7 7l-3.5-.9M20.7 7l-.9 3.5M3.3 17l3.5.9M3.3 17l.9-3.5" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

export default function Header({ cartCount, onCartOpen }: {
  cartCount: number
  onCartOpen: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navLinks = (
    <>
      <NavLink to="/" end onClick={() => setMenuOpen(false)}>
        Create
      </NavLink>
      <NavLink to="/explore" onClick={() => setMenuOpen(false)}>
        Explore
      </NavLink>
      <NavLink to="/orders" onClick={() => setMenuOpen(false)}>
        My Orders
      </NavLink>
    </>
  )
  return (
    <header className="site-header">
      <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark"><SnowflakeMark /></span>
        Ornament Creator
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        {navLinks}
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className="header-cart"
          aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          onClick={onCartOpen}
        >
          <CartIcon />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            aria-hidden="true">
            {menuOpen
              ? <path d="M6 6l12 12M18 6L6 18" />
              : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navLinks}
        </nav>
      )}
    </header>
  )
}
