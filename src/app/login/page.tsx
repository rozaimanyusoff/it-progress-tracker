'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState<{ brand_name: string; brand_logo_url: string; login_bg_url: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/settings/branding').then(r => r.json()).then(s => setBranding({ brand_name: s.brand_name, brand_logo_url: s.brand_logo_url, login_bg_url: s.login_bg_url ?? '' })).catch(() => { })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-200 dark:bg-navy-900"
      style={branding?.login_bg_url ? { backgroundImage: `url(${branding.login_bg_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div className="w-full max-w-md px-4">
        <div className="bg-white/60 dark:bg-navy-800/60 backdrop-blur-2xl rounded-2xl shadow-2xl p-8 border border-white/70 dark:border-white/10">
          <div className="mb-8 text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden ${branding?.brand_logo_url ? '' : 'bg-blue-600'}`}>
              {branding?.brand_logo_url
                ? <img src={branding.brand_logo_url} alt="logo" className="w-full h-full object-contain" />
                : <ShieldCheck className="w-8 h-8 text-white" />
              }
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{branding?.brand_name ?? 'IT Progress Tracker'}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/50 dark:bg-navy-900/60 border border-white/80 dark:border-navy-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                placeholder="admin@it.local"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/50 dark:bg-navy-900/60 border border-white/80 dark:border-navy-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-slate-400 text-xs mt-6">
            Manager: admin@it.local / admin123 · Members: alice/bob/carol@it.local / member123
          </p>
        </div>
      </div>
    </div>
  )
}
