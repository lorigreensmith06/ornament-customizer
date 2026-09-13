import { useEffect, useRef, useState } from 'react'

const API = 'http://127.0.0.1:8000'
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

export default function DownloadPanel({ name, selectedModel }: {
  name: string
  selectedModel: string
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const active = useRef<AbortController | null>(null)

  // A changed name/design invalidates the previous download in this panel.
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setMessage('')
    setError('')
    setDownloadUrl('')
    return () => { active.current?.abort() }
  }, [name, selectedModel])

  async function generate() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setBusy(true)
    setError('')
    setDownloadUrl('')
    setMessage('Submitting…')
    try {
      const design = DESIGN_IDS[selectedModel]
      if (!design) throw new Error('No generator mapping for this design.')
      const created = await readResponse(await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), design }),
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
          setDownloadUrl(`${API}${job.download_url}`)
          setMessage(`Ready: ${name.trim()}`)
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
        disabled={busy || !/[A-Z0-9]/.test(name)}>
        {busy ? 'Generating…' : 'Generate STL'}
      </button>
      <p role="status">{message}</p>
      {error && <pre role="alert" style={{ whiteSpace: 'pre-wrap', color: '#a02424' }}>
        {error}
      </pre>}
      {downloadUrl && <a href={downloadUrl}>Download STL</a>}
      <small style={{ display: 'block', marginTop: '0.5rem' }}>
        Test export: Lato Bold, size 1. The current browser preview uses a different font.
      </small>
    </div>
  )
}
