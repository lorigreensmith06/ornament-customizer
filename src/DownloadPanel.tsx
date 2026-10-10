import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const API = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000')
  : 'https://api.ornaments.smithharbor.com'
const DESIGN_IDS: Record<string, string> = {
  '/models/snowflake_two_pairs.stl': 'two_branch',
  '/models/snowflake_three_pairs.stl': 'three_branch',
  '/models/snowflake_longer_branches.stl': 'longer_branches',
}

type Job = {
  id: string
  status: 'queued' | 'running' | 'ready' | 'failed'
  download_url: string | null
  preview_url: string | null
  error: string | null
}

async function readResponse(response: Response) {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(typeof data.detail === 'string'
      ? data.detail : JSON.stringify(data.detail ?? data))
  }
  return data
}

type OrderItem = {
  id: number
  product: string
  name: string
  quantity: number
  status: string
  label: string
}

export default function DownloadPanel({ name, selectedModel, showName, selectedFont, textSize, downloadUrl, stlValid, paid, paidSessionId, paramsKey, printedOrdered, order, hasOrderAccess, onDismissOrder, onShowOrder, onReady, onAddToCart }: {
  name: string
  selectedModel: string
  showName: boolean
  selectedFont: string
  textSize: number
  downloadUrl?: string | null
  stlValid?: boolean
  paid?: boolean
  printedOrdered?: boolean
  order?: { id: string; key: string; status: string;
            items: OrderItem[] } | null
  hasOrderAccess?: boolean
  onDismissOrder?: () => void
  onShowOrder?: () => void
  paidSessionId?: string | null
  paramsKey?: string
  onReady?: (downloadUrl: string, previewUrl: string, jobId?: string) => void
  onAddToCart?: (product: 'stl' | 'printed') => void
}) {
  const [busy, setBusy] = useState(false)
  const [buying, setBuying] = useState(false)
  const [purchaseKind, setPurchaseKind] = useState<'stl' | 'printed'>('stl')
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const active = useRef<AbortController | null>(null)
  const successTimer = useRef<number | null>(null)

  // Parameter changes abort in-flight polling; the last successful
  // download URL is owned by App and intentionally survives this.
  useEffect(() => {
    active.current?.abort()
    active.current = null
    window.clearTimeout(successTimer.current ?? undefined)
    setBusy(false)
    setMessage('')
    setError('')
    setSuccess(false)
    return () => { active.current?.abort() }
  }, [name, selectedModel, showName, selectedFont, textSize])

  async function generate() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setBusy(true)
    setError('')
    setSuccess(false)
    setMessage('Submitting…')
    try {
      const design = DESIGN_IDS[selectedModel]
      if (!design) throw new Error('No generator mapping for this design.')
      const created = await readResponse(await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: showName ? name.trim() : '',
          snowflake_design: design,
          show_text: showName,
          font_style: selectedFont,
          font_size: textSize,
        }),
        signal,
      })) as { id: string }

      while (!signal.aborted) {
        const job = await readResponse(await fetch(`${API}/api/jobs/${created.id}`, {
          signal,
        })) as Job
        if (signal.aborted) return
        if (job.status === 'failed') throw new Error(job.error || 'Generation failed.')
        if (job.status === 'ready') {
          if (!job.download_url) throw new Error('Missing download URL.')
          if (!job.preview_url) throw new Error('Missing preview URL.')
          const url = `${API}${job.download_url}`
          const preview = `${API}${job.preview_url}`
          setGeneratedJobId(job.id)
          setPreviewUrl(preview)
          onReady?.(url, preview, job.id)
          setMessage(showName ? `Ready: ${name.trim()}` : 'Ready')
          setSuccess(true)
          window.clearTimeout(successTimer.current ?? undefined)
          successTimer.current = window.setTimeout(() => setSuccess(false), 5000)
          return
        }
        setMessage(job.status === 'queued' ? 'Waiting for Houdini…' : 'Generating STL…')
        await new Promise(resolve => window.setTimeout(resolve, 1500))
      }
    } catch (err) {
      if (!signal.aborted) {
        setMessage('')
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }

  async function downloadOrderItem(item: OrderItem) {
    if (!order) return
    setError('')
    try {
      const res = await fetch(
        `${API}/api/orders/${order.id}/download/${item.id}`,
        { headers: { 'X-Order-Key': order.key } })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download =
        `${(item.name || 'snowflake').replace(/ /g, '_')}_ornament.stl`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function buy(product: 'stl' | 'printed') {
    setBuying(true)
    setError('')
    try {
      const { url } = await readResponse(await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: generatedJobId, product }),
      })) as { url: string }
      // Stripe Checkout is a full-page redirect; React state does not
      // survive it, so stash the artifact for the return trip.
      sessionStorage.setItem('pendingPurchase', JSON.stringify({
        name, selectedModel, showName, selectedFont, textSize,
        url: downloadUrl, preview: previewUrl, job: generatedJobId,
        key: paramsKey, product,
      }))
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBuying(false)
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {!stlValid && (
        <button type="button" onClick={generate}
          disabled={busy || (showName && !/[A-Z0-9]/.test(name))}>
          {busy ? 'Generating…' : 'Generate STL'}
        </button>
      )}
      {stlValid && !paid && (
        <>
          <p className="ready-note">Your ornament is ready</p>
          <div className="purchase-options" role="radiogroup"
            aria-label="Purchase options">
            <button type="button" role="radio"
              aria-checked={purchaseKind === 'stl'}
              className={`purchase-option${purchaseKind === 'stl' ? ' selected' : ''}`}
              onClick={() => setPurchaseKind('stl')}>
              <span className="purchase-option-title">Download STL — $3</span>
              <span className="purchase-option-desc">
                Download the personalized 3D-printable file.
              </span>
            </button>
            <button type="button" role="radio"
              aria-checked={purchaseKind === 'printed'}
              className={`purchase-option${purchaseKind === 'printed' ? ' selected' : ''}`}
              onClick={() => setPurchaseKind('printed')}>
              <span className="purchase-option-title">Printed Ornament — $15</span>
              <span className="purchase-option-desc">
                Have your personalized ornament printed and shipped to you.
              </span>
            </button>
          </div>
          {purchaseKind === 'stl' ? (
            <>
              <button type="button" className="buy-button"
                onClick={() => buy('stl')}
                disabled={busy || buying || !generatedJobId}>
                {buying ? 'Redirecting…' : 'Buy Now – $3'}
              </button>
              <button type="button" className="cart-button"
                onClick={() => onAddToCart?.('stl')}
                disabled={busy || buying || !generatedJobId}>
                Add to Cart
              </button>
            </>
          ) : (
            <>
              <button type="button" className="buy-button"
                onClick={() => buy('printed')}
                disabled={busy || buying || !generatedJobId}>
                {buying ? 'Redirecting…' : 'Buy Now – $15'}
              </button>
              <button type="button" className="cart-button"
                onClick={() => onAddToCart?.('printed')}
                disabled={busy || buying || !generatedJobId}>
                Add to Cart
              </button>
            </>
          )}
        </>
      )}
      {printedOrdered && (
        <small className="purchase-note">
          Order received! Your printed ornament order has been paid.
        </small>
      )}
      {order && (
        <div className="order-confirm">
          <p className="order-confirm-title">Order Confirmed!</p>
          <div className="order-confirm-items">
            {order.items.map((item) => (
              <div className="order-confirm-item" key={item.id}>
                <span className="order-confirm-name">
                  {item.name ? `"${item.name}"` : 'Snowflake'}
                </span>
                <span className="order-item-type">
                  {item.product === 'stl' ? 'Digital STL'
                    : 'Printed Ornament'}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </span>
                {item.product === 'stl' ? (
                  <button type="button"
                    className="download-link order-download"
                    disabled={item.status !== 'ready'}
                    onClick={() => downloadOrderItem(item)}>
                    {item.status === 'ready'
                      ? 'Download STL' : 'Preparing…'}
                  </button>
                ) : (
                  <small className="order-item-note">Order placed</small>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="cart-continue"
            onClick={onDismissOrder}>
            Create Another Ornament
          </button>
        </div>
      )}
      {!order && hasOrderAccess && (
        <button type="button" className="order-reopen" onClick={onShowOrder}>
          View your recent order
        </button>
      )}
      {downloadUrl && paid && paidSessionId && (
        <>
          <a className="download-link"
            href={`${downloadUrl}?session_id=${encodeURIComponent(paidSessionId)}`}>
            Download STL
          </a>
          <small className="purchase-note">
            ✓ Payment successful — your STL is ready to download.
          </small>
        </>
      )}
      {success && createPortal(
        <p className="success-banner" role="status">
          ✓ STL generated successfully — ready to download.
        </p>,
        document.querySelector('.preview') ?? document.body,
      )}
      <p role="status">{message}</p>
      {error && <pre role="alert" style={{ whiteSpace: 'pre-wrap', color: '#a02424' }}>
        {error}
      </pre>}
    </div>
  )
}
