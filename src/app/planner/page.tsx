'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Pencil, Check } from 'lucide-react'
import AppLayout from '@/components/Layout'

// ── Types ─────────────────────────────────────────────────────────
interface PlannerUser { id: number; name: string; initials?: string | null; avatar_url?: string | null }
interface MeetingFollowup { id: number; note: string; created_at: string; creator: { id: number; name: string } }
interface MeetingAgendaPIC { user: { id: number; name: string } }
interface MeetingAgenda {
  id: number; sort_no: number; agenda: string; issued_by: string | null
  time: string | null; details: string | null; action: string | null
  pics: MeetingAgendaPIC[]; followups: MeetingFollowup[]
}
interface MeetingAttendee { user_id: number; attended: boolean; user: PlannerUser }
interface Meeting {
  id: number; title: string; venue: string | null; date: string
  time_from: string; time_to: string
  creator: { id: number; name: string }
  attendees: MeetingAttendee[]; agendas: MeetingAgenda[]
}

// ── Helpers ───────────────────────────────────────────────────────
const iClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const lClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: toDateKey(start), end: toDateKey(end) }
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay + 6) % 7 // Mon-start
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Mini Calendar ─────────────────────────────────────────────────
function MiniCalendar({
  year, month, meetingsByDate, today, onDayClick,
}: {
  year: number; month: number
  meetingsByDate: Record<string, Meeting[]>
  today: string
  onDayClick: (dateKey: string) => void
}) {
  const cells = buildCalendarDays(year, month)
  return (
    <div className="flex-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 text-center font-semibold text-slate-800 dark:text-white text-sm">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const meetings = meetingsByDate[key] ?? []
            const isToday = key === today
            const isSat = (i % 7) === 5
            const isSun = (i % 7) === 6
            return (
              <button
                key={key}
                onClick={() => onDayClick(key)}
                className={`relative flex flex-col items-center py-1.5 rounded-lg text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : isSat || isSun ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <span className="font-medium leading-none">{day}</span>
                {meetings.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {meetings.slice(0, 3).map((_, mi) => (
                      <span key={mi} className={`w-1 h-1 rounded-full ${isToday ? 'bg-white/80' : 'bg-blue-500'}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Meeting Form ──────────────────────────────────────────────────
function MeetingForm({
  date, users, onCreated, onClose,
}: {
  date: string; users: PlannerUser[]
  onCreated: (m: Meeting) => void; onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [venue, setVenue] = useState('')
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('10:00')
  const [attendeeIds, setAttendeeIds] = useState<number[]>([])
  const [agendas, setAgendas] = useState([
    { agenda: '', issued_by: '', time: '', details: '', action: '', pic_ids: [] as number[] },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleAttendee(id: number) {
    setAttendeeIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }
  function togglePIC(ai: number, uid: number) {
    setAgendas(p => p.map((a, i) => i !== ai ? a : {
      ...a, pic_ids: a.pic_ids.includes(uid) ? a.pic_ids.filter(x => x !== uid) : [...a.pic_ids, uid],
    }))
  }
  function addAgenda() {
    setAgendas(p => [...p, { agenda: '', issued_by: '', time: '', details: '', action: '', pic_ids: [] }])
  }
  function removeAgenda(i: number) { setAgendas(p => p.filter((_, j) => j !== i)) }
  function updateAgenda(i: number, patch: Partial<typeof agendas[0]>) {
    setAgendas(p => p.map((a, j) => j !== i ? a : { ...a, ...patch }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, venue, date, time_from: timeFrom, time_to: timeTo,
        attendee_ids: attendeeIds,
        agendas: agendas.filter(a => a.agenda.trim()),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return }
    onCreated(await res.json())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">New Meeting</h2>
            <p className="text-xs text-slate-400 mt-0.5">{date}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lClass}>Meeting Title *</label>
              <input className={iClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sprint Planning" required />
            </div>
            <div className="col-span-2">
              <label className={lClass}>Venue</label>
              <input className={iClass} value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Meeting Room A / Google Meet" />
            </div>
            <div>
              <label className={lClass}>Time From</label>
              <input type="time" className={iClass} value={timeFrom} onChange={e => setTimeFrom(e.target.value)} />
            </div>
            <div>
              <label className={lClass}>Time To</label>
              <input type="time" className={iClass} value={timeTo} onChange={e => setTimeTo(e.target.value)} />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className={lClass}>Attendees</label>
            <div className="rounded-lg border border-slate-200 dark:border-navy-600 divide-y divide-slate-100 dark:divide-navy-700 max-h-48 overflow-y-auto">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                  <input type="checkbox" checked={attendeeIds.includes(u.id)} onChange={() => toggleAttendee(u.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {u.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-800 dark:text-slate-200">{u.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lClass}>Agenda</label>
              <button type="button" onClick={addAgenda} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add row</button>
            </div>
            <div className="space-y-3">
              {agendas.map((a, ai) => (
                <div key={ai} className="rounded-lg border border-slate-200 dark:border-navy-600 p-3 space-y-2 bg-slate-50/50 dark:bg-navy-900/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{ai + 1}</span>
                    <input className={`${iClass} flex-1`} placeholder="Agenda *" value={a.agenda} onChange={e => updateAgenda(ai, { agenda: e.target.value })} />
                    {agendas.length > 1 && (
                      <button type="button" onClick={() => removeAgenda(ai)} className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-7">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Issued by</p>
                      <div className="flex flex-wrap gap-1.5">
                        {users.map(u => (
                          <button key={u.id} type="button"
                            onClick={() => updateAgenda(ai, { issued_by: a.issued_by === u.name ? '' : u.name })}
                            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${a.issued_by === u.name ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input className={iClass} placeholder="Time (e.g. 09:00)" value={a.time} onChange={e => updateAgenda(ai, { time: e.target.value })} />
                    <textarea className={`${iClass} resize-none col-span-2`} rows={2} placeholder="Details" value={a.details} onChange={e => updateAgenda(ai, { details: e.target.value })} />
                    <textarea className={`${iClass} resize-none col-span-2`} rows={2} placeholder="Action" value={a.action} onChange={e => updateAgenda(ai, { action: e.target.value })} />
                  </div>
                  {/* PICs */}
                  {users.length > 0 && (
                    <div className="pl-7">
                      <p className="text-xs text-slate-500 mb-1">PIC (Person In Charge)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {users.map(u => (
                          <button
                            key={u.id} type="button"
                            onClick={() => togglePIC(ai, u.id)}
                            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${a.pic_ids.includes(u.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
                          >
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm">
              {saving ? 'Creating...' : 'Create Meeting'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Meeting Detail ────────────────────────────────────────────────
function MeetingDetail({
  meeting: initial, users, currentUserId, isManager, onClose, onDeleted,
}: {
  meeting: Meeting; users: PlannerUser[]
  currentUserId: number; isManager: boolean
  onClose: () => void; onDeleted: () => void
}) {
  const [meeting, setMeeting] = useState(initial)
  const [followupTexts, setFollowupTexts] = useState<Record<number, string>>({})
  const [addingAgenda, setAddingAgenda] = useState(false)
  const [newAgenda, setNewAgenda] = useState({ agenda: '', issued_by: '', time: '', details: '', action: '', pic_ids: [] as number[] })
  const [editingAgendaId, setEditingAgendaId] = useState<number | null>(null)
  const [editAgenda, setEditAgenda] = useState<typeof newAgenda | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(false)
  const [editMeetingForm, setEditMeetingForm] = useState({ title: initial.title, venue: initial.venue ?? '', date: initial.date.slice(0, 10), time_from: initial.time_from, time_to: initial.time_to })

  function togglePIC(uid: number, form: typeof newAgenda, setForm: (v: typeof newAgenda) => void) {
    setForm({ ...form, pic_ids: form.pic_ids.includes(uid) ? form.pic_ids.filter(x => x !== uid) : [...form.pic_ids, uid] })
  }

  async function toggleAttend(userId: number, attended: boolean) {
    const res = await fetch(`/api/meetings/${meeting.id}/attendees`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, attended }),
    })
    if (res.ok) {
      setMeeting(m => ({ ...m, attendees: m.attendees.map(a => a.user_id === userId ? { ...a, attended } : a) }))
    }
  }

  async function addFollowup(agendaId: number) {
    const note = followupTexts[agendaId]?.trim()
    if (!note) return
    const res = await fetch(`/api/meetings/${meeting.id}/agendas/${agendaId}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      const f = await res.json()
      setMeeting(m => ({ ...m, agendas: m.agendas.map(a => a.id === agendaId ? { ...a, followups: [...a.followups, f] } : a) }))
      setFollowupTexts(p => ({ ...p, [agendaId]: '' }))
    }
  }

  async function saveAgenda() {
    if (!newAgenda.agenda.trim()) return
    setSaving(true)
    const res = await fetch(`/api/meetings/${meeting.id}/agendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAgenda),
    })
    setSaving(false)
    if (res.ok) {
      const item = await res.json()
      setMeeting(m => ({ ...m, agendas: [...m.agendas, item] }))
      setNewAgenda({ agenda: '', issued_by: '', time: '', details: '', action: '', pic_ids: [] })
      setAddingAgenda(false)
    }
  }

  async function saveEditAgenda() {
    if (!editAgenda || !editingAgendaId) return
    setSaving(true)
    const res = await fetch(`/api/meetings/${meeting.id}/agendas/${editingAgendaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editAgenda),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setMeeting(m => ({ ...m, agendas: m.agendas.map(a => a.id === editingAgendaId ? updated : a) }))
      setEditingAgendaId(null); setEditAgenda(null)
    }
  }

  async function deleteAgenda(agendaId: number) {
    if (!confirm('Delete this agenda item?')) return
    const res = await fetch(`/api/meetings/${meeting.id}/agendas/${agendaId}`, { method: 'DELETE' })
    if (res.ok) setMeeting(m => ({ ...m, agendas: m.agendas.filter(a => a.id !== agendaId) }))
  }

  async function deleteMeeting() {
    if (!confirm(`Delete meeting "${meeting.title}"?`)) return
    const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted(); onClose() }
  }

  async function saveMeeting() {
    if (!editMeetingForm.title.trim()) return
    setSaving(true)
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editMeetingForm),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setMeeting(updated)
      setEditingMeeting(false)
    }
  }

  function startEditAgenda(a: MeetingAgenda) {
    setEditingAgendaId(a.id)
    setEditAgenda({ agenda: a.agenda, issued_by: a.issued_by ?? '', time: a.time ?? '', details: a.details ?? '', action: a.action ?? '', pic_ids: a.pics.map(p => p.user.id) })
  }

  const AgendaFormFields = ({ form, setForm }: { form: typeof newAgenda; setForm: (v: typeof newAgenda) => void }) => (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input className={`${iClass} col-span-2`} placeholder="Agenda *" value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} />
        <div>
          <p className="text-xs text-slate-500 mb-1">Issued by</p>
          <div className="flex flex-wrap gap-1.5">
            {users.map(u => (
              <button key={u.id} type="button"
                onClick={() => setForm({ ...form, issued_by: form.issued_by === u.name ? '' : u.name })}
                className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${form.issued_by === u.name ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
        <input className={iClass} placeholder="Time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        <textarea className={`${iClass} resize-none col-span-2`} rows={2} placeholder="Details" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} />
        <textarea className={`${iClass} resize-none col-span-2`} rows={2} placeholder="Action" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">PIC</p>
        <div className="flex flex-wrap gap-1.5">
          {users.map(u => (
            <button key={u.id} type="button" onClick={() => togglePIC(u.id, form, setForm)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${form.pic_ids.includes(u.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}>
              {u.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-navy-700">
          {editingMeeting ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <input
                    className={iClass}
                    placeholder="Meeting title"
                    value={editMeetingForm.title}
                    onChange={e => setEditMeetingForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <input
                  type="date"
                  className={iClass}
                  value={editMeetingForm.date}
                  onChange={e => setEditMeetingForm(f => ({ ...f, date: e.target.value }))}
                />
                <input
                  className={iClass}
                  placeholder="Venue"
                  value={editMeetingForm.venue}
                  onChange={e => setEditMeetingForm(f => ({ ...f, venue: e.target.value }))}
                />
                <input
                  type="time"
                  className={iClass}
                  value={editMeetingForm.time_from}
                  onChange={e => setEditMeetingForm(f => ({ ...f, time_from: e.target.value }))}
                />
                <input
                  type="time"
                  className={iClass}
                  value={editMeetingForm.time_to}
                  onChange={e => setEditMeetingForm(f => ({ ...f, time_to: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveMeeting} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  <Check className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingMeeting(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{meeting.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {meeting.date.slice(0, 10)} · {meeting.time_from}–{meeting.time_to}
                  {meeting.venue && ` · ${meeting.venue}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isManager && (
                  <>
                    <button onClick={() => { setEditMeetingForm({ title: meeting.title, venue: meeting.venue ?? '', date: meeting.date.slice(0, 10), time_from: meeting.time_from, time_to: meeting.time_to }); setEditingMeeting(true) }} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={deleteMeeting} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Attendees */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Attendees</p>
            <div className="flex flex-wrap gap-2">
              {meeting.attendees.map(a => (
                <button
                  key={a.user_id}
                  onClick={() => toggleAttend(a.user_id, !a.attended)}
                  title={a.attended ? 'Mark as not attended' : 'Mark as attended'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${a.attended ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-slate-50 dark:bg-navy-700 border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${a.attended ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  {a.user.name}
                </button>
              ))}
              {meeting.attendees.length === 0 && <p className="text-xs text-slate-400">No attendees listed.</p>}
            </div>
          </div>

          {/* Agenda table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Agenda</p>
              <button onClick={() => setAddingAgenda(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <Plus className="w-3 h-3" /> Add agenda
              </button>
            </div>

            {/* Add agenda form */}
            {addingAgenda && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3 mb-3 space-y-3">
                <AgendaFormFields form={newAgenda} setForm={setNewAgenda} />
                <div className="flex gap-2">
                  <button onClick={saveAgenda} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                    {saving ? 'Saving...' : 'Add'}
                  </button>
                  <button onClick={() => setAddingAgenda(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                </div>
              </div>
            )}

            {meeting.agendas.length === 0 && !addingAgenda && (
              <p className="text-xs text-slate-400 italic">No agenda items yet.</p>
            )}

            <div className="space-y-3">
              {meeting.agendas.map(a => (
                <div key={a.id} className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
                  {editingAgendaId === a.id && editAgenda ? (
                    <div className="p-3 bg-amber-50/40 dark:bg-amber-900/10 space-y-3">
                      <AgendaFormFields form={editAgenda} setForm={setEditAgenda as any} />
                      <div className="flex gap-2">
                        <button onClick={saveEditAgenda} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => { setEditingAgendaId(null); setEditAgenda(null) }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Agenda header row */}
                      <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-navy-700/50">
                        <span className="text-xs font-bold text-slate-400 mt-0.5 w-4 shrink-0">{a.sort_no}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{a.agenda}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {a.issued_by && <span className="text-xs text-slate-500">By: {a.issued_by}</span>}
                            {a.time && <span className="text-xs text-slate-500">Time: {a.time}</span>}
                          </div>
                          {a.details && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{a.details}</p>}
                        </div>
                        {isManager && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditAgenda(a)} className="p-1 text-slate-400 hover:text-blue-600">✎</button>
                            <button onClick={() => deleteAgenda(a.id)} className="p-1 text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>

                      {/* Action & PIC */}
                      {(a.action || a.pics.length > 0) && (
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-700 flex flex-wrap items-start gap-x-6 gap-y-1">
                          {a.action && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">Action</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300">{a.action}</p>
                            </div>
                          )}
                          {a.pics.length > 0 && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">PIC</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {a.pics.map(p => (
                                  <span key={p.user.id} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    {p.user.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Followups */}
                      <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 space-y-2 bg-white dark:bg-navy-800">
                        {a.followups.map(f => (
                          <div key={f.id} className="flex gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {f.creator.name[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="text-[10px] font-medium text-slate-500">{f.creator.name} · {new Date(f.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{f.note}</p>
                            </div>
                          </div>
                        ))}
                        {/* Add followup */}
                        <div className="flex gap-2 pt-1">
                          <input
                            className={`${iClass} flex-1 text-xs py-1.5`}
                            placeholder="Add followup / update..."
                            value={followupTexts[a.id] ?? ''}
                            onChange={e => setFollowupTexts(p => ({ ...p, [a.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addFollowup(a.id)}
                          />
                          <button
                            onClick={() => addFollowup(a.id)}
                            disabled={!followupTexts[a.id]?.trim()}
                            className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-40"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Day Modal ─────────────────────────────────────────────────────
function DayModal({
  dateKey, meetings, users, currentUserId, isManager,
  onClose, onMeetingCreated, onMeetingUpdated,
}: {
  dateKey: string; meetings: Meeting[]; users: PlannerUser[]
  currentUserId: number; isManager: boolean
  onClose: () => void
  onMeetingCreated: (m: Meeting) => void
  onMeetingUpdated: () => void
}) {
  const [mode, setMode] = useState<'pick' | 'create-meeting' | 'create-task' | 'view-meeting'>(
    meetings.length === 0 ? 'pick' : 'pick'
  )
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null)

  if (mode === 'create-meeting') {
    return <MeetingForm date={dateKey} users={users} onClose={onClose} onCreated={m => { onMeetingCreated(m); onClose() }} />
  }
  if (mode === 'view-meeting' && viewingMeeting) {
    return (
      <MeetingDetail
        meeting={viewingMeeting} users={users}
        currentUserId={currentUserId} isManager={isManager}
        onClose={onClose} onDeleted={onMeetingUpdated}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{dateKey}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Existing meetings */}
          {meetings.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Meetings</p>
              {meetings.map(m => (
                <button key={m.id} onClick={() => { setViewingMeeting(m); setMode('view-meeting') }}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.time_from}–{m.time_to}{m.venue ? ` · ${m.venue}` : ''}</p>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add to this day</p>
          <button onClick={() => setMode('create-meeting')}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            📅 Schedule Meeting
          </button>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Planner Page ─────────────────────────────────────────────
export default function PlannerPage() {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'
  const currentUserId = Number((session?.user as any)?.id)

  const today = new Date()
  const [anchorYear, setAnchorYear] = useState(today.getFullYear())
  const [anchorMonth, setAnchorMonth] = useState(today.getMonth())
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [users, setUsers] = useState<PlannerUser[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const todayKey = toDateKey(today)

  // Second month
  const m2 = anchorMonth === 11 ? { year: anchorYear + 1, month: 0 } : { year: anchorYear, month: anchorMonth + 1 }

  const fetchMeetings = useCallback(() => {
    const r1 = monthRange(anchorYear, anchorMonth)
    const r2 = monthRange(m2.year, m2.month)
    fetch(`/api/meetings?from=${r1.start}&to=${r2.end}`)
      .then(r => r.json())
      .then(data => setMeetings(Array.isArray(data) ? data : []))
  }, [anchorYear, anchorMonth])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])
  useEffect(() => {
    fetch('/api/planner/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data.map((u: any) => ({ id: u.id, name: u.name, initials: u.initials, avatar_url: u.avatar_url })))
    })
  }, [])

  // Index meetings by date key
  const meetingsByDate: Record<string, Meeting[]> = {}
  for (const m of meetings) {
    const key = m.date.slice(0, 10)
    if (!meetingsByDate[key]) meetingsByDate[key] = []
    meetingsByDate[key].push(m)
  }

  function prevMonth() {
    if (anchorMonth === 0) { setAnchorYear(y => y - 1); setAnchorMonth(11) }
    else setAnchorMonth(m => m - 1)
  }
  function nextMonth() {
    if (anchorMonth === 11) { setAnchorYear(y => y + 1); setAnchorMonth(0) }
    else setAnchorMonth(m => m + 1)
  }

  const dayMeetings = selectedDate ? (meetingsByDate[selectedDate] ?? []) : []

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Schedule meetings and track agendas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-slate-600 dark:text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-48 text-center">
            {MONTH_NAMES[anchorMonth]} {anchorYear} – {MONTH_NAMES[m2.month]} {m2.year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-slate-600 dark:text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-month calendars */}
      <div className="flex gap-4">
        <MiniCalendar year={anchorYear} month={anchorMonth} meetingsByDate={meetingsByDate} today={todayKey} onDayClick={setSelectedDate} />
        <MiniCalendar year={m2.year} month={m2.month} meetingsByDate={meetingsByDate} today={todayKey} onDayClick={setSelectedDate} />
      </div>

      {/* Upcoming meetings list */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Upcoming Meetings</p>
        {meetings.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No meetings in this period. Click a date to schedule one.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map(m => (
              <button key={m.id} onClick={() => { setSelectedDate(m.date.slice(0, 10)) }}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:shadow-sm hover:border-slate-300 dark:hover:border-navy-600 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.date.slice(0, 10)} · {m.time_from}–{m.time_to}
                      {m.venue ? ` · ${m.venue}` : ''}
                    </p>
                  </div>
                  <div className="flex -space-x-1.5 shrink-0">
                    {m.attendees.slice(0, 4).map(a => (
                      <div key={a.user_id} title={a.user.name}
                        className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-navy-800 ${a.attended ? 'bg-green-500 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-white'}`}>
                        {a.user.name[0].toUpperCase()}
                      </div>
                    ))}
                    {m.attendees.length > 4 && (
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-navy-800">
                        +{m.attendees.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateKey={selectedDate}
          meetings={dayMeetings}
          users={users}
          currentUserId={currentUserId}
          isManager={isManager}
          onClose={() => setSelectedDate(null)}
          onMeetingCreated={m => { setMeetings(prev => [...prev, m]); fetchMeetings() }}
          onMeetingUpdated={() => { fetchMeetings(); setSelectedDate(null) }}
        />
      )}
    </AppLayout>
  )
}
