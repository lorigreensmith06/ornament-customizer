/* Per-route SEO metadata. index.html carries the homepage defaults in
   the served document; this module keeps them correct after client-side
   navigation so each public page has a unique title, description, and
   canonical URL. Private/utility routes are marked noindex. */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const SITE_URL = 'https://ornamentcreator.com'

interface RouteMeta {
  title: string
  description: string
  noindex?: boolean
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Personalized Christmas Ornaments & 3D Printable STLs | Ornament Creator',
    description:
      'Create personalized Christmas ornaments with your own name. Download a 3D-printable STL or order a custom printed ornament delivered to your door.',
  },
  '/create': {
    title: 'Design Your Personalized Ornament | Ornament Creator',
    description:
      'Personalize a snowflake ornament with your name, font, and design. Preview it live in 3D, then download the STL or order a printed ornament.',
  },
  '/explore': {
    title: 'Explore Ornament Designs | Ornament Creator',
    description:
      'Browse personalized snowflake ornament designs. Every ornament is made to order with your own name in a font and style you choose.',
  },
  '/about': {
    title: 'About Us | Ornament Creator',
    description:
      'Ornament Creator is a Smith Harbor studio making personalized 3D-printed Christmas ornaments and downloadable STLs.',
  },
  '/refunds': {
    title: 'Returns & Refunds | Ornament Creator',
    description:
      'Our return and refund policy for personalized printed ornaments and digital STL downloads.',
  },
  '/terms': {
    title: 'Terms of Service | Ornament Creator',
    description:
      'Terms of service for Ornament Creator, including personalization, STL licensing, payments, and shipping.',
  },
  '/privacy': {
    title: 'Privacy Policy | Ornament Creator',
    description:
      'How Ornament Creator collects, uses, and protects your information, including cookies and analytics.',
  },
  '/orders': {
    title: 'My Orders | Ornament Creator',
    description: 'View your Ornament Creator order history.',
    noindex: true,
  },
}

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  if (selector.startsWith('meta[name=')) {
    el.setAttribute('name', selector.slice(10, -2))
  } else if (selector.startsWith('meta[property=')) {
    el.setAttribute('property', selector.slice(14, -2))
  }
  el.setAttribute(attr, value)
}

export function useRouteMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = ROUTE_META[pathname] ?? ROUTE_META['/']
    document.title = meta.title
    setMeta('meta[name="description"]', 'content', meta.description)
    setMeta(
      'meta[name="robots"]',
      'content',
      meta.noindex ? 'noindex, nofollow' : 'index, follow',
    )
    setMeta('meta[property="og:title"]', 'content', meta.title)
    setMeta('meta[property="og:description"]', 'content', meta.description)
    setMeta('meta[property="og:url"]', 'content', SITE_URL + pathname)
    setMeta('meta[name="twitter:title"]', 'content', meta.title)
    setMeta('meta[name="twitter:description"]', 'content', meta.description)

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = SITE_URL + pathname
  }, [pathname])
}
