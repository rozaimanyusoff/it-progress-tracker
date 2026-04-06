'use client'

import { useState, useEffect } from 'react'

export type StatusTarget = 'InProgress' | 'InReview' | 'Done' | 'Blocked' | 'Unblock'

interface Props {
   taskId: number
   taskTitle: string
   targetStatus: StatusTarget
   /** Pass the task's actual_start (as ISO string) so InReview can validate date >= actual_start */
   actualStartDate?: string | null
   /** Pass due_date so InProgress can validate minimum date */
   dueDate?: string | null
   /** Managers can select any past date without min restriction */
   isManager?: boolean
   onConfirm: (taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) => void
   onCancel: () => void
}

const STATUS_CONFIG: Record<StatusTarget, { title: (t: string) => string; message: string; showDate: boolean; showReason: boolean }> = {
   InProgress: {
      title: (t) => `Starting: ${t}`,
      message: 'When did you actually start this task?',
      showDate: true,
      showReason: false,
   },
   InReview: {
      title: (t) => `Submitting for review: ${t}`,
      message: 'When did you actually finish this task?',
      showDate: true,
      showReason: false,
   },
   Done: {
      title: (t) => `Completing: ${t}`,
      message: 'Confirm actual completion date:',
      showDate: true,
      showReason: false,
   },
   Blocked: {
      title: (t) => `Blocking: ${t}`,
      message: '',
      showDate: false,
      showReason: true,
   },
   Unblock: {
      title: (t) => `Unblocking: ${t}`,
      message: 'Return task to In Progress?',
      showDate: false,
      showReason: false,
   },
}

function todayStr() {
   return new Date().toISOString().slice(0, 10)
}

export default function StatusChangeModal({ taskId, taskTitle, targetStatus, actualStartDate, dueDate, isManager, onConfirm, onCancel }: Props) {
   const cfg = STATUS_CONFIG[targetStatus]
   const [date, setDate] = useState(todayStr())
   const [reason, setReason] = useState('')
   const [error, setError] = useState('')

   // Set sensible date defaults
   useEffect(() => {
      if (targetStatus === 'Done' && actualStartDate) {
         setDate(actualStartDate.slice(0, 10))
      } else {
         setDate(todayStr())
      }
   }, [targetStatus, actualStartDate])

   // Date constraints
   const today = todayStr()
   // Managers can backdate freely — only apply min restriction for members
   const minDate = isManager ? undefined : (() => {
      if (targetStatus === 'InProgress') {
         if (dueDate) {
            const d = new Date(dueDate)
            d.setDate(d.getDate() - 90)
            return d.toISOString().slice(0, 10)
         }
      }
      if (targetStatus === 'InReview' && actualStartDate) {
         return actualStartDate.slice(0, 10)
      }
      if (targetStatus === 'Done' && actualStartDate) {
         return actualStartDate.slice(0, 10)
      }
      return undefined
   })()

   function handleConfirm() {
      setError('')
      if (cfg.showDate) {
         if (!date) { setError('Date is required.'); return }
         if (date > today) { setError('Date cannot be in the future.'); return }
         if (minDate && date < minDate) { setError(`Date cannot be before ${minDate}.`); return }
      }
      if (cfg.showReason && !reason.trim()) {
         setError('Reason is required.')
         return
      }

      const opts: { actual_date?: string; blocked_reason?: string } = {}
      if (cfg.showDate) opts.actual_date = date
      if (cfg.showReason) opts.blocked_reason = reason.trim()

      const newStatus = targetStatus === 'Unblock' ? 'InProgress' : targetStatus
      onConfirm(taskId, newStatus, opts)
   }

   const displayTitle = cfg.title(taskTitle.length > 40 ? taskTitle.slice(0, 40) + '…' : taskTitle)

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
         <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{displayTitle}</h2>

            {cfg.message && (
               <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{cfg.message}</p>
            )}

            {cfg.showDate && (
               <div className="mb-4">
                  <input
                     type="date"
                     className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                     value={date}
                     max={today}
                     min={minDate}
                     onChange={(e) => setDate(e.target.value)}
                  />
               </div>
            )}

            {cfg.showReason && (
               <div className="mb-4 space-y-2">
                  <textarea
                     className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                     placeholder="Reason for blocking this task... (required)"
                     rows={3}
                     maxLength={500}
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 text-right">{reason.length}/500</p>
               </div>
            )}

            {error && (
               <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
               <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
               >
                  Cancel
               </button>
               <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-sm rounded-lg font-medium text-white ${targetStatus === 'Blocked'
                        ? 'bg-red-500 hover:bg-red-600'
                        : targetStatus === 'Unblock'
                           ? 'bg-green-500 hover:bg-green-600'
                           : 'bg-blue-600 hover:bg-blue-700'
                     }`}
               >
                  {targetStatus === 'Unblock' ? 'Unblock' : 'Confirm'}
               </button>
            </div>
         </div>
      </div>
   )
}
