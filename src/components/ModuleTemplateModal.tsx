'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────

interface TemplateTask {
  id: number
  name: string
  est_mandays: number | null
  sort_order: number
}

interface TemplateDeliverable {
  id: number
  name: string
  type: string
  sort_order: number
  tasks: TemplateTask[]
}

interface Template {
  id: number
  code: string
  display_name: string
  description: string | null
  icon: string | null
  sort_order: number
  deliverables: TemplateDeliverable[]
}

interface TaskRow {
  templateTaskId: number | null  // null = custom task
  name: string
  include: boolean
  estMandays: number | string
  assigneeId: number | null
  isEditing: boolean
}

interface DeliverableRow {
  templateDeliverableId: number | null  // null = custom deliverable
  name: string
  include: boolean
  type: string
  tasks: TaskRow[]
  expanded: boolean
  isEditing: boolean
}

interface Member {
  id: number
  name: string
}

interface Props {
  projectId: number
  members: Member[]
  projectStartDate: string
  projectDeadline: string
  onClose: () => void
  onCreated: (module: any, deliverables: any[]) => void
}

// ── Helpers ──────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  database: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  backend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  frontend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  testing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  documentation: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

function buildDeliverableRows(deliverables: TemplateDeliverable[]): DeliverableRow[] {
  return deliverables.map(d => ({
    templateDeliverableId: d.id,
    name: d.name,
    include: true,
    type: d.type,
    expanded: true,
    isEditing: false,
    tasks: d.tasks.map(t => ({
      templateTaskId: t.id,
      name: t.name,
      include: true,
      estMandays: t.est_mandays ?? '',
      assigneeId: null,
      isEditing: false,
    })),
  }))
}

// ── Sub-components ────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: Template
  selected: boolean
  onSelect: () => void
}) {
  const delivCount = template.deliverables.length
  const taskCount = template.deliverables.reduce((s, d) => s + d.tasks.length, 0)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
          ✓
        </span>
      )}
      <div className="text-2xl">{template.icon ?? '📦'}</div>
      <div className="font-semibold text-sm text-slate-900 dark:text-white">{template.display_name}</div>
      {template.description && (
        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {template.description}
        </div>
      )}
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-auto pt-1">
        {delivCount} deliverable{delivCount !== 1 ? 's' : ''} · {taskCount} task{taskCount !== 1 ? 's' : ''}
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────

export default function ModuleTemplateModal({
  projectId,
  members,
  projectStartDate,
  projectDeadline,
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'empty' | null>(null)

  // Step 2 form state
  const [moduleName, setModuleName] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [deliverableRows, setDeliverableRows] = useState<DeliverableRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputClass =
    'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  useEffect(() => {
    fetch('/api/module-templates')
      .then(r => r.json())
      .then(data => {
        setTemplates(Array.isArray(data) ? data : [])
        setLoadingTemplates(false)
      })
      .catch(() => setLoadingTemplates(false))
  }, [])

  function handleSelectTemplate(id: number | 'empty') {
    setSelectedTemplateId(id)
  }

  function handleNext() {
    if (!selectedTemplateId) return
    if (selectedTemplateId !== 'empty') {
      const tpl = templates.find(t => t.id === selectedTemplateId)
      if (tpl) setDeliverableRows(buildDeliverableRows(tpl.deliverables))
    } else {
      setDeliverableRows([])
    }
    setStep(2)
  }

  // ── Deliverable row mutations ──────────────────────────────────

  function toggleDeliverable(dIdx: number) {
    setDeliverableRows(prev =>
      prev.map((d, i) => (i === dIdx ? { ...d, include: !d.include } : d))
    )
  }

  function toggleExpanded(dIdx: number) {
    setDeliverableRows(prev =>
      prev.map((d, i) => (i === dIdx ? { ...d, expanded: !d.expanded } : d))
    )
  }

  function renameDeliverable(dIdx: number, name: string) {
    setDeliverableRows(prev =>
      prev.map((d, i) => (i === dIdx ? { ...d, name, isEditing: false } : d))
    )
  }

  function removeDeliverable(dIdx: number) {
    setDeliverableRows(prev => prev.filter((_, i) => i !== dIdx))
  }

  function addCustomDeliverable() {
    setDeliverableRows(prev => [
      ...prev,
      {
        templateDeliverableId: null,
        name: 'New Deliverable',
        include: true,
        type: 'frontend',
        expanded: true,
        isEditing: true,
        tasks: [],
      },
    ])
  }

  // ── Task row mutations ─────────────────────────────────────────

  function toggleTask(dIdx: number, tIdx: number) {
    setDeliverableRows(prev =>
      prev.map((d, i) => {
        if (i !== dIdx) return d
        return {
          ...d,
          tasks: d.tasks.map((t, j) => (j === tIdx ? { ...t, include: !t.include } : t)),
        }
      })
    )
  }

  function updateTask(dIdx: number, tIdx: number, patch: Partial<TaskRow>) {
    setDeliverableRows(prev =>
      prev.map((d, i) => {
        if (i !== dIdx) return d
        return {
          ...d,
          tasks: d.tasks.map((t, j) => (j === tIdx ? { ...t, ...patch } : t)),
        }
      })
    )
  }

  function removeTask(dIdx: number, tIdx: number) {
    setDeliverableRows(prev =>
      prev.map((d, i) => {
        if (i !== dIdx) return d
        return { ...d, tasks: d.tasks.filter((_, j) => j !== tIdx) }
      })
    )
  }

  function addCustomTask(dIdx: number) {
    setDeliverableRows(prev =>
      prev.map((d, i) => {
        if (i !== dIdx) return d
        return {
          ...d,
          tasks: [
            ...d.tasks,
            {
              templateTaskId: null,
              name: '',
              include: true,
              estMandays: '',
              assigneeId: null,
              isEditing: true,
            },
          ],
        }
      })
    )
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleCreate() {
    setError('')
    if (!moduleName.trim()) { setError('Module name is required'); return }
    setSaving(true)

    const customizations = {
      deliverables: deliverableRows.map(d => ({
        template_deliverable_id: d.templateDeliverableId,
        name: d.name,
        include: d.include,
        tasks: d.tasks
          .filter(t => t.templateTaskId !== null)
          .map(t => ({
            template_task_id: t.templateTaskId,
            name: t.name,
            include: t.include,
            est_mandays: t.estMandays !== '' ? Number(t.estMandays) : null,
            assignee_id: t.assigneeId,
          })),
        custom_tasks: d.tasks
          .filter(t => t.templateTaskId === null)
          .map((t, i) => ({
            name: t.name,
            est_mandays: t.estMandays !== '' ? Number(t.estMandays) : null,
            assignee_id: t.assigneeId,
            sort_order: i + 1,
          })),
      })),
    }

    try {
      const res = await fetch('/api/modules/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: moduleName.trim(),
          template_id: selectedTemplateId === 'empty' ? null : selectedTemplateId,
          assignee_id: assigneeId,
          planned_start_date: plannedStart || null,
          planned_end_date: plannedEnd || null,
          customizations,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create module')
      onCreated(data.module, data.deliverables)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Summary counts for step 1 card ────────────────────────────

  const standardTemplates = templates.filter(t => !t.code.startsWith('custom_'))
  const customTemplates = templates.filter(t => t.code.startsWith('custom_'))

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full mx-auto flex flex-col ${
          step === 2 ? 'max-w-5xl max-h-[90vh]' : 'max-w-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {step === 1 ? 'Choose a Template' : 'Configure Module'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Step {step} of 2
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="p-6 space-y-5 overflow-y-auto">
            {loadingTemplates ? (
              <p className="text-sm text-slate-500 text-center py-8">Loading templates...</p>
            ) : (
              <>
                {/* Standard templates grid */}
                <div className="grid grid-cols-2 gap-3">
                  {standardTemplates.map(tpl => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      selected={selectedTemplateId === tpl.id}
                      onSelect={() => handleSelectTemplate(tpl.id)}
                    />
                  ))}
                </div>

                {/* Custom templates */}
                {customTemplates.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                      Custom Templates
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {customTemplates.map(tpl => (
                        <TemplateCard
                          key={tpl.id}
                          template={tpl}
                          selected={selectedTemplateId === tpl.id}
                          onSelect={() => handleSelectTemplate(tpl.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty option */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('empty')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selectedTemplateId === 'empty'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-dashed border-slate-300 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {selectedTemplateId === 'empty' && (
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold shrink-0">✓</span>
                  )}
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Start empty — no template
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      Creates a module with no deliverables
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left panel — Module info */}
            <div className="w-72 shrink-0 border-r border-slate-200 dark:border-navy-700 p-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                  Module Name *
                </label>
                <input
                  className={inputClass}
                  value={moduleName}
                  onChange={e => setModuleName(e.target.value)}
                  placeholder="e.g. Vehicle Maintenance Request"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                  Default Assignee
                </label>
                <select
                  className={inputClass}
                  value={assigneeId ?? ''}
                  onChange={e => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— None —</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                  Planned Start
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={plannedStart}
                  min={projectStartDate}
                  max={plannedEnd || projectDeadline}
                  onChange={e => setPlannedStart(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                  Planned End
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={plannedEnd}
                  min={plannedStart || projectStartDate}
                  max={projectDeadline}
                  onChange={e => setPlannedEnd(e.target.value)}
                />
              </div>

              {selectedTemplateId !== 'empty' && (
                <div className="pt-2 border-t border-slate-100 dark:border-navy-700">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Template:{' '}
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {templates.find(t => t.id === selectedTemplateId)?.display_name}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {deliverableRows.filter(d => d.include).length} of {deliverableRows.length} deliverables included
                  </p>
                </div>
              )}
            </div>

            {/* Right panel — Deliverables */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-navy-700 shrink-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Deliverables
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Toggle, rename, or remove deliverables and tasks before creating.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {deliverableRows.length === 0 && (
                  <p className="text-sm text-slate-400 py-6 text-center">
                    No deliverables. Click &quot;+ Add Deliverable&quot; below to add one.
                  </p>
                )}

                {deliverableRows.map((d, dIdx) => (
                  <div
                    key={dIdx}
                    className={`rounded-lg border ${
                      d.include
                        ? 'border-slate-200 dark:border-navy-600'
                        : 'border-slate-100 dark:border-navy-700 opacity-50'
                    }`}
                  >
                    {/* Deliverable header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-900/50 rounded-t-lg">
                      <input
                        type="checkbox"
                        checked={d.include}
                        onChange={() => toggleDeliverable(dIdx)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpanded(dIdx)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {d.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {d.isEditing ? (
                        <input
                          className="flex-1 text-sm bg-white dark:bg-navy-800 border border-blue-400 rounded px-2 py-0.5 focus:outline-none"
                          value={d.name}
                          autoFocus
                          onChange={e =>
                            setDeliverableRows(prev =>
                              prev.map((r, i) => (i === dIdx ? { ...r, name: e.target.value } : r))
                            )
                          }
                          onBlur={() => renameDeliverable(dIdx, d.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameDeliverable(dIdx, d.name)
                            if (e.key === 'Escape')
                              setDeliverableRows(prev =>
                                prev.map((r, i) => (i === dIdx ? { ...r, isEditing: false } : r))
                              )
                          }}
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-white truncate">
                          {d.name}
                        </span>
                      )}

                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>
                        {d.type}
                      </span>

                      <button
                        type="button"
                        title="Rename"
                        onClick={() =>
                          setDeliverableRows(prev =>
                            prev.map((r, i) => (i === dIdx ? { ...r, isEditing: true, expanded: true } : r))
                          )
                        }
                        className="text-slate-400 hover:text-blue-500 p-0.5"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Remove deliverable"
                        onClick={() => removeDeliverable(dIdx)}
                        className="text-slate-400 hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Task list */}
                    {d.expanded && (
                      <div className="px-3 py-2 space-y-1.5">
                        {d.tasks.map((t, tIdx) => (
                          <div key={tIdx} className="flex items-center gap-2 group">
                            <input
                              type="checkbox"
                              checked={t.include}
                              onChange={() => toggleTask(dIdx, tIdx)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                            />

                            {t.isEditing ? (
                              <input
                                className="flex-1 text-xs bg-white dark:bg-navy-800 border border-blue-400 rounded px-2 py-0.5 focus:outline-none"
                                value={t.name}
                                autoFocus
                                onChange={e => updateTask(dIdx, tIdx, { name: e.target.value })}
                                onBlur={() => updateTask(dIdx, tIdx, { isEditing: false })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === 'Escape')
                                    updateTask(dIdx, tIdx, { isEditing: false })
                                }}
                              />
                            ) : (
                              <span
                                className={`flex-1 text-xs truncate ${
                                  t.include
                                    ? 'text-slate-700 dark:text-slate-300'
                                    : 'text-slate-400 line-through'
                                }`}
                              >
                                {t.name}
                              </span>
                            )}

                            {/* Est mandays */}
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={t.estMandays}
                              onChange={e => updateTask(dIdx, tIdx, { estMandays: e.target.value })}
                              placeholder="md"
                              className="w-14 text-xs bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                            />

                            {/* Assignee */}
                            <select
                              value={t.assigneeId ?? ''}
                              onChange={e => updateTask(dIdx, tIdx, { assigneeId: e.target.value ? Number(e.target.value) : null })}
                              className="w-28 text-xs bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">— Assignee —</option>
                              {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>

                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                title="Rename"
                                onClick={() => updateTask(dIdx, tIdx, { isEditing: true })}
                                className="text-slate-400 hover:text-blue-500 p-0.5"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                title="Remove task"
                                onClick={() => removeTask(dIdx, tIdx)}
                                className="text-slate-400 hover:text-red-500 p-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Add custom task */}
                        <button
                          type="button"
                          onClick={() => addCustomTask(dIdx)}
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 mt-1"
                        >
                          <Plus className="w-3 h-3" /> Add task
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add custom deliverable */}
                <button
                  type="button"
                  onClick={addCustomDeliverable}
                  className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 py-1"
                >
                  <Plus className="w-4 h-4" /> Add deliverable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-500">{error}</p>}
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                ← Back
              </button>
            )}
            {step === 1 ? (
              <button
                onClick={handleNext}
                disabled={!selectedTemplateId}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving || !moduleName.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40"
              >
                {saving ? 'Creating...' : 'Create Module'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
