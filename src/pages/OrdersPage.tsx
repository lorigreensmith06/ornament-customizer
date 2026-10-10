import { useMemo } from 'react'
import { Link } from 'react-router-dom'

type LastOrder = { order_id?: string }

export default function OrdersPage() {
  const lastOrder = useMemo<LastOrder | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('lastOrder') || 'null')
    } catch {
      return null
    }
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">My Orders</h1>
      <p className="page-sub">
        Orders are linked to this browser. Order history across devices
        isn't available yet — keep your confirmation link or email handy.
      </p>
      {lastOrder?.order_id ? (
        <div className="card">
          <p>
            You have a recent order on this device (
            <code>{lastOrder.order_id.slice(0, 12)}…</code>).
          </p>
          <p>
            Open the studio and use <em>View your recent order</em> to see
            items and download purchased STLs.
          </p>
          <Link className="btn" to="/">Open the studio</Link>
        </div>
      ) : (
        <div className="card">
          <p>No orders found on this device yet.</p>
          <Link className="btn" to="/">Create your first ornament</Link>
        </div>
      )}
    </div>
  )
}
