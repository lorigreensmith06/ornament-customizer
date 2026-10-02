import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const API = import.meta.env.DEV
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

export default function DownloadPanel({ name, selectedModel, showName, selectedFont, textSize, downloadUrl, onReady }: {
  name: string
  selectedModel: string
  showName: boolean
  selectedFont: string
  textSize: number
  downloadUrl?: string | null
  onReady?: (url: string) => void
}) {
  const [busy, setBusy] = useState(false)
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
          const url = `${API}${job.download_url}`
          onReady?.(url)
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

  return (
    <div style={{ marginTop: '1rem' }}>
      <button type="button" onClick={generate}
        disabled={busy || (showName && !/[A-Z0-9]/.test(name))}>
        {busy ? 'Generating…' : 'Generate STL'}
      </button>
      {downloadUrl && (
        <a className="download-link" href={downloadUrl}>Download STL</a>
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
