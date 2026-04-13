'use client'

import { useState, useEffect } from 'react'
import IssueFormModal from './IssueFormModal'

interface Props {
  projectId: number
  initialCount: number
}

export default function IssueButton({ projectId, initialCount }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [openCount, setOpenCount] = useState(initialCount)

  // Re-fetch count when an issue is created
  useEffect(() => {
    const refresh = () => {
      fetch(`/api/projects/${projectId}/issues?issue_status=open`)
        .then(r => r.json())
        .then((data: unknown[]) => setOpenCount(data.length))
        .catch(() => {})
    }
    window.addEventListener('issue-created', refresh)
    return () => window.removeEventListener('issue-created', refresh)
  }, [projectId])

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
      >
        <span>+ Issue</span>
        {openCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {openCount}
          </span>
        )}
      </button>

      {showModal && (
        <IssueFormModal
          context={{ project_id: projectId }}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            window.dispatchEvent(new Event('issue-created'))
          }}
        />
      )}
    </>
  )
}
