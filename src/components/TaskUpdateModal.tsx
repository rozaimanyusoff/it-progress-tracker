'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface TaskUpdateEntry {
  id: number
  notes: string | null
  media_urls: string[]
  created_at: string
  user: { id: number; name: string; role: string }
}

interface Props {
  taskId: number
  taskTitle: string
  moduleTitle: string | null
  featureTitle: string | null
  projectTitle: string | null
  currentStatus: string
  reviewCount?: number
  onClose: () => void
  onStatusChange: (taskId: number, newStatus: string) => void
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url)
}

function isDoc(url: string) {
  return /\.(pdf|docx?|xlsx?)$/i.test(url)
}

function docLabel(url: string) {
  const ext = url.split('.').pop()?.toUpperCase() ?? 'FILE'
  const icons: Record<string, string> = { PDF: '📄', DOC: '📝', DOCX: '📝', XLS: '📊', XLSX: '📊' }
  return { icon: icons[ext] ?? '📎', ext }
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

const REVIEW_ISSUES = [
  'Bug / Logic Error',
  'UI/UX Issue',
  'Missing Functionality',
  'Performance Issue',
  'Code Quality',
  'Security Concern',
  'Test / Validation Missing',
  'Incomplete Implementation',
]

const STATUS_LABEL: Record<string, string> = {
  Todo: 'To Do',
  InProgress: 'In Progress',
  InReview: 'To Review',
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
  moduleTitle,
  featureTitle,
  projectTitle,
  currentStatus,
  reviewCount = 0,
  onClose,
  onStatusChange,
}: Props) {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'

  const [updates, setUpdates] = useState<TaskUpdateEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(currentStatus)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manager review state
  const [reviewComment, setReviewComment] = useState('')
  const [reviewIssues, setReviewIssues] = useState<Set<string>>(new Set())
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const reviewFileInputRef = useRef<HTMLInputElement>(null)

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
    if (markComplete && (!notes.trim() || files.length === 0)) {
      setError('Please add a progress note and at least one attachment before submitting for review.')
      return
    }
    if (!markComplete && !notes.trim() && files.length === 0) {
      setError('Please add a note or attach media.')
      return
    }
    setError('')
    setSubmitting(true)

    try {
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

  function toggleReviewIssue(issue: string) {
    setReviewIssues(prev => {
      const next = new Set(prev)
      next.has(issue) ? next.delete(issue) : next.add(issue)
      return next
    })
  }

  function handleReviewFiles(selected: FileList | null) {
    if (!selected) return
    const newFiles = Array.from(selected)
    setReviewFiles(prev => [...prev, ...newFiles])
    newFiles.forEach(f => setReviewPreviews(prev => [...prev, URL.createObjectURL(f)]))
  }

  function removeReviewFile(index: number) {
    URL.revokeObjectURL(reviewPreviews[index])
    setReviewFiles(prev => prev.filter((_, i) => i !== index))
    setReviewPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleReview(action: 'approve' | 'reject') {
    setReviewError('')
    setReviewing(true)
    try {
      let mediaUrls: string[] = []
      if (reviewFiles.length > 0) {
        const fd = new FormData()
        fd.append('task_id', String(taskId))
        reviewFiles.forEach(f => fd.append('files', f))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          setReviewError((await uploadRes.json()).error ?? 'Upload failed')
          return
        }
        const { urls } = await uploadRes.json()
        mediaUrls = urls
      }

      // Compose notes: issues list + free-text comment
      const issueLines = reviewIssues.size > 0
        ? `Findings:\n${Array.from(reviewIssues).map(i => `• ${i}`).join('\n')}`
        : ''
      const combined = [issueLines, reviewComment.trim()].filter(Boolean).join('\n\n') || null

      const res = await fetch(`/api/tasks/${taskId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: combined, media_urls: mediaUrls, review_action: action }),
      })
      if (!res.ok) {
        const err = await res.json()
        setReviewError(err.error ?? 'Failed to submit review')
        return
      }
      const { update, newStatus } = await res.json()
      setUpdates((prev) => [update, ...prev])
      setReviewComment('')
      setReviewIssues(new Set())
      setReviewFiles([])
      setReviewPreviews([])
      setStatus(newStatus)
      onStatusChange(taskId, newStatus)
    } finally {
      setReviewing(false)
    }
  }

  // Form is locked when task is in review (for developer) or done
  // Manager can comment on Todo/InProgress; InReview handled by review panel
  const formLocked = status === 'Done' || status === 'InReview'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-navy-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-slate-900 dark:text-white text-base leading-tight">{taskTitle}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {moduleTitle && (
                <>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium truncate">{moduleTitle}</span>
                  <span className="text-xs text-slate-300 dark:text-slate-600">›</span>
                </>
              )}
              {featureTitle && <span className="text-xs text-blue-600 dark:text-blue-400 truncate">{featureTitle}</span>}
              {featureTitle && projectTitle && <span className="text-xs text-slate-300 dark:text-slate-600">·</span>}
              {projectTitle && <span className="text-xs text-slate-400 truncate">{projectTitle}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {reviewCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                ↩ {reviewCount}×
              </span>
            )}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Update form */}
          <div className="p-5 border-b border-slate-200 dark:border-navy-700">

            {/* Manager review panel */}
            {status === 'InReview' && isManager && (
              <div className="mb-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Manager Review</p>
                <textarea
                  className="w-full bg-white dark:bg-navy-900 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                  rows={3}
                  placeholder="Add a review comment (optional)..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />

                {/* Predefined issue checkboxes */}
                <div>
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1.5">Issues found (optional)</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {REVIEW_ISSUES.map(issue => (
                      <label key={issue} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={reviewIssues.has(issue)}
                          onChange={() => toggleReviewIssue(issue)}
                          className="w-3.5 h-3.5 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{issue}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Review file attachment */}
                <div>
                  <button
                    type="button"
                    onClick={() => reviewFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-yellow-300 dark:border-yellow-700 rounded-lg text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
                  >
                    <span>📎</span> Attach evidence
                  </button>
                  <input ref={reviewFileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleReviewFiles(e.target.files)} />
                  {reviewPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {reviewPreviews.map((url, i) => (
                        <div key={i} className="relative group w-16 h-16 shrink-0">
                          {isVideo(reviewFiles[i]?.name ?? '') ? (
                            <video src={url} className="w-16 h-16 object-cover rounded border border-yellow-200 dark:border-yellow-800" muted />
                          ) : (
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-yellow-200 dark:border-yellow-800" />
                          )}
                          <button
                            onClick={() => removeReviewFile(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview('approve')}
                    disabled={reviewing}
                    className="flex-1 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {reviewing ? 'Saving...' : '✓ Approve → Done'}
                  </button>
                  <button
                    onClick={() => handleReview('reject')}
                    disabled={reviewing}
                    className="flex-1 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {reviewing ? 'Saving...' : '↩ Reject → In Progress'}
                  </button>
                </div>
              </div>
            )}

            {/* Developer waiting banner */}
            {status === 'InReview' && !isManager && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <span className="text-yellow-600 dark:text-yellow-400 text-base">🔍</span>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                  Task submitted for review — waiting for manager approval. No further updates from developer.
                </p>
              </div>
            )}
            {status === 'Done' && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <span className="text-green-600 dark:text-green-400 text-base">✓</span>
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                  Task completed and approved.
                </p>
              </div>
            )}

            {!formLocked && (
              <>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {isManager ? 'Manager Note' : 'Progress Note'}
                </label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder={isManager ? 'Add a note or instruction for the assignee...' : status === 'Todo' ? 'Add a note to start working on this task...' : 'Describe what you\'ve done, blockers, or next steps...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                {/* File previews before submit */}
                {previews.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-1.5">{previews.length} file{previews.length > 1 ? 's' : ''} attached</p>
                    <div className="flex flex-wrap gap-2">
                      {previews.map((url, i) => (
                        <div key={i} className="relative group w-20 h-20 shrink-0">
                          {isVideo(files[i]?.name ?? '') ? (
                            <>
                              <video src={url} className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" muted />
                              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 pointer-events-none">
                                <span className="text-white text-lg">▶</span>
                              </span>
                            </>
                          ) : (
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" />
                          )}
                          <button
                            onClick={() => removeFile(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >×</button>
                          <p className="text-xs text-slate-400 truncate w-20 mt-0.5 text-center">{files[i]?.name}</p>
                        </div>
                      ))}
                    </div>
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
                    {/* Submit for Review — only developer, only from InProgress */}
                    {status === 'InProgress' && !isManager && (
                      <button
                        onClick={() => handleSubmit(true)}
                        disabled={submitting}
                        className="px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
                      >
                        {submitting ? 'Saving...' : '→ Submit for Review'}
                      </button>
                    )}
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={submitting}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
                    >
                      {submitting ? 'Saving...' : isManager ? 'Save Note' : status === 'Todo' ? 'Start & Save Note' : 'Save Note'}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </>
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
                {updates.map((u) => {
                  const isMgrEntry = u.user.role === 'manager'
                  return (
                    <div key={u.id} className={`flex gap-3 rounded-lg p-2 -mx-2 ${isMgrEntry ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${isMgrEntry ? 'bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300'}`}>
                        {u.user.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isMgrEntry ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{u.user.name}</span>
                          {isMgrEntry && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 uppercase tracking-wide">Review</span>}
                          <span className="text-xs text-slate-400">{timeAgo(u.created_at)}</span>
                        </div>
                        {u.notes && <p className={`text-sm mt-0.5 whitespace-pre-wrap ${isMgrEntry ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>{u.notes}</p>}
                        {u.media_urls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {u.media_urls.map((url, i) => {
                              if (isVideo(url)) return (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="relative group block w-20 h-20 shrink-0">
                                  <video src={url} className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" muted />
                                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 group-hover:bg-black/50 transition-colors">
                                    <span className="text-white text-xl">▶</span>
                                  </span>
                                </a>
                              )
                              if (isDoc(url)) {
                                const { icon, ext } = docLabel(url)
                                return (
                                  <a key={i} href={url} target="_blank" rel="noreferrer"
                                    className="w-20 h-20 shrink-0 flex flex-col items-center justify-center rounded-lg border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
                                    <span className="text-2xl">{icon}</span>
                                    <span className="text-xs text-slate-500 mt-0.5">{ext}</span>
                                  </a>
                                )
                              }
                              return (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20 shrink-0 group">
                                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600 group-hover:opacity-90 transition-opacity" />
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
