/* Google Analytics (GA4) — loaded only after explicit consent.
   The gtag script is injected lazily so declining or unanswered
   visitors never download it, set cookies, or send data. */

const GA_ID = import.meta.env.VITE_GA_ID || 'G-1H48HJKKMR'
const CONSENT_KEY = 'gaConsent'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

let injected = false

export type Consent = 'granted' | 'denied' | null

export function getConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function setConsent(value: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    /* storage unavailable — treat as a session-only choice */
  }
  if (value === 'granted') {
    initAnalytics()
    trackPageView()
  } else {
    // Withdrawal: the loaded script can't be un-fetched, but no further
    // page_view events are sent (trackPageView re-checks consent), and
    // any GA cookies set while granted are removed.
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.trim().split('=')[0]
      if (name.startsWith('_ga')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
      }
    })
  }
}

export function initAnalytics() {
  if (injected || !GA_ID || getConsent() !== 'granted') return
  injected = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
  window.gtag('js', new Date())
  // send_page_view: false — the SPA reports each route change
  // manually, so the automatic first hit doesn't double-count.
  window.gtag('config', GA_ID, { send_page_view: false })
}

/* Report a route change. Only the path and the safe `design` param are
   sent — payment/session params (session_id, payment) are stripped so
   checkout identifiers never reach Google. */
export function trackPageView() {
  if (getConsent() !== 'granted' || typeof window.gtag !== 'function') {
    return
  }
  const params = new URLSearchParams(window.location.search)
  const design = params.get('design')
  const pagePath = window.location.pathname + (design ? `?design=${encodeURIComponent(design)}` : '')
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: document.title,
  })
}
