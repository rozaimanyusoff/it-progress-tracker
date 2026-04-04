'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

type Profile = { id: number; name: string; email: string; role: string; initials: string | null; contact_number: string | null; avatar_url: string | null }

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
   return (
      <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
         {msg}
      </div>
   )
}

export default function ProfilePage() {
   const { data: session, status } = useSession()
   const router = useRouter()
   const [profile, setProfile] = useState<Profile | null>(null)
   const [form, setForm] = useState({ name: '', initials: '', contact_number: '' })
   const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
   const [saving, setSaving] = useState(false)
   const [savingPw, setSavingPw] = useState(false)
   const [showPw, setShowPw] = useState(false)
   const [uploadingAvatar, setUploadingAvatar] = useState(false)
   const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
   const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
   const avatarInputRef = useRef<HTMLInputElement>(null)

   useEffect(() => {
      if (status === 'unauthenticated') router.replace('/login')
   }, [status, router])

   useEffect(() => {
      if (!session) return
      fetch('/api/profile').then(r => r.json()).then((p: Profile) => {
         setProfile(p)
         setForm({ name: p.name, initials: p.initials ?? '', contact_number: p.contact_number ?? '' })
         if (p.avatar_url) setAvatarPreview(p.avatar_url)
      })
   }, [session])

   function showToast(type: 'success' | 'error', msg: string) {
      setToast({ type, msg })
      setTimeout(() => setToast(null), 4000)
   }

   async function handleAvatarChange(file: File) {
      setUploadingAvatar(true)
      setAvatarPreview(URL.createObjectURL(file))
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      setUploadingAvatar(false)
      if (res.ok) {
         const { url } = await res.json()
         setProfile(p => p ? { ...p, avatar_url: url } : p)
         setAvatarPreview(url)
         showToast('success', 'Avatar updated')
      } else {
         showToast('error', (await res.json()).error ?? 'Upload failed')
         setAvatarPreview(profile?.avatar_url ?? null)
      }
   }

   async function handleSave(e: React.FormEvent) {
      e.preventDefault()
      if (!form.name.trim()) { showToast('error', 'Name is required'); return }
      setSaving(true)
      const res = await fetch('/api/profile', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: form.name, initials: form.initials, contact_number: form.contact_number }),
      })
      setSaving(false)
      if (res.ok) {
         const updated: Profile = await res.json()
         setProfile(updated)
         showToast('success', 'Profile updated')
      } else {
         showToast('error', (await res.json()).error ?? 'Failed to update profile')
      }
   }

   async function handlePasswordChange(e: React.FormEvent) {
      e.preventDefault()
      if (pwForm.new_password !== pwForm.confirm_password) { showToast('error', 'New passwords do not match'); return }
      if (pwForm.new_password.length < 8) { showToast('error', 'Password must be at least 8 characters'); return }
      setSavingPw(true)
      const res = await fetch('/api/profile', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
      })
      setSavingPw(false)
      if (res.ok) {
         setPwForm({ current_password: '', new_password: '', confirm_password: '' })
         showToast('success', 'Password changed successfully')
      } else {
         showToast('error', (await res.json()).error ?? 'Failed to change password')
      }
   }

   const initials = form.initials || form.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

   if (!profile) return null

   return (
      <Layout>
         {toast && <Toast msg={toast.msg} type={toast.type} />}

         <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Update your personal information and password</p>
         </div>

         <div className="flex flex-col items-center gap-6 w-full">

            {/* Avatar card */}
            <div className="w-full max-w-md flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
               <div
                  className="relative group cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to change avatar"
               >
                  <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ring-4 ring-slate-100 dark:ring-navy-700">
                     {avatarPreview
                        ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                        : initials
                     }
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     {uploadingAvatar
                        ? <span className="text-white text-xs">...</span>
                        : <span className="text-white text-xs font-medium">Change</span>
                     }
                  </div>
               </div>
               <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); e.target.value = '' }}
               />
               <div className="text-center">
                  <p className="font-semibold text-slate-900 dark:text-white">{profile.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
                  <span className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${profile.role === 'manager' ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                     {profile.role}
                  </span>
               </div>
               <p className="text-xs text-slate-400">Click avatar to upload a photo (JPEG, PNG, WebP — max 2MB)</p>
            </div>

            {/* Profile form */}
            <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6">
               <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Personal Information</h2>
               <form onSubmit={handleSave} className="space-y-4">
                  <div>
                     <label className={labelClass}>Full Name *</label>
                     <input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Razif" />
                  </div>
                  <div>
                     <label className={labelClass}>
                        Initials <span className="text-slate-400 font-normal">(up to 3 chars, shown in avatar if no photo)</span>
                     </label>
                     <input
                        className={inputClass}
                        value={form.initials}
                        onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase().slice(0, 3) }))}
                        placeholder="AR"
                        maxLength={3}
                     />
                     <p className="text-xs text-slate-400 mt-1">Leave blank to auto-generate from your name.</p>
                  </div>
                  <div>
                     <label className={labelClass}>Contact Number</label>
                     <input
                        className={inputClass}
                        value={form.contact_number}
                        onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))}
                        placeholder="+60 12-345 6789"
                        type="tel"
                     />
                  </div>
                  <button type="submit" disabled={saving} className="w-full px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                     {saving ? 'Saving...' : 'Save Changes'}
                  </button>
               </form>
            </div>

            {/* Password change */}
            <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6">
               <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Change Password</h2>
               <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                     <label className={labelClass}>Current Password</label>
                     <div className="relative">
                        <input
                           required
                           type={showPw ? 'text' : 'password'}
                           className={inputClass}
                           value={pwForm.current_password}
                           onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                           placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">
                           {showPw ? 'Hide' : 'Show'}
                        </button>
                     </div>
                  </div>
                  <div>
                     <label className={labelClass}>New Password</label>
                     <input
                        required
                        type={showPw ? 'text' : 'password'}
                        className={inputClass}
                        value={pwForm.new_password}
                        onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                        placeholder="At least 8 characters"
                     />
                  </div>
                  <div>
                     <label className={labelClass}>Confirm New Password</label>
                     <input
                        required
                        type={showPw ? 'text' : 'password'}
                        className={inputClass}
                        value={pwForm.confirm_password}
                        onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                        placeholder="Repeat new password"
                     />
                  </div>
                  <button type="submit" disabled={savingPw} className="w-full px-5 py-2 bg-slate-800 dark:bg-navy-600 hover:bg-slate-700 dark:hover:bg-navy-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                     {savingPw ? 'Changing...' : 'Change Password'}
                  </button>
               </form>
            </div>

         </div>
      </Layout>
   )
}
