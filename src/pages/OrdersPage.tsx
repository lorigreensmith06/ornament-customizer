import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  downloadOrderItem,
  fetchOrder,
  readStoredOrders,
  type OrderDetail,
  type StoredOrder,
} from '../orders'

function OrderCard({ stored }: { stored: StoredOrder }) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    // A failed fetch does not remove the stored key — the error may be
    // transient, and the key is the only way back to the order.
    fetchOrder(stored.order_id, stored.key)
      .then((data) => {
        setOrder(data)
        setLoading(false)
      })
      .catch((err) => {
        setOrder(null)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [stored])

  useEffect(() => { load() }, [load])

  async function onDownload(item: OrderDetail['items'][number]) {
    setDownloadError('')
    try {
      await downloadOrderItem(stored.key, stored.order_id, item)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="card order-card">
      <p className="orders-summary">
        Order <code>{stored.order_id.slice(0, 12)}…</code>
        {stored.at &&
          ` · ${new Date(stored.at).toLocaleDateString()}`}
        {order &&
          ` — ${order.status === 'paid' ? 'Paid' : order.status}`}
        {order?.email ? ` · ${order.email}` : ''}
      </p>

      {loading && <p>Loading order…</p>}

      {error && (
        <>
          <p className="orders-error">
            This order couldn't be loaded — {error}
          </p>
          <button type="button" className="btn" onClick={load}>
            Try again
          </button>
        </>
      )}

      {order && (
        <div className="order-confirm-items">
          {order.items.map((item) => (
            <div className="order-confirm-item" key={item.id}>
              <span className="order-confirm-name">
                {item.name ? `"${item.name}"` : 'Snowflake'}
              </span>
              <span className="order-item-type">
                {item.product === 'stl'
                  ? 'Digital STL' : 'Printed Ornament'}
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
              </span>
              {item.product === 'stl' ? (
                <button type="button"
                  className="download-link order-download"
                  disabled={item.status !== 'ready'}
                  onClick={() => onDownload(item)}>
                  {item.status === 'ready'
                    ? 'Download STL' : 'Preparing…'}
                </button>
              ) : (
                <small className="order-item-note">Order placed</small>
              )}
            </div>
          ))}
        </div>
      )}

      {downloadError && (
        <p role="alert" className="orders-error">{downloadError}</p>
      )}
    </div>
  )
}

export default function OrdersPage() {
  const [orders] = useState<StoredOrder[]>(readStoredOrders)

  return (
    <div className="page">
      <h1 className="page-title">My Orders</h1>
      <p className="page-sub">
        Orders are linked to this browser — this is not a permanent,
        account-based order history. Access from another device or after
        clearing site data isn't available yet, so keep your Stripe
        receipt emails handy.
      </p>

      {orders.length === 0 ? (
        <div className="card">
          <p>No orders found on this device yet.</p>
          <Link className="btn" to="/">Create your first ornament</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((stored) => (
            <OrderCard key={stored.order_id} stored={stored} />
          ))}
        </div>
      )}
    </div>
  )
}
