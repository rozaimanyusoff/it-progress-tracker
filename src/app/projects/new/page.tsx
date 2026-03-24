'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Unit { id: number; name: string }
interface Member { id: number; name: string; email: string; role: string }

interface ModuleTask { tempId: string; title: string }

interface Module {
  tempId: string
  title: string
  description: string
  mandays: string
  planned_start: string
  planned_end: string
  developer_ids: number[]
  tasks: ModuleTask[]
  // set after creation
  featureId?: number
  saved?: boolean
}

const PROJECT_CATEGORIES = [
  'Web Application',
  'Mobile Application',
  'Data Analytics / BI',
  'System Integration',
  'Infrastructure',
  'Process Automation',
  'Security',
  'Other',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptyModule(): Module {
  return {
    tempId: uid(),
    title: '',
    description: '',
    mandays: '1',
    planned_start: '',
    planned_end: '',
    developer_ids: [],
    tasks: [],
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  )
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'}`}>
          {step === 1 ? '1' : '✓'}
        </div>
        <span className={`text-sm font-medium ${step === 1 ? 'text-slate-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>Project Details</span>
      </div>
      <div className="flex-1 h-px bg-slate-200 dark:bg-navy-600" />
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>
          2
        </div>
        <span className={`text-sm font-medium ${step === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>Add Modules</span>
      </div>
    </div>
  )
}

// ─── Module Form (inline) ─────────────────────────────────────────────────────

function ModuleForm({
  module,
  members,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  module: Module
  members: Member[]
  onChange: (m: Module) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
}) {
  const ic = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
  const lc = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1'

  const [taskInput, setTaskInput] = useState('')

  function toggleDev(id: number) {
    onChange({
      ...module,
      developer_ids: module.developer_ids.includes(id)
        ? module.developer_ids.filter((d) => d !== id)
        : [...module.developer_ids, id],
    })
  }

  function addTask() {
    const t = taskInput.trim()
    if (!t) return
    onChange({ ...module, tasks: [...module.tasks, { tempId: uid(), title: t }] })
    setTaskInput('')
  }

  function removeTask(tempId: string) {
    onChange({ ...module, tasks: module.tasks.filter((t) => t.tempId !== tempId) })
  }

  return (
    <div className="border border-blue-300 dark:border-blue-700 rounded-xl p-5 bg-blue-50/30 dark:bg-blue-900/10 space-y-4">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">New Module</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={lc}>Module Name *</label>
          <input className={ic} value={module.title} onChange={(e) => onChange({ ...module, title: e.target.value })} placeholder="e.g. Training Module" />
        </div>
        <div className="sm:col-span-2">
          <label className={lc}>Description</label>
          <textarea className={`${ic} resize-none`} rows={2} value={module.description} onChange={(e) => onChange({ ...module, description: e.target.value })} placeholder="Brief description of this module..." />
        </div>
        <div>
          <label className={lc}>Planned Start *</label>
          <input type="date" className={ic} value={module.planned_start} onChange={(e) => onChange({ ...module, planned_start: e.target.value })} />
        </div>
        <div>
          <label className={lc}>Planned End *</label>
          <input type="date" className={ic} value={module.planned_end} onChange={(e) => onChange({ ...module, planned_end: e.target.value })} />
        </div>
        <div>
          <label className={lc}>Mandays</label>
          <input type="number" min="1" className={ic} value={module.mandays} onChange={(e) => onChange({ ...module, mandays: e.target.value })} />
        </div>
      </div>

      {/* Assign developers */}
      <div>
        <label className={lc}>Assign Developers</label>
        {members.filter((m) => m.role === 'member').length === 0 ? (
          <p className="text-xs text-slate-400">No developers available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 border border-slate-200 dark:border-navy-700 rounded-lg p-2 max-h-32 overflow-y-auto">
            {members.filter((m) => m.role === 'member').map((dev) => (
              <label key={dev.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-700 rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={module.developer_ids.includes(dev.id)}
                  onChange={() => toggleDev(dev.id)}
                  className="accent-blue-500 w-3.5 h-3.5"
                />
                <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{dev.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Custom tasks */}
      <div>
        <label className={lc}>Custom Tasks (optional)</label>
        <div className="flex gap-2">
          <input
            className={ic}
            placeholder="Task title..."
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
          />
          <button
            type="button"
            onClick={addTask}
            className="shrink-0 px-3 py-2 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm"
          >
            + Add
          </button>
        </div>
        {module.tasks.length > 0 && (
          <ul className="mt-2 space-y-1">
            {module.tasks.map((t) => (
              <li key={t.tempId} className="flex items-center justify-between bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                <span>{t.title}</span>
                <button type="button" onClick={() => removeTask(t.tempId)} className="text-slate-400 hover:text-red-500 ml-2">✕</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Default SDLC tasks (Requirements, Design, Dev, Testing, etc.) are added automatically.</p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {saving ? 'Saving...' : 'Save Module'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Saved Module Card ────────────────────────────────────────────────────────

function ModuleCard({ module, members }: { module: Module; members: Member[] }) {
  const devNames = members.filter((m) => module.developer_ids.includes(m.id)).map((m) => m.name)

  return (
    <div className="border border-slate-200 dark:border-navy-700 rounded-xl p-4 bg-white dark:bg-navy-800">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{module.title}</p>
          {module.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{module.description}</p>}
        </div>
        <Badge color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Saved</Badge>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>📅 {module.planned_start} → {module.planned_end}</span>
        <span>⏱ {module.mandays} manday{Number(module.mandays) !== 1 ? 's' : ''}</span>
        {devNames.length > 0 && <span>👥 {devNames.join(', ')}</span>}
      </div>
      {module.tasks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Custom tasks:</p>
          <div className="flex flex-wrap gap-1">
            {module.tasks.map((t) => (
              <span key={t.tempId} className="px-2 py-0.5 bg-slate-100 dark:bg-navy-700 text-xs text-slate-600 dark:text-slate-300 rounded">{t.title}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Step 1 state
  const [units, setUnits] = useState<Unit[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    unit_id: '',
    owner_id: '',
    start_date: '',
    deadline: '',
    status: 'Pending',
  })
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [saving1, setSaving1] = useState(false)
  const [error1, setError1] = useState('')

  // Step 2 state
  const [step, setStep] = useState<1 | 2>(1)
  const [createdProject, setCreatedProject] = useState<{ id: number; title: string } | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [draftModule, setDraftModule] = useState<Module>(emptyModule())
  const [savingModule, setSavingModule] = useState(false)
  const [moduleError, setModuleError] = useState('')

  const user = session?.user as any

  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
  }, [])

  useEffect(() => {
    if (form.unit_id) {
      fetch(`/api/users?unit_id=${form.unit_id}`).then((r) => r.json()).then(setMembers)
    } else {
      fetch('/api/users').then((r) => r.json()).then(setMembers)
    }
  }, [form.unit_id])

  if (user?.role !== 'manager') {
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-400">Access denied. Manager only.</div>
      </AppLayout>
    )
  }

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

  // ── Step 1: Create Project ──
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    setSaving1(true)
    setError1('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, member_ids: memberIds }),
    })
    if (res.ok) {
      const data = await res.json()
      setCreatedProject({ id: data.id, title: data.title })
      setStep(2)
    } else {
      const data = await res.json()
      setError1(data.error || 'Failed to create project')
    }
    setSaving1(false)
  }

  function toggleMember(id: number) {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  // ── Step 2: Save a module ──
  async function handleSaveModule() {
    if (!createdProject) return
    if (!draftModule.title.trim() || !draftModule.planned_start || !draftModule.planned_end) {
      setModuleError('Module name, planned start and end are required.')
      return
    }
    setSavingModule(true)
    setModuleError('')
    try {
      const res = await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: createdProject.id,
          title: draftModule.title,
          description: draftModule.description,
          mandays: Number(draftModule.mandays) || 1,
          planned_start: draftModule.planned_start,
          planned_end: draftModule.planned_end,
          developer_ids: draftModule.developer_ids,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save module')
      }
      const feature = await res.json()

      // Add any custom tasks
      for (const t of draftModule.tasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_id: feature.id, title: t.title }),
        })
      }

      setModules((prev) => [...prev, { ...draftModule, featureId: feature.id, saved: true }])
      setDraftModule(emptyModule())
      setShowModuleForm(false)
    } catch (err: any) {
      setModuleError(err.message || 'Something went wrong')
    } finally {
      setSavingModule(false)
    }
  }

  // ── Render ──
  return (
    <AppLayout>
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Project</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set up your project then add modules and tasks.</p>
        </div>

        <StepIndicator step={step} />

        {/* ── STEP 1 ─────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6">
            <form onSubmit={handleCreateProject} className="space-y-5">
              {error1 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error1}
                </div>
              )}

              {/* Title */}
              <div>
                <label className={labelClass}>Project Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. HR Analytics Dashboard"
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputClass} h-20 resize-none`}
                  placeholder="Brief overview of the project..."
                />
              </div>

              {/* Category */}
              <div>
                <label className={labelClass}>Category</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm({ ...form, category: form.category === cat ? '' : cat })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.category === cat
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-50 dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {form.category && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">Selected: {form.category}</p>
                )}
              </div>

              {/* Unit + Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Unit *</label>
                  <select
                    required
                    value={form.unit_id}
                    onChange={(e) => { setForm({ ...form, unit_id: e.target.value, owner_id: '' }); setMemberIds([]) }}
                    className={inputClass}
                  >
                    <option value="">Select unit...</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>PIC / Owner *</label>
                  <select
                    required
                    value={form.owner_id}
                    onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select owner...</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Assignees (checkboxes) */}
              <div>
                <label className={labelClass}>
                  Assignees
                  {memberIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">{memberIds.length} selected</span>
                  )}
                </label>
                {members.filter((m) => m.role === 'member').length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {form.unit_id ? 'No members in this unit.' : 'Select a unit to load members.'}
                  </p>
                ) : (
                  <div className="border border-slate-200 dark:border-navy-700 rounded-lg divide-y divide-slate-100 dark:divide-navy-700 max-h-48 overflow-y-auto">
                    {members.filter((m) => m.role === 'member').map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700"
                      >
                        <input
                          type="checkbox"
                          checked={memberIds.includes(m.id)}
                          onChange={() => toggleMember(m.id)}
                          className="accent-blue-500 w-4 h-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{m.name}</p>
                          <p className="text-xs text-slate-400 truncate">{m.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Start Date *</label>
                  <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Deadline *</label>
                  <input type="date" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className={labelClass}>Initial Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  <option value="Pending">Pending</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="OnHold">On Hold</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving1}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  {saving1 ? 'Creating...' : 'Create Project & Continue →'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2.5 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────────── */}
        {step === 2 && createdProject && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm shrink-0">✓</div>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Project created successfully!</p>
                <p className="text-xs text-green-700 dark:text-green-400">"{createdProject.title}" — now add modules to structure your work.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add Modules</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Modules are major work areas within the project (e.g. Training Module, Reporting Module). You can skip this and add modules later.
                </p>
              </div>

              {/* Saved module cards */}
              {modules.length > 0 && (
                <div className="space-y-3">
                  {modules.map((m) => (
                    <ModuleCard key={m.tempId} module={m} members={members} />
                  ))}
                </div>
              )}

              {/* Module form */}
              {showModuleForm ? (
                <ModuleForm
                  module={draftModule}
                  members={members}
                  onChange={setDraftModule}
                  onSave={handleSaveModule}
                  onCancel={() => { setShowModuleForm(false); setDraftModule(emptyModule()); setModuleError('') }}
                  saving={savingModule}
                  error={moduleError}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowModuleForm(true)}
                  className="w-full border-2 border-dashed border-slate-300 dark:border-navy-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl py-4 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  + Add Module
                </button>
              )}

              {/* Footer actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${createdProject.id}`)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  {modules.length > 0 ? 'Finish & View Project' : 'View Project'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/manager')}
                  className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2.5 rounded-lg transition-colors text-sm"
                >
                  Go to Manager Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
