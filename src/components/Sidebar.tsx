'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞', roles: ['manager', 'member'], activePrefixes: ['/dashboard', '/projects/'] },
  { href: '/kanban', label: 'My Kanban', icon: '▦', roles: ['member'] },
  { href: '/manager', label: 'Manager View', icon: '◈', roles: ['manager'], activePrefixes: ['/manager', '/projects/'] },
  { href: '/projects/new', label: 'New Project', icon: '+', roles: ['manager'] },
  { href: '/issues', label: 'Issues', icon: '⚠', roles: ['manager', 'member'] },
  { href: '/admin/users', label: 'Team Members', icon: '👥', roles: ['manager'] },
  { href: '/logs', label: 'Audit Logs', icon: '☰', roles: ['manager'] },
  { href: '/export', label: 'Export', icon: '↓', roles: ['manager'] },
]

interface Props {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const filtered = navItems.filter(item => item.roles.includes(role))

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen w-64 bg-white dark:bg-navy-800
        border-r border-slate-200 dark:border-navy-700
        flex flex-col z-50 transition-transform duration-200
        md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">IT</div>
          <div>
            <p className="text-slate-900 dark:text-white font-semibold text-sm">IT Tracker</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs capitalize">{role}</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filtered.map(item => {
          const isProjectDetailPage = pathname.startsWith('/projects/') && !pathname.startsWith('/projects/new')
          const active = pathname === item.href
            || pathname.startsWith(item.href + '/')
            || (item.activePrefixes?.some(p => p === '/projects/' ? isProjectDetailPage : pathname.startsWith(p)) ?? false)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-navy-700">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="text-base">{theme === 'dark' ? '☀' : '☾'}</span>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        )}

        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-900 dark:text-white text-sm font-medium">
            {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-white text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
