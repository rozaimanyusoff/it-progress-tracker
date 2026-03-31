'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface Task {
  id: number
  title: string
  status: string
  order: number
  is_predefined: boolean
  assigned_to: number | null
  assignee: { id: number; name: string } | null
}

interface Developer {
  user: { id: number; name: string }
}

interface Props {
  featureId?: number
  deliverableId?: number
  userRole: string
  developers: Developer[]
}

const STATUS_OPTIONS = ['Todo', 'InProgress', 'InReview', 'Done']
const STATUS_LABELS: Record<string, string> = {
  Todo: 'To Do',
  InProgress: 'In Progress',
  InReview: 'In Review',
  Done: 'Done',
}
const STATUS_COLORS: Record<string, string> = {
  Todo: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  InReview: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export default function FeatureTaskList({ featureId, deliverableId, userRole, developers }: Props) {
  const { data: session } = useSession()
  const currentUserId = Number((session?.user as any)?.id)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [featureId, deliverableId])

  async function fetchTasks() {
    setLoading(true)
    const param = featureId ? `feature_id=${featureId}` : `deliverable_id=${deliverableId}`
    const res = await fetch(`/api/tasks?${param}`)
    const data = await res.json()
    setTasks(data)
    setLoading(false)
  }

  async function updateTaskStatus(taskId: number, status: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
    }
  }

  async function updateTaskAssignee(taskId: number, assigneeId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assigneeId ? Number(assigneeId) : null }),
    })
    if (res.ok) {
      const dev = developers.find((d) => d.user.id === Number(assigneeId))
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, assigned_to: assigneeId ? Number(assigneeId) : null, assignee: dev ? dev.user : null }
            : t
        )
      )
    }
  }

  async function saveTaskTitle(taskId: number) {
    if (!editingTitle.trim()) return
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTitle.trim() }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: editingTitle.trim() } : t))
      setEditingTaskId(null)
    }
  }

  async function deleteTask(taskId: number, taskTitle: string) {
    setDeleteConfirm({ id: taskId, title: taskTitle })
  }

  async function confirmDeleteTask() {
    if (!deleteConfirm) return
    setDeleting(true)
    const res = await fetch(`/api/tasks/${deleteConfirm.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    }
  }

  async function addCustomTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(featureId ? { feature_id: featureId } : { deliverable_id: deliverableId }),
        title: newTaskTitle,
        assigned_to: newTaskAssignee ? Number(newTaskAssignee) : null,
      }),
    })
    if (res.ok) {
      const task = await res.json()
      setTasks((prev) => [...prev, task])
      setNewTaskTitle('')
      setNewTaskAssignee('')
      setShowAddTask(false)
    }
    setAddingTask(false)
  }

  if (loading) return <div className="py-4 text-center text-sm text-slate-500">Loading tasks...</div>

  const inputClass = 'bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="mt-3 border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-navy-900 text-left">
            <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-8">#</th>
            <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Task</th>
            <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Assignee</th>
            <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
          {tasks.map((task) => (
            <tr key={task.id} className={`${task.status === 'Done'
              ? 'bg-green-50 dark:bg-green-900/10'
              : 'hover:bg-slate-50 dark:hover:bg-navy-700/30'
              }`}>
              <td className="px-3 py-2 text-slate-400">{task.order}</td>
              <td className={`px-3 py-2 ${task.status === 'Done'
                ? 'text-green-700 dark:text-green-400 line-through decoration-green-400/60'
                : 'text-slate-800 dark:text-slate-200'
                }`}>
                {editingTaskId === task.id ? (
                  <input
                    className={`${inputClass} w-full`}
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTaskTitle(task.id); if (e.key === 'Escape') setEditingTaskId(null) }}
                    autoFocus
                  />
                ) : (
                  <>
                    {task.title}
                    {task.is_predefined && (
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">SDLC</span>
                    )}
                  </>
                )}
              </td>
              <td className="px-3 py-2">
                {userRole === 'manager' ? (
                  <select
                    className={inputClass}
                    value={task.assigned_to?.toString() ?? ''}
                    onChange={(e) => updateTaskAssignee(task.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {developers.map((d) => (
                      <option key={d.user.id} value={d.user.id}>{d.user.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300">{task.assignee?.name ?? '—'}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {userRole === 'manager' ? (
                  <select
                    className={`${inputClass} text-xs`}
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                )}
              </td>
              {userRole === 'manager' ? (
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {editingTaskId === task.id ? (
                      <>
                        <button onClick={() => saveTaskTitle(task.id)} className="p-1 rounded text-green-500 hover:text-green-700" title="Save"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingTaskId(null)} className="p-1 rounded text-slate-400 hover:text-slate-600" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingTaskId(task.id); setEditingTitle(task.title) }}
                          className="p-1 rounded text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300"
                          title="Edit task"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!task.is_predefined && (
                          <button
                            onClick={() => deleteTask(task.id, task.title)}
                            className="p-1 rounded text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              ) : (
                <td className="px-3 py-2">
                  {!task.is_predefined && task.status === 'Todo' && task.assigned_to === currentUserId && (
                    <button
                      onClick={() => deleteTask(task.id, task.title)}
                      className="p-1 rounded text-red-400 hover:text-red-600"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {userRole === 'manager' && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-navy-700">
          {!showAddTask ? (
            <button
              onClick={() => setShowAddTask(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add Custom Task
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className={`${inputClass} flex-1 min-w-40`}
                placeholder="Task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomTask()}
              />
              <select
                className={inputClass}
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {developers.map((d) => (
                  <option key={d.user.id} value={d.user.id}>{d.user.name}</option>
                ))}
              </select>
              <button
                onClick={addCustomTask}
                disabled={addingTask}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddTask(false); setNewTaskTitle('') }}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Delete Task</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Delete <span className="font-medium text-slate-700 dark:text-slate-300">"{deleteConfirm.title}"</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteTask}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
