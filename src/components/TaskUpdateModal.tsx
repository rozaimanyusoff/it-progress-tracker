'use client'

import { useState, useEffect, useRef } from 'react'

interface TaskUpdateEntry {
  id: number
  notes: string | null
  media_urls: string[]
  created_at: string
  user: { id: number; name: string }
}

interface Props {
  taskId: number
  taskTitle: string
  featureTitle: string
  projectTitle: string
  currentStatus: string
  onClose: () => void
  onStatusChange: (taskId: number, newStatus: string) => void
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_LABEL: Record<string, string> = {
  Todo: 'To Do',
  InProgress: 'In Progress',
  InReview: 'In Review',
  Done: 'Done',
}
const STATUS_COLOR: Record<string, string> = {
  Todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  InReview: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export default function TaskUpdateModal({
  taskId,
  taskTitle,
  featureTitle,
  projectTitle,
  currentStatus,
  onClose,
  onStatusChange,
}: Props) {
  const [updates, setUpdates] = useState<TaskUpdateEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(currentStatus)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/updates`)
      .then((r) => r.json())
      .then((data) => { setUpdates(data); setLoadingHistory(false) })
  }, [taskId])

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const newFiles = Array.from(selected)
    setFiles((prev) => [...prev, ...newFiles])
    newFiles.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPreviews((prev) => [...prev, url])
    })
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index])
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(markComplete = false) {
    if (!notes.trim() && files.length === 0) {
      setError('Please add a note or attach media.')
      return
    }
    setError('')
    setSubmitting(true)

    try {
      // Upload files first
      let mediaUrls: string[] = []
      if (files.length > 0) {
        const fd = new FormData()
        fd.append('task_id', String(taskId))
        files.forEach((f) => fd.append('files', f))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          setError(err.error ?? 'Upload failed')
          setSubmitting(false)
          return
        }
        const { urls } = await uploadRes.json()
        mediaUrls = urls
      }

      // Submit update
      const res = await fetch(`/api/tasks/${taskId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null, media_urls: mediaUrls, mark_complete: markComplete }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to save update')
        setSubmitting(false)
        return
      }
      const { update, newStatus } = await res.json()

      setUpdates((prev) => [update, ...prev])
      setNotes('')
      setFiles([])
      setPreviews([])
      setStatus(newStatus)
      onStatusChange(taskId, newStatus)
    } finally {
      setSubmitting(false)
    }
  }

  const canMarkComplete = status === 'InProgress' || status === 'Todo'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-navy-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-slate-900 dark:text-white text-base leading-tight">{taskTitle}</h2>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">{featureTitle} · {projectTitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Update form */}
          <div className="p-5 border-b border-slate-200 dark:border-navy-700">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Progress Note</label>
            <textarea
              className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="Describe what you've done, blockers, or next steps..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {/* File previews */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previews.map((url, i) => (
                  <div key={i} className="relative group">
                    {isVideo(files[i]?.name ?? '') ? (
                      <video src={url} className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" />
                    ) : (
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" />
                    )}
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions row */}
            <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-navy-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                >
                  <span>📎</span> Attach
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              <div className="flex items-center gap-2">
                {canMarkComplete && (
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Saving...' : '✓ Mark Complete'}
                  </button>
                )}
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving...' : 'Submit Update'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

            {status === 'InReview' && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg">
                Task is in review — waiting for manager approval.
              </p>
            )}
            {status === 'Done' && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                Task completed.
              </p>
            )}
          </div>

          {/* Update history */}
          <div className="p-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Update History</h3>
            {loadingHistory ? (
              <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
            ) : updates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No updates yet. Submit your first progress note above.</p>
            ) : (
              <div className="space-y-4">
                {updates.map((u) => (
                  <div key={u.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-semibold shrink-0 mt-0.5">
                      {u.user.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-white">{u.user.name}</span>
                        <span className="text-xs text-slate-400">{timeAgo(u.created_at)}</span>
                      </div>
                      {u.notes && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{u.notes}</p>}
                      {u.media_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {u.media_urls.map((url, i) => (
                            isVideo(url) ? (
                              <video key={i} src={url} controls className="max-w-xs rounded-lg border border-slate-200 dark:border-navy-600" style={{ maxHeight: 160 }} />
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" className="max-w-xs rounded-lg border border-slate-200 dark:border-navy-600 hover:opacity-90 transition-opacity" style={{ maxHeight: 160 }} />
                              </a>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
