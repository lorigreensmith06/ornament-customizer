import { API } from './DownloadPanel'

export type OrderItem = {
  id: number
  product: string
  name: string
  quantity: number
  status: string
  label: string
}

export type OrderDetail = {
  status: string
  email?: string | null
  items: OrderItem[]
}

export type StoredOrder = {
  order_id: string
  key: string
  dismissed?: boolean
  at?: number
}

export function readStoredOrder(): StoredOrder | null {
  try {
    const raw = localStorage.getItem('lastOrder')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.order_id && parsed?.key ? parsed : null
  } catch {
    return null
  }
}

const ORDERS_KEY = 'orders'

// Browser-local order history: newest first, deduplicated by order_id.
// A legacy lastOrder-only entry is migrated in on first read so older
// purchases remain accessible.
export function readStoredOrders(): StoredOrder[] {
  let list: StoredOrder[] = []
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      list = parsed.filter((o) => o?.order_id && o?.key)
    }
  } catch {
    list = []
  }
  const last = readStoredOrder()
  if (last && !list.some((o) => o.order_id === last.order_id)) {
    list = [last, ...list]
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(list))
    } catch { /* storage full/blocked — history is best-effort */ }
  }
  return list
}

export function recordOrder(orderId: string, key: string) {
  const list = readStoredOrders().filter((o) => o.order_id !== orderId)
  list.unshift({ order_id: orderId, key, at: Date.now() })
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list))
  } catch { /* best-effort */ }
}

// Order detail and downloads carry the access key in a header — never a
// URL parameter — so tokens don't land in logs or browser history.
export async function fetchOrder(orderId: string, key: string) {
  const res = await fetch(`${API}/api/orders/${orderId}`, {
    headers: { 'X-Order-Key': key },
  })
  if (!res.ok) {
    throw new Error(res.status === 404
      ? 'Order not found.'
      : res.status === 403
        ? 'This order link is no longer valid on this device.'
        : `Order lookup failed (${res.status}).`)
  }
  return (await res.json()) as OrderDetail
}

export async function downloadOrderItem(orderKey: string,
                                        orderId: string,
                                        item: OrderItem) {
  const res = await fetch(
    `${API}/api/orders/${orderId}/download/${item.id}`,
    { headers: { 'X-Order-Key': orderKey } })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download =
    `${(item.name || 'snowflake').replace(/ /g, '_')}_ornament.stl`
  a.click()
  URL.revokeObjectURL(a.href)
}
