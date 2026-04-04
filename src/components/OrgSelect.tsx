'use client'
import { useState, useEffect } from 'react'

export type OrgItem = { id: number; name: string }
type OrgType = 'unit' | 'dept' | 'company'

interface OrgSelectProps {
   type: OrgType
   label: string
   value: number | null
   onChange: (id: number | null) => void
   className?: string
}

const CREATE_NEW = '__new__'

export default function OrgSelect({ type, label, value, onChange, className = '' }: OrgSelectProps) {
   const [items, setItems] = useState<OrgItem[]>([])
   const [creating, setCreating] = useState(false)
   const [newName, setNewName] = useState('')
   const [saving, setSaving] = useState(false)

   useEffect(() => {
      fetch(`/api/org?type=${type}`)
         .then(r => r.json())
         .then(d => setItems(Array.isArray(d) ? d : []))
   }, [type])

   const inputClass = `w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`
   const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

   function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
      if (e.target.value === CREATE_NEW) {
         setCreating(true)
      } else {
         setCreating(false)
         onChange(e.target.value ? Number(e.target.value) : null)
      }
   }

   async function handleCreate(e: React.FormEvent) {
      e.preventDefault()
      if (!newName.trim()) return
      setSaving(true)
      const res = await fetch('/api/org', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ type, name: newName.trim() }),
      })
      setSaving(false)
      if (res.ok) {
         const item: OrgItem = await res.json()
         setItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
         onChange(item.id)
         setCreating(false)
         setNewName('')
      }
   }

   function handleCancel() {
      setCreating(false)
      setNewName('')
   }

   return (
      <div>
         <label className={labelClass}>{label}</label>
         {!creating ? (
            <select className={inputClass} value={value ?? ''} onChange={handleChange}>
               <option value="">— None —</option>
               {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
               ))}
               <option value={CREATE_NEW}>＋ Create new {label.toLowerCase()}…</option>
            </select>
         ) : (
            <form onSubmit={handleCreate} className="flex gap-2 items-center">
               <input
                  autoFocus
                  className={inputClass}
                  placeholder={`New ${label.toLowerCase()} name…`}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
               />
               <button
                  type="submit"
                  disabled={saving || !newName.trim()}
                  className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shrink-0"
               >
                  {saving ? '…' : 'Add'}
               </button>
               <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-2 text-xs bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 rounded-lg shrink-0"
               >
                  ✕
               </button>
            </form>
         )}
      </div>
   )
}
