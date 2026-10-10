import { useState } from 'react'

export type CartItem = {
  id: string
  jobId: string
  product: 'stl' | 'printed'
  name: string
  selectedModel: string
  showName: boolean
  selectedFont: string
  textSize: number
  downloadUrl: string
  previewUrl: string
  quantity: number
  addedAt: number
}

export const UNIT_PRICE: Record<CartItem['product'], number> = {
  stl: 3,
  printed: 15,
}

export default function CartPanel({ items, open, onClose, onQuantity, onRemove, onCheckout }: {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onCheckout: (items: CartItem[]) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = items.reduce(
    (sum, item) => sum + item.quantity * UNIT_PRICE[item.product], 0)

  function checkout() {
    setBusy(true)
    setError('')
    onCheckout(items)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }

  return (
    <>
      {open && <div className="cart-backdrop" onClick={onClose} />}
      <aside className={`cart-drawer${open ? ' open' : ''}`}
        aria-hidden={!open}>
        <div className="cart-drawer-header">
          <span>Your Cart ({items.length})</span>
          <button type="button" className="cart-remove" aria-label="Close cart"
            onClick={onClose}>
            ×
          </button>
        </div>
        {items.length === 0 ? (
          <p className="cart-empty">Your cart is empty.</p>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-info">
                    <span className="cart-item-name">
                      {item.showName && item.name ? `"${item.name}"` : 'Snowflake'}
                    </span>
                    <span className="cart-item-type">
                      {item.product === 'stl' ? 'Digital STL' : 'Printed Ornament'}
                      {item.product === 'printed' && ` · Qty ${item.quantity}`}
                    </span>
                  </div>
                  <span className="cart-item-price">
                    ${UNIT_PRICE[item.product] * item.quantity}
                  </span>
                  <div className="cart-item-controls">
                    {item.product === 'printed' && (
                      <span className="qty-stepper">
                        <button type="button" aria-label="Decrease quantity"
                          disabled={item.quantity <= 1}
                          onClick={() => onQuantity(item.id, item.quantity - 1)}>
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity"
                          disabled={item.quantity >= 50}
                          onClick={() => onQuantity(item.id, item.quantity + 1)}>
                          +
                        </button>
                      </span>
                    )}
                    <button type="button" className="cart-remove"
                      aria-label="Remove" onClick={() => onRemove(item.id)}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-drawer-footer">
              <div className="cart-total">Total: ${total}</div>
              <button type="button" className="buy-button" onClick={checkout}
                disabled={busy || !items.length}>
                {busy ? 'Redirecting…' : `Checkout — $${total.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
        <button type="button" className="cart-continue" onClick={onClose}>
          Continue Customizing
        </button>
        {error && <pre role="alert"
          style={{ whiteSpace: 'pre-wrap', color: '#a02424' }}>{error}</pre>}
      </aside>
    </>
  )
}
