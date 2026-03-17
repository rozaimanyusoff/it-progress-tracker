'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'

export default function NewProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [units, setUnits] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', description: '', unit_id: '', owner_id: '', start_date: '', deadline: '', status: 'Pending',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const user = session?.user as any

  useEffect(() => {
    fetch('/api/units').then(r => r.json()).then(setUnits)
  }, [])

  useEffect(() => {
    if (form.unit_id) {
      fetch(`/api/users?unit_id=${form.unit_id}`).then(r => r.json()).then(setMembers)
    } else {
      fetch('/api/users').then(r => r.json()).then(setMembers)
    }
  }, [form.unit_id])

  if (user?.role !== 'manager') {
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-400">Access denied. Manager only.</div>
      </AppLayout>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">New Project</h1>
          <p className="text-slate-400 mt-1">Create a new project and assign to a team member</p>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Title *</label>
              <input
                type="text" required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Unit *</label>
                <select required
                  value={form.unit_id}
                  onChange={e => setForm({ ...form, unit_id: e.target.value, owner_id: '' })}
                  className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
                >
                  <option value="">Select unit...</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">PIC (Owner) *</label>
                <select required
                  value={form.owner_id}
                  onChange={e => setForm({ ...form, owner_id: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
                >
                  <option value="">Select member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date *</label>
                <input type="date" required
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Deadline *</label>
                <input type="date" required
                  value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Initial Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: '#0a1628', borderColor: '#1e3a5f' }}
              >
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
              <button type="button" onClick={() => router.back()} className="flex-1 border border-slate-600 text-slate-400 hover:text-white py-2.5 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
