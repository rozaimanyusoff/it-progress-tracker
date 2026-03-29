'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'

export default function NewProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', description: '', assignee_ids: [] as number[], start_date: '', deadline: '', status: 'Pending',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const user = session?.user as any

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [])

  if (user?.role !== 'manager') {
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-400">Access denied. Manager only.</div>
      </AppLayout>
    )
  }

  function toggleAssignee(id: number) {
    setForm(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(id)
        ? prev.assignee_ids.filter(x => x !== id)
        : [...prev.assignee_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.assignee_ids.length === 0) {
      setError('Please select at least one assignee.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      router.push('/manager')
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create project')
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Project</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create a new project and assign team members</p>
        </div>

        <div className="rounded-xl border p-6 bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className={labelClass}>Project Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-24 resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Assignees *</label>
              <div className="rounded-lg border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 divide-y divide-slate-200 dark:divide-navy-700">
                {members.map(m => (
                  <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.assignee_ids.includes(m.id)}
                      onChange={() => toggleAssignee(m.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200">{m.name}</span>
                    <span className="text-xs text-slate-400 ml-auto">{m.email}</span>
                  </label>
                ))}
                {members.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">No members available.</p>
                )}
              </div>
              {form.assignee_ids.length > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{form.assignee_ids.length} member(s) selected</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Date *</label>
                <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Deadline *</label>
                <input type="date" required value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Initial Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                <option value="Pending">Pending</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
                <option value="OnHold">On Hold</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {saving ? 'Creating...' : 'Create Project'}
              </button>
              <button type="button" onClick={() => router.back()} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2.5 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
