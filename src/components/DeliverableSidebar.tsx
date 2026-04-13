'use client'

import { useState, useEffect } from 'react'
import { X, Layers } from 'lucide-react'
import DeliverableSection from './DeliverableSection'

interface Props {
  projectId: number
  userRole: string
  projectStartDate: string
  projectDeadline: string
}

export default function DeliverableSidebar({ projectId, userRole, projectStartDate, projectDeadline }: Props) {
  const [open, setOpen] = useState(false)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Floating trigger tab — fixed to right edge */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-4 px-2.5 rounded-l-xl shadow-lg transition-colors group"
        title="Open Modules & Deliverables"
      >
        <Layers className="w-4 h-4" />
        <span
          className="text-[10px] font-semibold tracking-wide uppercase"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Modules & Tasks
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-full sm:w-1/2 bg-white dark:bg-navy-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Notch / drag handle at top */}
        <div className="flex justify-center pt-2 pb-0 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-navy-600" />
        </div>

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Modules &amp; Deliverables</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {open && (
            <DeliverableSection
              projectId={projectId}
              userRole={userRole}
              projectStartDate={projectStartDate}
              projectDeadline={projectDeadline}
            />
          )}
        </div>
      </div>
    </>
  )
}
