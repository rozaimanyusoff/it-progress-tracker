'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [branding, setBranding] = useState<{ brand_name: string; brand_logo_url: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setBranding({ brand_name: s.brand_name, brand_logo_url: s.brand_logo_url })).catch(() => { })
  }, [])

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-navy-900">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0 ${branding?.brand_logo_url ? '' : 'bg-blue-600'}`}>
              {branding?.brand_logo_url
                ? <img src={branding.brand_logo_url} alt="logo" className="w-full h-full object-contain" />
                : (branding?.brand_name ?? 'IT Tracker').slice(0, 2).toUpperCase()
              }
            </div>
            <span className="font-semibold text-slate-900 dark:text-white text-sm">{branding?.brand_name ?? 'IT Tracker'}</span>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
