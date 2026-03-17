'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

type Unit = { id: number; name: string }
type User = {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  unit: Unit | null
}

export default function UserManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [form, setForm] = useState({ name: '', email: '', role: 'member', unit_id: '' })

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as any).role !== 'manager') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/units').then(r => r.json()),
    ]).then(([u, un]) => {
      setUsers(u)
      setUnits(un)
      setLoading(false)
    })
  }, [])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        unit_id: form.unit_id || null,
      }),
    })
    setSubmitting(false)

    if (res.ok) {
      const fresh = await fetch('/api/admin/users').then(r => r.json())
      setUsers(fresh)
      setForm({ name: '', email: '', role: 'member', unit_id: '' })
      setShowForm(false)
      showToast('success', `Invitation sent to ${form.email}`)
    } else {
      const data = await res.json()
      showToast('error', data.error || 'Failed to add user')
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Remove ${user.name} from the system? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id))
      showToast('success', `${user.name} has been removed`)
    } else {
      showToast('error', 'Failed to remove user')
    }
  }

  async function handleResend(user: User) {
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'POST' })
    if (res.ok) {
      showToast('success', `Activation email resent to ${user.email}`)
    } else {
      const data = await res.json()
      showToast('error', data.error || 'Failed to resend')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">Team Members</h1>
            <p className="text-slate-400 text-sm mt-0.5">{users.length} member{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add Member
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-slate-700 p-6 mb-6" style={{ backgroundColor: '#0f1f35' }}>
            <h2 className="text-white font-semibold mb-4">Add New Member</h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ahmad Razif"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. ahmad@company.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Unit</label>
                <select
                  value={form.unit_id}
                  onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">— No unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-xl border border-slate-700 overflow-hidden" style={{ backgroundColor: '#0f1f35' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3 font-medium">Name</th>
                <th className="text-left px-6 py-3 font-medium">Unit</th>
                <th className="text-left px-6 py-3 font-medium">Role</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-right px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors ${i === users.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-slate-400 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{user.unit?.name ?? <span className="text-slate-500">—</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'manager' ? 'bg-purple-900/50 text-purple-300' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!user.is_active && (
                        <button
                          onClick={() => handleResend(user)}
                          className="px-3 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 rounded-md transition-colors"
                        >
                          Resend
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user)}
                        className="px-3 py-1 text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-md transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No members yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
