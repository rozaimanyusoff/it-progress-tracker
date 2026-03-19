'use client'

import { useState, useEffect } from 'react'

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
  featureId: number
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

export default function FeatureTaskList({ featureId, userRole, developers }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [featureId])

  async function fetchTasks() {
    setLoading(true)
    const res = await fetch(`/api/tasks?feature_id=${featureId}`)
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

  async function deleteTask(taskId: number) {
    if (!confirm('Delete this custom task?')) return
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function addCustomTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature_id: featureId,
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
            {userRole === 'manager' && <th className="px-3 py-2 w-8"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/30">
              <td className="px-3 py-2 text-slate-400">{task.order}</td>
              <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                {task.title}
                {task.is_predefined && (
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">SDLC</span>
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
              {userRole === 'manager' && (
                <td className="px-3 py-2">
                  {!task.is_predefined && (
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="Delete task"
                    >
                      ✕
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
    </div>
  )
}
