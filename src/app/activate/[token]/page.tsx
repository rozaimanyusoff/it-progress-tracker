'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'

type State = 'loading' | 'ready' | 'invalid' | 'expired' | 'already_active' | 'success' | 'submitting' | 'error'

export default function ActivatePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [state, setState] = useState<State>('loading')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch(`/api/activate/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUserName(data.name)
          setUserEmail(data.email)
          setState('ready')
        } else {
          const data = await res.json()
          if (res.status === 400) setState('already_active')
          else if (res.status === 410) setState('expired')
          else setState('invalid')
          setErrorMsg(data.error)
        }
      })
      .catch(() => setState('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    setState('submitting')
    const res = await fetch(`/api/activate/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setState('success')
      setTimeout(() => router.push('/login'), 3000)
    } else {
      const data = await res.json()
      setErrorMsg(data.error || 'Something went wrong.')
      setState('ready')
    }
  }

  const centeredScreen = 'min-h-screen flex items-center justify-center bg-slate-100 dark:bg-navy-900'

  if (state === 'loading') {
    return (
      <div className={centeredScreen}>
        <p className="text-slate-500 dark:text-slate-400">Verifying activation link...</p>
      </div>
    )
  }

  if (state === 'already_active') {
    return (
      <div className={centeredScreen}>
        <div className="text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
          <h2 className="text-slate-900 dark:text-white text-xl font-semibold mb-2">Account already activated</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Your account is already active. You can log in directly.</p>
          <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">Go to login</a>
        </div>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className={centeredScreen}>
        <div className="text-center">
          <div className="text-4xl mb-4">⏱</div>
          <h2 className="text-slate-900 dark:text-white text-xl font-semibold mb-2">Link expired</h2>
          <p className="text-slate-500 dark:text-slate-400">This activation link has expired. Please ask your manager to resend it.</p>
        </div>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className={centeredScreen}>
        <div className="text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-slate-900 dark:text-white text-xl font-semibold mb-2">Invalid link</h2>
          <p className="text-slate-500 dark:text-slate-400">This activation link is invalid or has already been used.</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className={centeredScreen}>
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-slate-900 dark:text-white text-xl font-semibold mb-2">Account activated!</h2>
          <p className="text-slate-500 dark:text-slate-400">Redirecting you to login...</p>
        </div>
      </div>
    )
  }

  const inputClass = 'w-full px-4 py-2.5 pr-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm'

  return (
    <div className={`${centeredScreen} px-4`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">IT</div>
          <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Activate your account</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{userEmail}</p>
        </div>

        <div className="rounded-xl p-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800">
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
            Hi <strong className="text-slate-900 dark:text-white">{userName}</strong>, set a password to activate your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Minimum 8 characters" className={inputClass} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Verify Password</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter your password" className={inputClass} />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
              {confirm && password !== confirm && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2.5 text-red-600 dark:text-red-300 text-sm">
                {errorMsg}
              </div>
            )}

            <button type="submit" disabled={state === 'submitting'} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {state === 'submitting' ? 'Activating...' : 'Activate Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
