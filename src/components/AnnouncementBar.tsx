import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API } from '../DownloadPanel'
import { trackEvent } from '../analytics'

type CampaignStatus = {
  enabled: boolean
  slug?: string
  remaining?: number
}

/* Slim site-wide announcement strip above the nav. Visible only while
   a campaign is enabled and claims remain — disappears automatically
   otherwise. Clicking navigates to /create and scrolls to the offer. */
// Dev-only preview: ?campaign_preview=1 fakes the status in the browser so
// the UI can be reviewed without enabling the real campaign. Compiled out of
// production builds; it cannot create claims — real requests are rejected.
const previewMode =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('campaign_preview') === '1'

export default function AnnouncementBar() {
  const [camp, setCamp] = useState<CampaignStatus | null>(null)

  useEffect(() => {
    if (previewMode) {
      setCamp({ enabled: true, slug: 'preview', remaining: 25 })
      return
    }
    fetch(`${API}/api/campaign/status`)
      .then((r) => r.json())
      .then(setCamp)
      .catch(() => setCamp({ enabled: false }))
  }, [])

  if (!camp?.enabled || (camp.remaining ?? 0) <= 0) return null

  return (
    <Link
      to={
        previewMode
          ? '/create?campaign_preview=1#free-stl-offer'
          : '/create#free-stl-offer'
      }
      className="announce-bar"
      onClick={() =>
        trackEvent('campaign_viewed', {
          campaign: camp.slug ?? '', source: 'announce_bar',
        })}
    >
      <span className="announce-bar-text">
        Free Personalized Ornament STL — First 25 Customers!
      </span>
      <span className="announce-bar-cta">Claim yours →</span>
    </Link>
  )
}
