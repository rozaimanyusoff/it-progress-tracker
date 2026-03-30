'use client'

import { useState, useEffect } from 'react'

interface Developer {
  id: number
  name: string
  email: string
}

interface Props {
  onClose: () => void
  onCreated: () => void
  editFeature?: {
    id: number
    title: string
    description?: string | null
    mandays: number
    status: string
    developers: { user: { id: number; name: string } }[]
  } | null
}

export default function AddFeatureModal({ onClose, onCreated, editFeature }: Props) {
  const [title, setTitle] = useState(editFeature?.title ?? '')
  const [description, setDescription] = useState(editFeature?.description ?? '')
  const [mandays, setMandays] = useState(editFeature?.mandays?.toString() ?? '1')
  const [status, setStatus] = useState(editFeature?.status ?? 'Pending')
  const [selectedDevIds, setSelectedDevIds] = useState<number[]>(
    editFeature?.developers?.map((d) => d.user.id) ?? []
  )
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setDevelopers(data))
  }, [])

  function toggleDev(id: number) {
    setSelectedDevIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (editFeature) {
        // Update feature metadata
        const res = await fetch(`/api/features/${editFeature.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, mandays: Number(mandays), status }),
        })
        if (!res.ok) throw new Error((await res.json()).error)

        // Update developers
        await fetch(`/api/features/${editFeature.id}/developers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ developer_ids: selectedDevIds }),
        })
      } else {
        const res = await fetch('/api/features', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            mandays: Number(mandays),
            developer_ids: selectedDevIds,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }

      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {editFeature ? 'Edit Feature' : 'New Feature'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estimated Mandays *</label>
            <input type="number" min="1" className={inputClass} value={mandays} onChange={(e) => setMandays(e.target.value)} required />
          </div>

          {editFeature && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
                <option value="OnHold">On Hold</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assign Developers</label>
            {developers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No members available.</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 dark:border-navy-700 rounded-lg p-2">
                {developers.map((dev) => (
                  <label key={dev.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedDevIds.includes(dev.id)}
                      onChange={() => toggleDev(dev.id)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{dev.name}</span>
                    <span className="text-xs text-slate-400">{dev.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
              {loading ? 'Saving...' : editFeature ? 'Save Changes' : 'Create Feature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
