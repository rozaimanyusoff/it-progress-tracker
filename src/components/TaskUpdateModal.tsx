'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface TaskUpdateEntry {
  id: number | string
  notes: string | null
  media_urls: string[]
  created_at: string
  user: { id: number; name: string; role: string }
  entry_type?: 'update' | 'status'
  event_label?: string | null
  actual_date?: string | null
}

interface Props {
  taskId: number
  taskTitle: string
  taskScope?: string | null
  devCategory?: string | null
  devScope?: string | null
  devTask?: string | null
  moduleTitle: string | null
  featureTitle: string | null
  projectTitle: string | null
  createdByName?: string | null
  taskPlannedStartDate?: string | null
  dueDate?: string | null
  deliverablePlannedStart?: string | null
  deliverablePlannedEnd?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
  currentStatus: string
  reviewCount?: number
  estMandays?: number | null
  deliverableBudgetMandays?: number | null
  deliverableUsedMandays?: number | null
  initialActualMandays?: number | null
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

const ATTACHMENT_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const ATTACHMENT_ACCEPT_ATTR = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.xlsx'
const MAX_ATTACHMENT_FILES = 10

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

function calcWorkingMandays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0

  const cur = new Date(start)
  let days = 0
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) days += 1
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export default function TaskUpdateModal({
  taskId,
  taskTitle,
  taskScope,
  devCategory,
  devScope,
  devTask,
  moduleTitle,
  featureTitle,
  projectTitle,
  createdByName,
  taskPlannedStartDate,
  dueDate,
  deliverablePlannedStart,
  deliverablePlannedEnd,
  actualStartDate,
  actualEndDate,
  currentStatus,
  reviewCount = 0,
  estMandays,
  deliverableBudgetMandays,
  deliverableUsedMandays,
  initialActualMandays,
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
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(currentStatus)
  const [actualMandays, setActualMandays] = useState(
    initialActualMandays != null ? String(initialActualMandays) : ''
  )
  const [progressAction, setProgressAction] = useState<'keep' | 'for_review' | 'blocked' | 'resume'>('keep')
  const [blockedReason, setBlockedReason] = useState('')
  const defaultStartedOn = actualStartDate?.slice(0, 10) || deliverablePlannedStart?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const defaultCompletedOn = dueDate?.slice(0, 10) || deliverablePlannedEnd?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const [startedOn, setStartedOn] = useState(defaultStartedOn)
  const [completedOn, setCompletedOn] = useState(defaultCompletedOn)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manager review state
  const [reviewComment, setReviewComment] = useState('')
  const [reviewIssues, setReviewIssues] = useState<Set<string>>(new Set())
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const reviewFileInputRef = useRef<HTMLInputElement>(null)

  async function loadHistory() {
    const res = await fetch(`/api/tasks/${taskId}/updates`)
    const data = await res.json()
    setUpdates(data)
    setLoadingHistory(false)
  }

  useEffect(() => {
    setLoadingHistory(true)
    loadHistory()
  }, [taskId])

  function handleFiles(selected: FileList | File[] | null) {
    if (!selected) return
    const newFiles = Array.from(selected)
    if (files.length + newFiles.length > MAX_ATTACHMENT_FILES) {
      setError(`Maximum ${MAX_ATTACHMENT_FILES} attachments per update.`)
      return
    }
    const invalid = newFiles.find(f => !ATTACHMENT_ACCEPT.includes(f.type))
    if (invalid) {
      setError(`${invalid.name} is not supported. Upload images, PDF, DOCX, or XLSX only.`)
      return
    }
    setError('')
    setFiles((prev) => [...prev, ...newFiles])
    newFiles.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPreviews((prev) => [...prev, url])
    })
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDraggingFiles(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index])
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (status === 'Blocked') setProgressAction('resume')
    else setProgressAction('keep')
    setBlockedReason('')
  }, [status])

  useEffect(() => {
    setStartedOn(actualStartDate?.slice(0, 10) || deliverablePlannedStart?.slice(0, 10) || new Date().toISOString().slice(0, 10))
  }, [actualStartDate, deliverablePlannedStart, taskId])

  useEffect(() => {
    if (progressAction === 'for_review') {
      setCompletedOn(dueDate?.slice(0, 10) || deliverablePlannedEnd?.slice(0, 10) || new Date().toISOString().slice(0, 10))
    }
  }, [progressAction, dueDate, deliverablePlannedEnd, taskId])

  // Clamp completedOn to startedOn if user picks a later start date
  useEffect(() => {
    if (startedOn && completedOn && completedOn < startedOn) {
      setCompletedOn(startedOn)
    }
  }, [startedOn])

  useEffect(() => {
    const endDate = progressAction === 'for_review' ? completedOn : new Date().toISOString().slice(0, 10)
    const calculated = calcWorkingMandays(startedOn, endDate).toFixed(1)
    if (actualMandays !== calculated) setActualMandays(calculated)
  }, [startedOn, completedOn, progressAction, actualMandays])

  async function handleSubmit() {
    if (progressAction === 'blocked' && !blockedReason.trim()) {
      setError('Please provide blocker reason.')
      return
    }
    if (progressAction === 'for_review' && (!actualMandays || Number(actualMandays) <= 0)) {
      setError('MD utilized is required before submitting for review.')
      return
    }
    if (startedOn && startedOn > new Date().toISOString().slice(0, 10)) {
      setError('Started date cannot be in the future.')
      return
    }
    if (progressAction === 'for_review' && !completedOn) {
      setError('Completion date is required before submitting for review.')
      return
    }
    if (progressAction === 'for_review' && completedOn > new Date().toISOString().slice(0, 10)) {
      setError('Completion date cannot be in the future.')
      return
    }
    if (progressAction === 'for_review' && startedOn && completedOn && startedOn > completedOn) {
      setError('Started date cannot be after completion date.')
      return
    }
    if (progressAction === 'for_review' && status !== 'InProgress') {
      setError('Task must be In Progress before submitting for review.')
      return
    }
    if (!notes.trim()) {
      setError('Progress note is required.')
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
        body: JSON.stringify({
          notes: progressAction === 'blocked' && blockedReason.trim()
            ? `${notes.trim() || 'Task blocked.'}\n\nBlocker: ${blockedReason.trim()}`
            : (notes.trim() || null),
          media_urls: mediaUrls,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to save update')
        setSubmitting(false)
        return
      }
      const { update, newStatus } = await res.json()
      let finalStatus = newStatus as string

      // Apply selected status transition after saving progress note
      if (progressAction !== 'keep') {
        const payload: Record<string, unknown> = {}
        if (progressAction === 'for_review') {
          payload.status = 'InReview'
          payload.actual_mandays = Number(actualMandays)
          payload.actual_start = startedOn
          payload.actual_date = completedOn
        } else if (progressAction === 'blocked') {
          payload.status = 'Blocked'
          payload.blocked_reason = blockedReason.trim()
        } else if (progressAction === 'resume') {
          payload.status = 'InProgress'
        }

        if (payload.status) {
          const statusRes = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!statusRes.ok) {
            const err = await statusRes.json().catch(() => null)
            setError(err?.error ?? 'Failed to update task status.')
            setSubmitting(false)
            return
          }
          const updatedTask = await statusRes.json()
          finalStatus = updatedTask.status ?? finalStatus
        }
      } else if (status === 'Todo') {
        // Treat first progress update on Todo as task started; allow backdated start date.
        const statusRes = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'InProgress',
            actual_date: startedOn,
          }),
        })
        if (!statusRes.ok) {
          const err = await statusRes.json().catch(() => null)
          setError(err?.error ?? 'Failed to set task as started.')
          setSubmitting(false)
          return
        }
        const updatedTask = await statusRes.json()
        finalStatus = updatedTask.status ?? finalStatus
      } else if (status === 'InProgress' && startedOn) {
        // Allow adjusting started date for backdated in-progress tasks.
        const startRes = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actual_start: startedOn,
          }),
        })
        if (!startRes.ok) {
          const err = await startRes.json().catch(() => null)
          setError(err?.error ?? 'Failed to update started date.')
          setSubmitting(false)
          return
        }
      }

      setUpdates((prev) => [update, ...prev])
      setNotes('')
      setFiles([])
      setPreviews([])
      setStatus(finalStatus)
      onStatusChange(taskId, finalStatus)
      setBlockedReason('')
      await loadHistory()
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
    const invalid = newFiles.find(f => !ATTACHMENT_ACCEPT.includes(f.type))
    if (invalid) {
      setReviewError(`${invalid.name} is not supported. Upload images, PDF, DOCX, or XLSX only.`)
      return
    }
    setReviewError('')
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
      await loadHistory()
    } finally {
      setReviewing(false)
    }
  }

  // Form is locked when task is in review (for developer) or done
  // Manager can comment on Todo/InProgress; InReview handled by review panel
  const formLocked = status === 'Done' || status === 'InReview'
  const remainingMandays =
    deliverableBudgetMandays != null && deliverableUsedMandays != null
      ? deliverableBudgetMandays - deliverableUsedMandays
      : null
  const taskPlannedStartLabel = taskPlannedStartDate
    ? new Date(taskPlannedStartDate).toLocaleDateString('en-GB')
    : '—'
  const dueDateLabel = dueDate
    ? new Date(dueDate).toLocaleDateString('en-GB')
    : '—'
  const plannedStartLabel = deliverablePlannedStart
    ? new Date(deliverablePlannedStart).toLocaleDateString('en-GB')
    : '—'
  const plannedDueLabel = (deliverablePlannedEnd || dueDate)
    ? new Date(deliverablePlannedEnd || dueDate || '').toLocaleDateString('en-GB')
    : '—'
  const startedOnLabel = actualStartDate
    ? new Date(actualStartDate).toLocaleDateString('en-GB')
    : '—'
  const completedOnLabel = actualEndDate
    ? new Date(actualEndDate).toLocaleDateString('en-GB')
    : '—'
  const scopeHeadline = taskScope?.trim() || taskTitle
  const deliverableProjectLine = [featureTitle, projectTitle].filter(Boolean).join(' · ')
  const budgetLabel = deliverableBudgetMandays != null ? `${Number(deliverableBudgetMandays).toFixed(1)} md` : '—'
  const allocatedMdLabel = estMandays != null ? `${Number(estMandays).toFixed(1)} md` : '—'
  const remainingLabel = remainingMandays != null ? `${remainingMandays.toFixed(1)} md` : '—'
  const actualMandaysNumber = actualMandays ? Number(actualMandays) : null
  const allocatedMandaysNumber = estMandays != null ? Number(estMandays) : null
  const isOverAllocated =
    actualMandaysNumber != null &&
    allocatedMandaysNumber != null &&
    Number.isFinite(actualMandaysNumber) &&
    Number.isFinite(allocatedMandaysNumber) &&
    actualMandaysNumber > allocatedMandaysNumber
  const overAllocatedBy = isOverAllocated && actualMandaysNumber != null && allocatedMandaysNumber != null
    ? actualMandaysNumber - allocatedMandaysNumber
    : 0
  const headerUtilizedMd =
    initialActualMandays != null
      ? `${Number(initialActualMandays).toFixed(1)} md`
      : actualMandays
        ? `${Number(actualMandays).toFixed(1)} md`
        : '—'
  const utilizedAllocatedLabel = `${headerUtilizedMd} / ${allocatedMdLabel}`
  const todayInput = new Date().toISOString().slice(0, 10)
  const hasDevReference = Boolean(devCategory?.trim() || devScope?.trim() || devTask?.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-navy-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-slate-900 dark:text-white text-base leading-tight break-words">
              <span className="text-slate-400 dark:text-slate-500 text-sm">Task:</span>{' '}
              {scopeHeadline}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 break-words">{deliverableProjectLine || '—'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 break-words">
              <span className="font-medium">Deliv Planned:</span> <span className="text-slate-700 dark:text-slate-200">{plannedStartLabel} / {plannedDueLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Task Est:</span> <span className="text-slate-700 dark:text-slate-200">{taskPlannedStartLabel} / {dueDateLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Remaining/Budget MD:</span> <span className={`${remainingMandays != null && remainingMandays < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{remainingLabel} / {budgetLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Started On:</span> <span className="text-slate-700 dark:text-slate-200">{startedOnLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Completed On:</span> <span className="text-slate-700 dark:text-slate-200">{completedOnLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Utilized/Allocated MD:</span> <span className={isOverAllocated ? 'font-semibold text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}>{utilizedAllocatedLabel}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">&gt;</span>
              <span className="font-medium">Created By:</span> <span className="text-slate-700 dark:text-slate-200">{createdByName || '—'}</span>
            </p>
            {hasDevReference && (
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug">
                {devCategory?.trim() && <span className="font-medium text-emerald-700 dark:text-emerald-300">{devCategory.trim()}</span>}
                {devCategory?.trim() && devScope?.trim() && <span className="text-slate-300 dark:text-slate-600">›</span>}
                {devScope?.trim() && <span className="font-medium text-sky-700 dark:text-sky-300">{devScope.trim()}</span>}
                {(devCategory?.trim() || devScope?.trim()) && devTask?.trim() && <span className="text-slate-300 dark:text-slate-600">›</span>}
                {devTask?.trim() && <span className="font-medium text-violet-700 dark:text-violet-300">{devTask.trim()}</span>}
              </div>
            )}
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
                  <input ref={reviewFileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT_ATTR} className="hidden" onChange={e => handleReviewFiles(e.target.files)} />
                  {reviewPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {reviewPreviews.map((url, i) => (
                        <div key={i} className="relative group w-16 h-16 shrink-0">
                          {isDoc(reviewFiles[i]?.name ?? '') ? (
                            <div className="w-16 h-16 flex flex-col items-center justify-center rounded border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 gap-0.5">
                              <span className="text-xl">{docLabel(reviewFiles[i]?.name ?? '').icon}</span>
                              <span className="text-[9px] font-semibold text-yellow-700 dark:text-yellow-400 uppercase">{docLabel(reviewFiles[i]?.name ?? '').ext}</span>
                            </div>
                          ) : isVideo(reviewFiles[i]?.name ?? '') ? (
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
                {/* Mandays — above Note */}
                <hr className="border-slate-100 dark:border-navy-700 mb-3" />

                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Progress Note <span className="text-red-500">*</span>
                </label>
                {isManager && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">
                    Friendly check-in: ask task owner whether this task is completed, current blockers, and next step.
                  </p>
                )}
                <textarea
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder={isManager ? 'Example: Hi, is this task completed? If not, what is the current progress, blocker, and next action?' : status === 'Todo' ? 'Add a note to start working on this task...' : 'Describe what you\'ve done, blockers, or next steps...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Update Option</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Task owner: pilih <span className="font-medium text-green-600 dark:text-green-300">Completed &amp; For Review</span>, semak <span className="font-medium">MD utilized (auto)</span>, kemudian submit.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer ${progressAction === 'keep' ? 'border-blue-400 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400'}`}>
                      <input type="radio" className="sr-only" checked={progressAction === 'keep'} onChange={() => setProgressAction('keep')} />
                      {status === 'Todo' ? 'Started / In Progress' : 'Keep Current Status'}
                    </label>
                    {status === 'InProgress' && (
                      <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer ${progressAction === 'for_review' ? 'border-green-400 text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400'}`}>
                        <input type="radio" className="sr-only" checked={progressAction === 'for_review'} onChange={() => setProgressAction('for_review')} />
                        Completed &amp; For Review
                      </label>
                    )}
                    {(status === 'InProgress' || status === 'Todo') && (
                      <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer ${progressAction === 'blocked' ? 'border-red-400 text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400'}`}>
                        <input type="radio" className="sr-only" checked={progressAction === 'blocked'} onChange={() => setProgressAction('blocked')} />
                        Blocked
                      </label>
                    )}
                    {status === 'Blocked' && (
                      <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer ${progressAction === 'resume' ? 'border-amber-400 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400'}`}>
                        <input type="radio" className="sr-only" checked={progressAction === 'resume'} onChange={() => setProgressAction('resume')} />
                        Resume In Progress
                      </label>
                    )}
                  </div>

                  {(status === 'Todo' || status === 'InProgress') && progressAction === 'keep' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Started on:</label>
                      <input
                        type="date"
                        value={startedOn}
                        min={deliverablePlannedStart?.slice(0, 10)}
                        max={todayInput}
                        onChange={(e) => setStartedOn(e.target.value)}
                        className="w-40 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {progressAction === 'for_review' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Allocated: <strong className="text-slate-700 dark:text-slate-200">{estMandays != null ? `${Number(estMandays).toFixed(1)}` : '—'} md</strong>
                        </span>
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">MD utilized:</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={actualMandays}
                          readOnly
                          className="w-24 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-400">md</span>
                        {isOverAllocated && (
                          <span className="inline-flex items-center rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-300">
                            Over allocated by {overAllocatedBy.toFixed(1)} md
                          </span>
                        )}
                      </div>
                      {isOverAllocated && (
                        <p className="text-xs text-red-500 dark:text-red-400">
                          Indicator: actual utilized mandays exceeds allocated mandays for this task.
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Started on:</label>
                        <input
                          type="date"
                          value={startedOn}
                          min={deliverablePlannedStart?.slice(0, 10)}
                          max={todayInput}
                          onChange={(e) => setStartedOn(e.target.value)}
                          className="w-40 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Completed on:</label>
                        <input
                          type="date"
                          value={completedOn}
                          min={startedOn || undefined}
                          max={todayInput}
                          onChange={(e) => setCompletedOn(e.target.value)}
                          className="w-40 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {progressAction === 'blocked' && (
                    <input
                      type="text"
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      placeholder="What is blocking this task?"
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                  )}
                </div>

                <div
                  onDragEnter={(e) => { e.preventDefault(); setDraggingFiles(true) }}
                  onDragOver={(e) => { e.preventDefault(); setDraggingFiles(true) }}
                  onDragLeave={(e) => { e.preventDefault(); setDraggingFiles(false) }}
                  onDrop={handleDrop}
                  className={`mt-3 rounded-lg border border-dashed px-4 py-3 transition-colors ${draggingFiles
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                    : 'border-slate-300 bg-slate-50/70 dark:border-navy-600 dark:bg-navy-900/40'
                    }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop attachments here</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Multiple images, PDF, DOCX, XLSX. Max {MAX_ATTACHMENT_FILES} files, 50MB each.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-navy-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-700 transition-colors"
                    >
                      <span>Attach</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ATTACHMENT_ACCEPT_ATTR}
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  {previews.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 mb-1.5">{previews.length} file{previews.length > 1 ? 's' : ''} attached</p>
                      <div className="flex flex-wrap gap-2">
                        {previews.map((url, i) => {
                          const file = files[i]
                          const name = file?.name ?? ''
                          const isImage = file?.type.startsWith('image/')
                          const doc = docLabel(name)
                          return (
                            <div key={i} className="relative group w-24 shrink-0">
                              {isImage ? (
                                <img src={url} alt="" className="w-24 h-20 object-cover rounded-lg border border-slate-200 dark:border-navy-600" />
                              ) : (
                                <div className="w-24 h-20 flex flex-col items-center justify-center rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 gap-1">
                                  <span className="text-xl">{doc.icon}</span>
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase">{doc.ext}</span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >×</button>
                              <p className="text-xs text-slate-400 truncate w-24 mt-0.5 text-center">{name}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-end mt-3 gap-2 flex-wrap">

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
                    >
                      {submitting
                        ? 'Saving...'
                        : progressAction === 'for_review'
                          ? 'Submit For Review'
                          : progressAction === 'blocked'
                            ? 'Save As Blocked'
                            : status === 'Todo'
                              ? 'Start Task & Save'
                              : 'Save Progress'}
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
                  const isStatusEntry = u.entry_type === 'status'
                  const isMgrEntry = u.user.role === 'manager'
                  const movedToReviewDate = u.actual_date ? new Date(u.actual_date).toLocaleDateString('en-GB') : null
                  return (
                    <div key={String(u.id)} className={`flex gap-3 rounded-lg p-2 -mx-2 ${isStatusEntry ? 'bg-violet-50 dark:bg-violet-950/20' : isMgrEntry ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${isStatusEntry ? 'bg-violet-200 dark:bg-violet-800/50 text-violet-700 dark:text-violet-300' : isMgrEntry ? 'bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300'}`}>
                        {u.user.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isStatusEntry ? 'text-violet-700 dark:text-violet-300' : isMgrEntry ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{u.user.name}</span>
                          {isStatusEntry && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                              Status
                            </span>
                          )}
                          {isMgrEntry && !isStatusEntry && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 uppercase tracking-wide">Review</span>}
                          <span className="text-xs text-slate-400">{timeAgo(u.created_at)}</span>
                        </div>
                        {isStatusEntry && (
                          <p className="text-sm mt-0.5 text-violet-700 dark:text-violet-300 font-medium">
                            {u.event_label || 'Status updated'}
                            {movedToReviewDate ? ` (${movedToReviewDate})` : ''}
                          </p>
                        )}
                        {u.notes && <p className={`text-sm mt-0.5 whitespace-pre-wrap ${isStatusEntry ? 'text-violet-700 dark:text-violet-300' : isMgrEntry ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>{u.notes}</p>}
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
