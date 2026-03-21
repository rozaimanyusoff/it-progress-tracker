'use client'

import { useState, useEffect } from 'react'
import AddFeatureModal from './AddFeatureModal'
import FeatureTaskList from './FeatureTaskList'

interface Developer {
  user: { id: number; name: string }
}

interface UnitMember {
  id: number
  name: string
}

interface Feature {
  id: number
  title: string
  description?: string | null
  mandays: number
  status: string
  planned_start: string
  planned_end: string
  actual_start?: string | null
  actual_end?: string | null
  created_by: { id: number; name: string }
  developers: Developer[]
  tasks: { status: string }[]
}

interface Props {
  projectId: number
  unitId: number
  userRole: string
}

const STATUS_BADGE: Record<string, string> = {
  Pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}
const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending', InProgress: 'In Progress', Done: 'Done', OnHold: 'On Hold',
}

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FeaturesSection({ projectId, unitId, userRole }: Props) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [unitMembers, setUnitMembers] = useState<UnitMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    fetchFeatures()
    fetchUnitMembers()
  }, [projectId])

  async function fetchUnitMembers() {
    const res = await fetch(`/api/users`)
    const data = await res.json()
    setUnitMembers(data)
  }

  async function fetchFeatures() {
    setLoading(true)
    const res = await fetch(`/api/features?project_id=${projectId}`)
    const data = await res.json()
    setFeatures(data)
    setLoading(false)
  }

  async function deleteFeature(id: number, title: string) {
    if (!confirm(`Delete feature "${title}" and all its tasks?`)) return
    const res = await fetch(`/api/features/${id}`, { method: 'DELETE' })
    if (res.ok) setFeatures((prev) => prev.filter((f) => f.id !== id))
  }

  function taskProgress(tasks: { status: string }[]) {
    const done = tasks.filter((t) => t.status === 'Done').length
    return { done, total: tasks.length, pct: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0 }
  }

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Features</h2>
        {userRole === 'manager' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            + Add Feature
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Loading features...</p>
      ) : features.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No features yet.{userRole === 'manager' ? ' Add your first feature above.' : ''}</p>
      ) : (
        <div className="space-y-4">
          {features.map((feature) => {
            const { done, total, pct } = taskProgress(feature.tasks)
            const isExpanded = expandedId === feature.id

            return (
              <div key={feature.id} className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-slate-900 dark:text-white">{feature.title}</h3>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[feature.status]}`}>
                          {STATUS_LABELS[feature.status]}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{feature.mandays} manday{feature.mandays !== 1 ? 's' : ''}</span>
                      </div>
                      {feature.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{feature.description}</p>
                      )}

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>Planned: {fmt(feature.planned_start)} → {fmt(feature.planned_end)}</span>
                        <span>
                          Actual: {feature.actual_start ? fmt(feature.actual_start) : 'Not started'}
                          {feature.actual_start ? ` → ${feature.actual_end ? fmt(feature.actual_end) : 'In progress'}` : ''}
                        </span>
                      </div>

                      {/* Developers */}
                      {feature.developers.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 flex-wrap">
                          {feature.developers.map((d) => (
                            <span key={d.user.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                              {d.user.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Task progress bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {done}/{total} tasks
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {userRole === 'manager' && (
                        <>
                          <button
                            onClick={() => setEditingFeature(feature)}
                            className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteFeature(feature.id, feature.title)}
                            className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : feature.id)}
                        className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300"
                      >
                        {isExpanded ? 'Hide Tasks' : 'View Tasks'}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
                    <FeatureTaskList
                      featureId={feature.id}
                      userRole={userRole}
                      developers={unitMembers.map((m) => ({ user: m }))}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <AddFeatureModal
          projectId={projectId}
          unitId={unitId}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchFeatures}
        />
      )}

      {editingFeature && (
        <AddFeatureModal
          projectId={projectId}
          unitId={unitId}
          onClose={() => setEditingFeature(null)}
          onCreated={() => { fetchFeatures(); setEditingFeature(null) }}
          editFeature={editingFeature}
        />
      )}
    </div>
  )
}
