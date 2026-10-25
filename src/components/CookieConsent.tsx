import { useEffect, useState } from 'react'
import { getConsent, setConsent } from '../analytics'

export default function CookieConsent() {
  const [open, setOpen] = useState(() => getConsent() === null)

  // Allow the footer's "Cookie preferences" link to re-open the banner.
  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener('cookie-preferences', reopen)
    return () => window.removeEventListener('cookie-preferences', reopen)
  }, [])

  if (!open) return null

  function choose(value: 'granted' | 'denied') {
    setConsent(value)
    setOpen(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie preferences">
      <p className="cookie-text">
        We use cookies to understand how visitors use Ornament Creator
        and to improve the site.
      </p>
      <div className="cookie-actions">
        <button type="button" className="cookie-decline"
          onClick={() => choose('denied')}>
          Decline
        </button>
        <button type="button" className="cookie-accept"
          onClick={() => choose('granted')}>
          Accept
        </button>
      </div>
    </div>
  )
}
