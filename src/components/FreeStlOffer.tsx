import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { API } from '../DownloadPanel'
import { downloadOrderItem, fetchOrder, recordOrder } from '../orders'
import { trackEvent } from '../analytics'

type CampaignStatus = {
  enabled: boolean
  name?: string
  slug?: string
  max_claims?: number
  remaining?: number
}

type Step = 'idle' | 'claiming' | 'code' | 'verifying' | 'done'

// Guidance shown before an STL exists — neutral hint, not an error.
const GENERATE_FIRST =
  'Customize your ornament and click Generate STL above.'

/* Free STL beta-test offer. Rendered on /create only when the backend
   reports an active campaign. The claim binds the currently generated
   ornament (jobId); verification returns an order entitlement handled
   by the same download path as paid orders. */
export default function FreeStlOffer({
  jobId,
  stlValid,
}: {
  jobId: string | null
  stlValid: boolean
}) {
  const [camp, setCamp] = useState<CampaignStatus | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [orderRef, setOrderRef] = useState<{ id: string; key: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [warned, setWarned] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Dev-only preview: ?campaign_preview=1 fakes the status for UI review
    // (compiled out of production; claims still hit the real API and fail).
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('campaign_preview') === '1'
    ) {
      setCamp({
        enabled: true, name: 'November 2026 Beta Test',
        slug: 'preview', max_claims: 25, remaining: 25,
      })
      return
    }
    fetch(`${API}/api/campaign/status`)
      .then((r) => r.json())
      .then((s: CampaignStatus) => {
        setCamp(s)
        if (s.enabled) trackEvent('campaign_viewed', { campaign: s.slug ?? '' })
      })
      .catch(() => setCamp({ enabled: false }))
  }, [])

  // Deep link: /create#free-stl-offer scrolls here once the card exists.
  // Depends on `location` (not just the hash string) so repeated clicks on
  // the announcement bar re-scroll even when the URL already has the hash.
  // scrollIntoView scrolls whichever ancestor is scrollable — the sidebar
  // on desktop, the page on mobile.
  const location = useLocation()
  useEffect(() => {
    if (camp?.enabled && location.hash === '#free-stl-offer') {
      document
        .getElementById('free-stl-offer')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [camp, location])

  if (!camp?.enabled) return null
  const soldOut = (camp.remaining ?? 0) <= 0

  async function claim() {
    setError('')
    setNotice('')
    if (!stlValid || !jobId) {
      setError('Generate your ornament first, then claim your free STL.')
      return
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/campaign/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, job_id: jobId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Claim failed.')
      trackEvent('claim_started', { campaign: camp!.slug ?? '' })
      if (data.cooldown) setNotice(data.message)
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed.')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/campaign/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Verification failed.')
      trackEvent('email_verified', { campaign: camp!.slug ?? '' })
      trackEvent('claim_completed', { campaign: camp!.slug ?? '' })
      const ref = { id: data.order_id, key: data.access_token }
      setOrderRef(ref)
      recordOrder(ref.id, ref.key)
      localStorage.setItem('lastOrder', JSON.stringify(
        { order_id: ref.id, key: ref.key, dismissed: false }))
      setStep('done')
      // Refresh remaining count after a successful claim.
      fetch(`${API}/api/campaign/status`)
        .then((r) => r.json()).then(setCamp).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!orderRef) return
    setError('')
    try {
      const detail = await fetchOrder(orderRef.id, orderRef.key)
      const item = detail.items.find((i) => i.product === 'stl')
      if (!item) throw new Error('No STL on this order.')
      await downloadOrderItem(orderRef.key, orderRef.id, item)
      trackEvent('stl_downloaded', { campaign: camp!.slug ?? '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.')
    }
  }

  return (
    <div id="free-stl-offer" className="free-offer" data-clarity-mask="true">
      <h3 className="free-offer-title">Help Us Test Ornament Creator!</h3>
      {soldOut ? (
        <p className="free-offer-text">
          All {camp.max_claims} free downloads have been claimed. Thank
          you for helping us test Ornament Creator!
        </p>
      ) : (
        <p className="free-offer-text">
          We're looking for {camp.max_claims} people to test our
          personalized 3D-printable Christmas ornaments. Create your
          own personalized snowflake, download the STL for free, and
          let us know what you think!
        </p>
      )}

      {!soldOut && step !== 'done' && (
        <p className="free-offer-remaining">
          {camp.remaining} of {camp.max_claims} free downloads remaining
        </p>
      )}

      {step === 'idle' && !soldOut && (
        <>
          {!stlValid && !warned && (
            <p className="free-offer-hint">
              <strong>Before claiming:</strong> {GENERATE_FIRST}
            </p>
          )}
          {warned && !stlValid && (
            <div className="free-offer-warning" role="status">
              <strong>Your ornament isn't ready yet!</strong>
              <span>
                Finish customizing your ornament, then click
                Generate&nbsp;STL above.
              </span>
            </div>
          )}
          <button
            className="btn free-offer-btn"
            disabled={busy}
            onClick={() => {
              if (!stlValid || !jobId) {
                setError('')
                setWarned(true)
                document.getElementById('generate-stl-btn')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                return
              }
              setError('')
              setWarned(false)
              setStep('claiming')
            }}
          >
            Claim Your Free Ornament STL
          </button>
        </>
      )}

      {step === 'claiming' && (
        <div className="free-offer-form">
          <label htmlFor="offer-email">Email for verification</label>
          <input
            id="offer-email" type="email" value={email}
            placeholder="you@example.com" autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" disabled={busy} onClick={claim}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          <button className="btn secondary" onClick={() => setStep('idle')}>
            Cancel
          </button>
        </div>
      )}

      {(step === 'code' || step === 'verifying') && (
        <div className="free-offer-form">
          <label htmlFor="offer-code">
            Enter the 6-digit code we emailed you
          </label>
          <input
            id="offer-code" inputMode="numeric" maxLength={6}
            value={code} placeholder="123456"
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" disabled={busy} onClick={verify}>
            {busy ? 'Verifying…' : 'Verify & claim'}
          </button>
          <button className="btn secondary" onClick={claim} disabled={busy}>
            Resend code
          </button>
        </div>
      )}

      {step === 'done' && orderRef && (
        <div className="free-offer-done">
          <p className="success-banner" role="status">
            Your free STL is ready — it's also saved in your orders.
          </p>
          <button className="btn" onClick={download}>
            Download STL
          </button>
          <FeedbackForm orderRef={orderRef} slug={camp.slug ?? ''} />
        </div>
      )}

      {notice && <p className="free-offer-notice">{notice}</p>}
      {error && (
        <pre role="alert" className="free-offer-error">{error}</pre>
      )}
    </div>
  )
}

const QUESTIONS = [
  ['printed', 'Did your ornament print successfully?'],
  ['design', 'What did you think of the ornament design?'],
  ['ease', 'Was the customization and download process easy?'],
  ['improve', 'What would you improve?'],
  ['would_buy', 'Would you consider purchasing additional designs?'],
] as const

function FeedbackForm({
  orderRef, slug,
}: {
  orderRef: { id: string; key: string }
  slug: string
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [share, setShare] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    try {
      const res = await fetch(`${API}/api/campaign/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Key': orderRef.key,
        },
        body: JSON.stringify({
          order_id: orderRef.id, answers, allow_share: share,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not send feedback.')
      trackEvent('feedback_submitted', { campaign: slug })
      setSent(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send feedback.')
    }
  }

  if (sent) {
    return <p className="free-offer-notice">Thanks for your feedback!</p>
  }

  return (
    <details className="free-offer-feedback">
      <summary>Tell us what you think (optional)</summary>
      {QUESTIONS.map(([key, q]) => (
        <label key={key} className="feedback-q">
          {q}
          <textarea
            rows={2}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [key]: e.target.value }))}
          />
        </label>
      ))}
      <p className="feedback-photo">
        Printed yours? We'd love a photo — email it to
        support@ornamentcreator.com.
      </p>
      <label className="feedback-share">
        <input
          type="checkbox" checked={share}
          onChange={(e) => setShare(e.target.checked)}
        />
        You may use my feedback (and photos I send) on the site.
      </label>
      <button className="btn" onClick={submit}>
        Send feedback
      </button>
      {err && <pre role="alert" className="free-offer-error">{err}</pre>}
    </details>
  )
}
