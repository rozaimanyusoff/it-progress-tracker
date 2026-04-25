'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Pencil, Trash2, PauseCircle, PlayCircle } from 'lucide-react'
import OrgSelect from '@/components/OrgSelect'

// ── Types ─────────────────────────────────────────────────────────
type OrgItem = { id: number; name: string }
type User = {
  id: number; name: string; email: string; role: string; is_active: boolean
  unit_id: number | null; dept_id: number | null; company_id: number | null
  unit: OrgItem | null; department: OrgItem | null; company: OrgItem | null
}
type Feature = {
  id: number; title: string; description: string | null; mandays: number
  planned_start: string; planned_end: string; status: string
  module: { id: number; title: string } | null
  project: { id: number; title: string }
}
type Project = { id: number; title: string }
type Settings = {
  brand_name: string; brand_logo_url: string; login_bg_url: string; theme_color: string
  smtp_host: string; smtp_port: string; smtp_user: string; smtp_from: string
}

type CrudPermission = { create: boolean; update: boolean; view: boolean; delete: boolean; receive_notifications: boolean; assignable: boolean }
type RolePreferences = Record<string, CrudPermission>

const DEFAULT_ROLE_PREFERENCES: RolePreferences = {
  manager: { create: true, update: true, view: true, delete: true, receive_notifications: true, assignable: true },
  member: { create: true, update: true, view: true, delete: false, receive_notifications: true, assignable: true },
}

const TABS = ['Team Members', 'Roles', 'Organisation', 'Branding', 'Email', 'Database', 'Backup & Restore', 'Audit Logs'] as const
type Tab = typeof TABS[number]

const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

// ── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {msg}
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────
function EditUserModal({ user, roleOptions, onClose, onSaved, showToast }: {
  user: User
  roleOptions: string[]
  onClose: () => void
  onSaved: (updated: User) => void
  showToast: (t: 'success' | 'error', m: string) => void
}) {
  const [form, setForm] = useState({
    name: user.name,
    initials: '',
    contact_number: '',
    role: user.role,
    unit_id: user.unit_id,
    dept_id: user.dept_id,
    company_id: user.company_id,
  })
  const [saving, setSaving] = useState(false)

  // Fetch existing profile fields (initials, contact_number) from admin context
  useEffect(() => {
    fetch(`/api/admin/users/${user.id}/profile`).then(r => r.json()).then(d => {
      setForm(f => ({ ...f, initials: d.initials ?? '', contact_number: d.contact_number ?? '' }))
    }).catch(() => { })
  }, [user.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        initials: form.initials,
        contact_number: form.contact_number,
        role: form.role,
        unit_id: form.unit_id,
        dept_id: form.dept_id,
        company_id: form.company_id,
      }),
    })
    setSaving(false)
    if (res.ok) { onSaved(await res.json()); showToast('success', `${form.name} updated`) }
    else showToast('error', (await res.json()).error || 'Failed to update')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit User</h2>
          <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Razif" />
          </div>
          <div>
            <label className={labelClass}>Initials <span className="text-slate-400 font-normal">(up to 3 chars)</span></label>
            <input className={inputClass} value={form.initials} onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase().slice(0, 3) }))} placeholder="AR" maxLength={3} />
          </div>
          <div>
            <label className={labelClass}>Contact Number</label>
            <input className={inputClass} value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} placeholder="+60 12-345 6789" type="tel" />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {roleOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <OrgSelect type="unit" label="Unit" value={form.unit_id} onChange={id => setForm(f => ({ ...f, unit_id: id }))} />
          <OrgSelect type="dept" label="Department" value={form.dept_id} onChange={id => setForm(f => ({ ...f, dept_id: id }))} />
          <OrgSelect type="company" label="Company" value={form.company_id} onChange={id => setForm(f => ({ ...f, company_id: id }))} />
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors">{saving ? 'Saving...' : 'Save Changes'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team Members Tab ──────────────────────────────────────────────
function TeamTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'member' })
  const [editUser, setEditUser] = useState<User | null>(null)
  const [roleOptions, setRoleOptions] = useState<string[]>(['manager', 'member'])

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(u => { setUsers(Array.isArray(u) ? u : []); setLoading(false) })
    fetch('/api/settings').then(r => r.json()).then(s => {
      const prefs = s?.role_preferences && typeof s.role_preferences === 'object' ? s.role_preferences : {}
      const keys = Object.keys(prefs)
      const all = Array.from(new Set(['manager', 'member', ...keys]))
      setRoleOptions(all)
    }).catch(() => { })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch('/api/admin/users').then(r => r.json())
      setUsers(Array.isArray(fresh) ? fresh : []); setForm({ name: '', email: '', role: 'member' }); setShowForm(false)
      showToast('success', `Invitation sent to ${form.email}`)
    } else {
      showToast('error', (await res.json()).error || 'Failed to add user')
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Remove ${user.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== user.id)); showToast('success', `${user.name} removed`) }
    else showToast('error', 'Failed to remove user')
  }

  async function handleToggleSuspend(user: User) {
    const nextActive = !user.is_active
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: nextActive }),
    })
    if (res.ok) {
      const updated: User = await res.json()
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
      showToast('success', `${user.name} ${nextActive ? 'reactivated' : 'suspended'}`)
    } else showToast('error', 'Failed to update user')
  }

  async function handleResend(user: User) {
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'POST' })
    if (res.ok) showToast('success', `Activation email resent to ${user.email}`)
    else showToast('error', (await res.json()).error || 'Failed to resend')
  }

  if (loading) return <p className="text-slate-400 py-8 text-center">Loading...</p>

  return (
    <div>
      {editUser && (
        <EditUserModal
          user={editUser}
          roleOptions={roleOptions}
          onClose={() => setEditUser(null)}
          onSaved={updated => { setUsers(prev => prev.map(u => u.id === updated.id ? updated : u)); setEditUser(null) }}
          showToast={showToast}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
          + Add Member
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">New Member</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelClass}>Full Name</label><input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Razif" /></div>
            <div><label className={labelClass}>Email</label><input required type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ahmad@company.com" /></div>
            <div><label className={labelClass}>Role</label>
              <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {roleOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">{saving ? 'Sending...' : 'Send Invitation'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Unit / Dept</th>
              <th className="text-left px-5 py-3 font-medium">Role</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No members yet.</td></tr>}
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{user.name[0].toUpperCase()}</div>
                    <div><p className="font-medium text-slate-900 dark:text-white">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div>
                  </div>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {user.unit?.name && <p>{user.unit.name}</p>}
                    {user.department?.name && <p className="text-slate-400">{user.department.name}</p>}
                    {!user.unit && !user.department && <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'manager' ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{user.role}</span>
                </td>
                <td className="px-5 py-3">
                  {user.is_active
                    ? <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Active</span>
                    : <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>Pending</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {!user.is_active && (
                      <button onClick={() => handleResend(user)} className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800 rounded-md hover:border-blue-500">Resend</button>
                    )}
                    <button onClick={() => setEditUser(user)} title="Edit" className="p-1.5 rounded-md text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleSuspend(user)} title={user.is_active ? 'Suspend' : 'Reactivate'}
                      className={`p-1.5 rounded-md transition-colors ${user.is_active ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                      {user.is_active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(user)} title="Remove" className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Organisation Tab (Unit / Dept / Company CRUD) ─────────────────
type OrgSection = { type: 'unit' | 'dept' | 'company'; label: string }
const ORG_SECTIONS: OrgSection[] = [
  { type: 'unit', label: 'Units' },
  { type: 'dept', label: 'Departments' },
  { type: 'company', label: 'Companies' },
]

function OrgCrudSection({ type, label, showToast }: OrgSection & { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [items, setItems] = useState<OrgItem[]>([])
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/org?type=${type}`).then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
  }, [type])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return; setSaving(true)
    const res = await fetch('/api/org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name: newName.trim() }) })
    setSaving(false)
    if (res.ok) { const item = await res.json(); setItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name))); setNewName(''); showToast('success', `${label.slice(0, -1)} added`) }
    else showToast('error', (await res.json()).error || 'Failed to create')
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return
    const res = await fetch(`/api/org/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name: editName.trim() }) })
    if (res.ok) { const item = await res.json(); setItems(prev => prev.map(i => i.id === id ? item : i).sort((a, b) => a.name.localeCompare(b.name))); setEditId(null); showToast('success', 'Updated') }
    else showToast('error', (await res.json()).error || 'Failed to update')
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const res = await fetch(`/api/org/${id}?type=${type}`, { method: 'DELETE' })
    if (res.ok) { setItems(prev => prev.filter(i => i.id !== id)); showToast('success', 'Deleted') }
    else showToast('error', 'Failed to delete')
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 dark:bg-navy-700 border-b border-slate-200 dark:border-navy-700">
        <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{label}</h3>
      </div>
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">No {label.toLowerCase()} yet.</p>}
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            {editId === item.id ? (
              <>
                <input autoFocus className={`${inputClass} flex-1 text-xs`} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleUpdate(item.id); if (e.key === 'Escape') setEditId(null) }} />
                <button onClick={() => handleUpdate(item.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
                <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 rounded">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{item.name}</span>
                <button onClick={() => { setEditId(item.id); setEditName(item.name) }} className="p-1 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(item.id, item.name)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input className={`${inputClass} flex-1 text-xs`} placeholder={`Add new ${label.slice(0, -1).toLowerCase()}...`} value={newName} onChange={e => setNewName(e.target.value)} />
          <button type="submit" disabled={saving || !newName.trim()} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 shrink-0">+ Add</button>
        </form>
      </div>
    </div>
  )
}

function OrgTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">Manage organisation structure options used when editing user profiles.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {ORG_SECTIONS.map(s => <OrgCrudSection key={s.type} {...s} showToast={showToast} />)}
      </div>
    </div>
  )
}

// ── Roles Tab ────────────────────────────────────────────────────
function RolesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [prefs, setPrefs] = useState<RolePreferences>(DEFAULT_ROLE_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const initializedRef = useRef(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        const incoming = s?.role_preferences
        if (incoming && typeof incoming === 'object') {
          const loaded: RolePreferences = {}
          for (const [roleName, rolePerms] of Object.entries(incoming as Record<string, Partial<CrudPermission>>)) {
            loaded[roleName] = {
              create: Boolean(rolePerms?.create),
              update: Boolean(rolePerms?.update),
              view: Boolean(rolePerms?.view),
              delete: Boolean(rolePerms?.delete),
              receive_notifications: rolePerms?.receive_notifications !== undefined
                ? Boolean(rolePerms.receive_notifications)
                : (DEFAULT_ROLE_PREFERENCES[roleName]?.receive_notifications ?? true),
              assignable: rolePerms?.assignable !== undefined
                ? Boolean(rolePerms.assignable)
                : (DEFAULT_ROLE_PREFERENCES[roleName]?.assignable ?? true),
            }
          }
          setPrefs({
            ...loaded,
            manager: { ...DEFAULT_ROLE_PREFERENCES.manager, ...(loaded.manager ?? {}) },
            member: { ...DEFAULT_ROLE_PREFERENCES.member, ...(loaded.member ?? {}) },
          })
        } else {
          setPrefs(DEFAULT_ROLE_PREFERENCES)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }

    const timer = setTimeout(async () => {
      setSaving(true)
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_preferences: prefs }),
      })
      setSaving(false)
      if (!res.ok) showToast('error', 'Failed to auto-save role permissions')
    }, 450)

    return () => clearTimeout(timer)
  }, [prefs, loading, showToast])

  function addRole() {
    const normalized = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!normalized) {
      showToast('error', 'Role name is required')
      return
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
      showToast('error', 'Use letters, numbers, underscore only')
      return
    }
    if (prefs[normalized]) {
      showToast('error', 'Role already exists')
      return
    }
    setPrefs(prev => ({
      ...prev,
      [normalized]: { create: false, update: false, view: true, delete: false, receive_notifications: false, assignable: false },
    }))
    setNewRoleName('')
    showToast('success', `Role "${normalized}" added`)
  }

  function removeRole(role: string) {
    if (role === 'manager' || role === 'member') return
    if (!confirm(`Delete role "${role}"?`)) return
    setPrefs(prev => {
      const next = { ...prev }
      delete next[role]
      return next
    })
    showToast('success', `Role "${role}" removed`)
  }

  if (loading) return <p className="text-slate-400 py-8 text-center">Loading...</p>

  const permissionKeys: Array<keyof CrudPermission> = ['create', 'update', 'view', 'delete', 'receive_notifications', 'assignable']
  const roleNames = Object.keys(prefs).sort((a, b) => {
    if (a === 'manager') return -1
    if (b === 'manager') return 1
    if (a === 'member') return -1
    if (b === 'member') return 1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-5 max-w-4xl">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Configure CRUD permissions by role. Current system roles are <span className="font-medium">manager</span> and <span className="font-medium">member</span>.
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {saving ? 'Saving changes...' : 'Changes are saved automatically.'}
      </p>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-medium">Role</th>
              {permissionKeys.map(k => (
                <th key={k} className="text-center px-4 py-3 font-medium">{k === 'receive_notifications' ? 'Receive Updates' : k === 'assignable' ? 'Assignee' : k}</th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {roleNames.map(role => (
              <tr key={role} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${role === 'manager' ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {role}
                  </span>
                </td>
                {permissionKeys.map(k => (
                  <td key={`${role}-${k}`} className="px-4 py-3 text-center">
                    <label className="inline-flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={Boolean(prefs[role]?.[k])}
                        onChange={() => setPrefs(prev => ({ ...prev, [role]: { ...prev[role], [k]: !prev[role][k] } }))}
                        className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  {role !== 'manager' && role !== 'member' && (
                    <button
                      onClick={() => removeRole(role)}
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Add Role</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} max-w-sm`}
            placeholder="e.g. reviewer or qa_lead"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
          />
          <button
            type="button"
            onClick={addRole}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
          >
            + Add Role
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          New roles are saved in preferences and can be configured with CRUD permissions.
        </p>
      </div>

    </div>
  )
}

// ── Features Tab ──────────────────────────────────────────────────
function FeaturesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', mandays: '1', planned_start: '', planned_end: '' })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: any[]) =>
      setProjects(data.map(p => ({ id: p.id, title: p.title })))
    )
  }, [])

  useEffect(() => {
    if (!projectId) { setFeatures([]); return }
    setLoading(true)
    fetch(`/api/features?project_id=${projectId}`).then(r => r.json()).then(data => { setFeatures(data); setLoading(false) })
  }, [projectId])

  function calcMandays(start: string, end: string) {
    if (!start || !end) return form.mandays
    const s = new Date(start), e = new Date(end)
    if (e < s) return '1'
    let days = 0; const cur = new Date(s)
    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) days++; cur.setDate(cur.getDate() + 1) }
    return String(Math.max(1, days))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); if (!projectId) return
    setSaving(true)
    const res = await fetch('/api/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(projectId), title: form.title, description: form.description || null, mandays: Number(form.mandays), planned_start: form.planned_start, planned_end: form.planned_end }),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch(`/api/features?project_id=${projectId}`).then(r => r.json())
      setFeatures(fresh); setForm({ title: '', description: '', mandays: '1', planned_start: '', planned_end: '' }); setShowForm(false)
      showToast('success', 'Feature added')
    } else showToast('error', (await res.json()).error || 'Failed to add feature')
  }

  const statusColor: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    OnHold: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {projectId && (
          <button onClick={() => setShowForm(v => !v)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            + Add Feature
          </button>
        )}
      </div>

      {showForm && projectId && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">New Feature</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div><label className={labelClass}>Title *</label><input required className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><label className={labelClass}>Description</label><textarea className={`${inputClass} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Start *</label>
                <input type="date" required className={inputClass} value={form.planned_start}
                  onChange={e => setForm(f => ({ ...f, planned_start: e.target.value, mandays: calcMandays(e.target.value, f.planned_end) }))} />
              </div>
              <div>
                <label className={labelClass}>End *</label>
                <input type="date" required className={inputClass} value={form.planned_end}
                  onChange={e => setForm(f => ({ ...f, planned_end: e.target.value, mandays: calcMandays(f.planned_start, e.target.value) }))} />
              </div>
              <div><label className={labelClass}>Mandays</label><input type="number" min="1" className={inputClass} value={form.mandays} onChange={e => setForm(f => ({ ...f, mandays: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Add Feature'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!projectId && <p className="text-slate-400 text-sm py-8 text-center">Select a project to view features.</p>}
      {projectId && loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {projectId && !loading && features.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No features yet.</p>}
      {!loading && features.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Feature</th>
                <th className="text-left px-5 py-3 font-medium">Module</th>
                <th className="text-left px-5 py-3 font-medium">Period</th>
                <th className="text-left px-5 py-3 font-medium">Mandays</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-700">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{f.title}</p>
                    {f.description && <p className="text-xs text-slate-400 truncate max-w-xs">{f.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">{f.module?.title ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                    {new Date(f.planned_start).toLocaleDateString()} → {new Date(f.planned_end).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs">{f.mandays}d</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[f.status] ?? statusColor.Pending}`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Branding Tab ──────────────────────────────────────────────────
function BrandingTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ brand_name: '', brand_logo_url: '', login_bg_url: '', theme_color: 'blue' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [bgPreview, setBgPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  const COLORS = ['blue', 'indigo', 'violet', 'emerald', 'rose', 'orange', 'slate']
  const COLOR_PREVIEW: Record<string, string> = {
    blue: 'bg-blue-600', indigo: 'bg-indigo-600', violet: 'bg-violet-600',
    emerald: 'bg-emerald-600', rose: 'bg-rose-600', orange: 'bg-orange-500', slate: 'bg-slate-700',
  }

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setForm({ brand_name: s.brand_name, brand_logo_url: s.brand_logo_url, login_bg_url: s.login_bg_url ?? '', theme_color: s.theme_color })
      if (s.brand_logo_url) setPreview(s.brand_logo_url)
      if (s.login_bg_url) setBgPreview(s.login_bg_url)
    })
  }, [])

  async function handleLogoFile(file: File) {
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const { url } = await res.json()
      setForm(f => ({ ...f, brand_logo_url: url }))
    } else {
      showToast('error', (await res.json()).error ?? 'Upload failed')
      setPreview(form.brand_logo_url || null)
    }
  }

  async function handleBgFile(file: File) {
    setUploadingBg(true)
    setBgPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/brand-bg', { method: 'POST', body: fd })
    setUploadingBg(false)
    if (res.ok) {
      const { url } = await res.json()
      setForm(f => ({ ...f, login_bg_url: url }))
    } else {
      showToast('error', (await res.json()).error ?? 'Upload failed')
      setBgPreview(form.login_bg_url || null)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (res.ok) showToast('success', 'Branding saved')
    else showToast('error', 'Failed to save')
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-5">
      <div>
        <label className={labelClass}>Brand / App Name</label>
        <input className={inputClass} value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} placeholder="IT Tracker" />
      </div>

      <div>
        <label className={labelClass}>Logo <span className="text-slate-400 font-normal">(JPEG, PNG, WebP, SVG — max 2MB)</span></label>

        {/* Logo Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f) }}
          className="mt-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
        >
          {uploading ? (
            <p className="text-sm text-slate-400">Uploading...</p>
          ) : preview ? (
            <img src={preview} alt="logo" className="h-14 object-contain rounded" />
          ) : (
            <>
              <span className="text-2xl text-slate-300">🖼</span>
              <p className="text-sm text-slate-400">Click or drag & drop to upload logo</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
        />

        {preview && (
          <button type="button" onClick={() => { setPreview(null); setForm(f => ({ ...f, brand_logo_url: '' })) }}
            className="mt-2 text-xs text-red-500 hover:text-red-700">
            Remove logo
          </button>
        )}
      </div>

      {/* Login page background */}
      <div>
        <label className={labelClass}>Login Page Background <span className="text-slate-400 font-normal">(JPEG, PNG, WebP — max 5MB)</span></label>
        <p className="text-xs text-slate-400 mb-2">Displayed as the full-page background on the sign-in screen.</p>

        <div
          onClick={() => bgInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBgFile(f) }}
          className="mt-1 relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
          style={{ minHeight: '120px' }}
        >
          {bgPreview && (
            <img src={bgPreview} alt="background" className="absolute inset-0 w-full h-full object-cover opacity-40 rounded-xl pointer-events-none" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2 py-6">
            {uploadingBg ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Uploading...</p>
            ) : bgPreview ? (
              <p className="text-sm text-slate-600 dark:text-white font-medium">Click to replace background</p>
            ) : (
              <>
                <span className="text-2xl text-slate-300">🌅</span>
                <p className="text-sm text-slate-400">Click or drag & drop to upload background</p>
              </>
            )}
          </div>
        </div>

        <input
          ref={bgInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleBgFile(f) }}
        />

        {bgPreview && (
          <button type="button" onClick={() => { setBgPreview(null); setForm(f => ({ ...f, login_bg_url: '' })) }}
            className="mt-2 text-xs text-red-500 hover:text-red-700">
            Remove background
          </button>
        )}
      </div>

      <div>
        <label className={labelClass}>Theme Color</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, theme_color: c }))}
              className={`w-8 h-8 rounded-full ${COLOR_PREVIEW[c]} transition-all ${form.theme_color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
              title={c}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Selected: <span className="font-medium capitalize">{form.theme_color}</span></p>
      </div>

      <button type="submit" disabled={saving || uploading || uploadingBg} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </form>
  )
}

// ── Email Tab ─────────────────────────────────────────────────────
function EmailTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_from: '', smtp_pass: '' })
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setForm(f => ({ ...f, smtp_host: s.smtp_host, smtp_port: s.smtp_port, smtp_user: s.smtp_user, smtp_from: s.smtp_from })))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const body: any = { smtp_host: form.smtp_host, smtp_port: form.smtp_port, smtp_user: form.smtp_user, smtp_from: form.smtp_from }
    if (form.smtp_pass) body.smtp_pass = form.smtp_pass
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) showToast('success', 'Email settings saved')
    else showToast('error', 'Failed to save')
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>SMTP Host</label>
          <input className={inputClass} value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className={labelClass}>SMTP Port</label>
          <input className={inputClass} value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} placeholder="587" />
        </div>
      </div>
      <div>
        <label className={labelClass}>SMTP Username</label>
        <input className={inputClass} value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="you@gmail.com" />
      </div>
      <div>
        <label className={labelClass}>SMTP Password</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} className={inputClass} value={form.smtp_pass} onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))} placeholder="Leave blank to keep existing" />
          <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">
            {showPass ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div>
        <label className={labelClass}>From Address</label>
        <input className={inputClass} value={form.smtp_from} onChange={e => setForm(f => ({ ...f, smtp_from: e.target.value }))} placeholder="IT Tracker <no-reply@company.com>" />
      </div>
      <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Email Settings'}
      </button>
    </form>
  )
}

// ── Database Tab ──────────────────────────────────────────────────
function DatabaseTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ db_host: '', db_port: '5432', db_name: '', db_user: '', db_pass: '' })
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s =>
      setForm(f => ({ ...f, db_host: s.db_host, db_port: s.db_port, db_name: s.db_name, db_user: s.db_user }))
    )
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const body: any = { db_host: form.db_host, db_port: form.db_port, db_name: form.db_name, db_user: form.db_user }
    if (form.db_pass) body.db_pass = form.db_pass
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) showToast('success', 'Database settings saved — restart required to apply')
    else showToast('error', 'Failed to save')
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-2">
        <span className="text-amber-500 text-base mt-0.5">⚠</span>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Changes are saved to the database and take effect after a server restart. The active connection uses the current <code className="font-mono">DATABASE_URL</code> environment variable.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Host</label>
          <input className={inputClass} value={form.db_host} onChange={e => setForm(f => ({ ...f, db_host: e.target.value }))} placeholder="localhost" />
        </div>
        <div>
          <label className={labelClass}>Port</label>
          <input className={inputClass} value={form.db_port} onChange={e => setForm(f => ({ ...f, db_port: e.target.value }))} placeholder="5432" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Database Name</label>
        <input className={inputClass} value={form.db_name} onChange={e => setForm(f => ({ ...f, db_name: e.target.value }))} placeholder="it_tracker" />
      </div>

      <div>
        <label className={labelClass}>Username</label>
        <input className={inputClass} value={form.db_user} onChange={e => setForm(f => ({ ...f, db_user: e.target.value }))} placeholder="postgres" />
      </div>

      <div>
        <label className={labelClass}>Password</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} className={inputClass} value={form.db_pass}
            onChange={e => setForm(f => ({ ...f, db_pass: e.target.value }))} placeholder="Leave blank to keep existing" />
          <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {showPass ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="pt-1 flex items-center gap-4">
        <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Database Settings'}
        </button>
        <p className="text-xs text-slate-400">Current connection: PostgreSQL</p>
      </div>
    </form>
  )
}

// ── Backup & Restore Tab ──────────────────────────────────────────
function BackupTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [cronSaving, setCronSaving] = useState(false)
  const [cronRunning, setCronRunning] = useState<'backup' | 'pending-notify' | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [cronCfg, setCronCfg] = useState({
    backupEnabled: false,
    pendingNotifyEnabled: false,
    backupDays: ['0', '1', '2', '3', '4', '5', '6'],
    backupTime: '02:00',
    pendingDays: ['1'],
    pendingTime: '09:00',
    timeZone: 'Asia/Kuala_Lumpur',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dayOptions = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' },
  ]
  const allDays = dayOptions.map(d => d.value)
  const parseDays = (raw: unknown, fallback: string[]) => {
    const val = String(raw ?? '').trim()
    if (!val || val === '*') return [...allDays]
    const picked = val.split(',').map(v => v.trim()).filter(v => allDays.includes(v))
    return picked.length > 0 ? Array.from(new Set(picked)) : fallback
  }
  const serializeDays = (days: string[]) => {
    const picked = Array.from(new Set(days.filter(d => allDays.includes(d))))
    if (picked.length === 0 || picked.length === allDays.length) return '*'
    return picked.join(',')
  }
  function toggleDay(target: 'backupDays' | 'pendingDays', day: string) {
    setCronCfg(prev => {
      const current = prev[target]
      const exists = current.includes(day)
      const next = exists ? current.filter(d => d !== day) : [...current, day]
      return { ...prev, [target]: next.length ? next : [day] }
    })
  }

  function loadBackups() {
    setLoading(true)
    fetch('/api/backup').then(r => r.json()).then(d => { setBackups(d); setLoading(false) })
  }

  useEffect(() => {
    loadBackups()
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => setCronCfg({
        backupEnabled: Boolean(s?.cron_backup_enabled),
        pendingNotifyEnabled: Boolean(s?.cron_pending_notify_enabled),
        backupDays: parseDays(s?.cron_backup_day, [...allDays]),
        backupTime: String(s?.cron_backup_time ?? '02:00'),
        pendingDays: parseDays(s?.cron_pending_notify_day, ['1']),
        pendingTime: String(s?.cron_pending_notify_time ?? '09:00'),
        timeZone: String(s?.cron_timezone ?? 'Asia/Kuala_Lumpur'),
      }))
      .catch(() => { })
  }, [])

  async function createBackup() {
    setCreating(true)
    const res = await fetch('/api/backup', { method: 'POST' })
    setCreating(false)
    if (res.ok) { showToast('success', 'Backup created'); loadBackups() }
    else showToast('error', (await res.json()).error ?? 'Backup failed')
  }

  async function restoreFromFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/backup/restore', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) showToast('success', 'Restore completed — please refresh the page')
    else showToast('error', (await res.json()).error ?? 'Restore failed')
  }

  async function restoreFromBackup(filename: string) {
    setRestoring(filename)
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    setRestoring(null)
    setConfirmRestore(null)
    if (res.ok) showToast('success', 'Restore completed — please refresh the page')
    else showToast('error', (await res.json()).error ?? 'Restore failed')
  }

  async function saveCronSettings() {
    setCronSaving(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cron_backup_enabled: cronCfg.backupEnabled,
        cron_pending_notify_enabled: cronCfg.pendingNotifyEnabled,
        cron_backup_day: serializeDays(cronCfg.backupDays),
        cron_backup_time: cronCfg.backupTime,
        cron_pending_notify_day: serializeDays(cronCfg.pendingDays),
        cron_pending_notify_time: cronCfg.pendingTime,
        cron_timezone: cronCfg.timeZone,
      }),
    })
    setCronSaving(false)
    if (res.ok) showToast('success', 'Automation settings saved')
    else showToast('error', 'Failed to save automation settings')
  }

  async function runCronJob(job: 'backup' | 'pending-notify') {
    setCronRunning(job)
    const res = await fetch('/api/cron/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, force: true }),
    })
    setCronRunning(null)
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast('error', payload?.error || 'Cron run failed')
      return
    }
    if (job === 'backup') {
      showToast('success', payload?.result?.backup?.skipped ? `Backup skipped: ${payload?.result?.backup?.reason}` : 'Backup cron executed')
      loadBackups()
    } else {
      const pn = payload?.result?.pendingNotify
      showToast('success', pn?.skipped ? `Notify skipped: ${pn?.reason}` : `Pending notify sent to ${pn?.recipients ?? 0} owner(s)`)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="max-w-2xl">
      {/* Warning */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-6">
        <span className="text-amber-500 text-base mt-0.5">⚠</span>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Restore will <strong>overwrite all current data</strong> with the backup. This cannot be undone. Backup files are saved to <code className="font-mono">/uploads/backup/</code>.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={createBackup} disabled={creating}
          className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
          {creating ? 'Creating backup...' : '↓ Create Backup Now'}
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50">
          {uploading ? 'Uploading...' : '↑ Restore from File'}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) restoreFromFile(f); e.target.value = '' }} />
      </div>

      {/* Automation settings */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-4 mb-6 space-y-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Automation (Cron)</p>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Scheduled Backup</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Allow external cron to create automatic backup files.</p>
          </div>
          <input
            type="checkbox"
            checked={cronCfg.backupEnabled}
            onChange={(e) => setCronCfg(v => ({ ...v, backupEnabled: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500"
          />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 -mt-2">
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400">Backup day</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 p-2">
              {dayOptions.map(d => (
                <label key={`backup-day-${d.value}`} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={cronCfg.backupDays.includes(d.value)}
                    onChange={() => toggleDay('backupDays', d.value)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400">Backup time</label>
            <input
              type="time"
              value={cronCfg.backupTime}
              onChange={(e) => setCronCfg(v => ({ ...v, backupTime: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400">Timezone</label>
            <input
              value={cronCfg.timeZone}
              onChange={(e) => setCronCfg(v => ({ ...v, timeZone: e.target.value }))}
              className={`${inputClass} mt-1`}
              placeholder="Asia/Kuala_Lumpur"
            />
          </div>
        </div>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Weekly Progress Update</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Allow external cron to send weekly progress summary (tasks, deliverables, projects, developer analytics) to all roles with Receive Updates enabled.</p>
          </div>
          <input
            type="checkbox"
            checked={cronCfg.pendingNotifyEnabled}
            onChange={(e) => setCronCfg(v => ({ ...v, pendingNotifyEnabled: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500"
          />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 -mt-2">
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400">Notify day</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 p-2">
              {dayOptions.map(d => (
                <label key={`pending-day-${d.value}`} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={cronCfg.pendingDays.includes(d.value)}
                    onChange={() => toggleDay('pendingDays', d.value)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400">Notify time</label>
            <input
              type="time"
              value={cronCfg.pendingTime}
              onChange={(e) => setCronCfg(v => ({ ...v, pendingTime: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={saveCronSettings}
            disabled={cronSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {cronSaving ? 'Saving...' : 'Save Automation Settings'}
          </button>
          <button
            onClick={() => runCronJob('backup')}
            disabled={cronRunning === 'backup'}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-50"
          >
            {cronRunning === 'backup' ? 'Running...' : 'Run Backup Cron Now'}
          </button>
          <button
            onClick={() => runCronJob('pending-notify')}
            disabled={cronRunning === 'pending-notify'}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-50"
          >
            {cronRunning === 'pending-notify' ? 'Running...' : 'Run Weekly Progress Update Now'}
          </button>
        </div>
      </div>

      {/* Backup list */}
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Saved Backups</h3>
      {loading && <p className="text-slate-400 text-sm py-4">Loading...</p>}
      {!loading && backups.length === 0 && (
        <p className="text-slate-400 text-sm py-4">No backups yet. Create your first backup above.</p>
      )}
      {!loading && backups.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800 divide-y divide-slate-100 dark:divide-navy-700">
          {backups.map(b => (
            <div key={b.filename} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg">🗄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{b.filename}</p>
                <p className="text-xs text-slate-400">{new Date(b.created_at).toLocaleString()} · {formatSize(b.size)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={b.url} download className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                  Download
                </a>
                <button
                  onClick={() => setConfirmRestore(b.filename)}
                  disabled={restoring === b.filename}
                  className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50"
                >
                  {restoring === b.filename ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm restore modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200 dark:border-navy-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Confirm Restore</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              This will overwrite <strong>all current data</strong> with:
            </p>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-900 px-3 py-2 rounded-lg mb-4 break-all">{confirmRestore}</p>
            <div className="flex gap-3">
              <button onClick={() => restoreFromBackup(confirmRestore)} disabled={!!restoring}
                className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {restoring ? 'Restoring...' : 'Yes, Restore'}
              </button>
              <button onClick={() => setConfirmRestore(null)}
                className="flex-1 py-2 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Audit Logs Tab ────────────────────────────────────────────────
function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(u => setUsers(Array.isArray(u) ? u : []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterAction) params.set('action', filterAction)
    if (filterUser) params.set('user_id', filterUser)
    fetch(`/api/audit-logs?${params}`).then(r => r.json()).then(d => { setLogs(d); setLoading(false) })
  }, [filterAction, filterUser])

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    UPDATE: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    EXPORT: 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    LOGIN: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
    LOGOUT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    CHANGE_PASSWORD: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    BACKUP: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
    RESTORE: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  }

  const ALL_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'CHANGE_PASSWORD', 'BACKUP', 'RESTORE']
  const selectCls = 'text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={selectCls}>
          <option value="">All Actions</option>
          {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={selectCls}>
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {(filterAction || filterUser) && (
          <button onClick={() => { setFilterAction(''); setFilterUser('') }} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{logs.length} entries</span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-medium">Time</th>
              <th className="text-left px-5 py-3 font-medium">User</th>
              <th className="text-left px-5 py-3 font-medium">Action</th>
              <th className="text-left px-5 py-3 font-medium">Target</th>
              <th className="text-left px-5 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
            {loading && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Loading...</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No logs found.</td></tr>}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <p className="text-slate-900 dark:text-white text-sm font-medium">{log.user.name}</p>
                  <p className="text-xs text-slate-400">{log.user.email}</p>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs">{log.target_type} #{log.target_id}</td>
                <td className="px-5 py-3 text-slate-400 text-xs font-mono max-w-xs truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Team Members')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as any).role !== 'manager') router.replace('/dashboard')
  }, [session, status, router])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage team, features, branding, and email configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-navy-700">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Team Members' && <TeamTab showToast={showToast} />}
      {activeTab === 'Roles' && <RolesTab showToast={showToast} />}
      {activeTab === 'Organisation' && <OrgTab showToast={showToast} />}
      {activeTab === 'Branding' && <BrandingTab showToast={showToast} />}
      {activeTab === 'Email' && <EmailTab showToast={showToast} />}
      {activeTab === 'Database' && <DatabaseTab showToast={showToast} />}
      {activeTab === 'Backup & Restore' && <BackupTab showToast={showToast} />}
      {activeTab === 'Audit Logs' && <AuditLogsTab />}
    </Layout>
  )
}
