'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Kanban, Users, FolderKanban, AlertCircle, Settings, BarChart3, X, Sun, Moon, LogOut, CalendarDays, LucideIcon } from 'lucide-react'

const navItems: { href: string; label: string; Icon: LucideIcon; roles: string[]; activePrefixes?: string[] }[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, roles: ['manager', 'member'], activePrefixes: ['/dashboard'] },
  { href: '/kanban', label: 'My Kanban', Icon: Kanban, roles: ['member'] },
  { href: '/kanban', label: 'Team Kanban', Icon: Users, roles: ['manager'] },
  { href: '/projects', label: 'Projects', Icon: FolderKanban, roles: ['manager', 'member'], activePrefixes: ['/projects'] },
  { href: '/planner', label: 'Planner', Icon: CalendarDays, roles: ['manager', 'member'], activePrefixes: ['/planner'] },
  { href: '/issues', label: 'Issues', Icon: AlertCircle, roles: ['manager', 'member'] },
  { href: '/settings', label: 'Settings', Icon: Settings, roles: ['manager'] },
  { href: '/export', label: 'Report', Icon: BarChart3, roles: ['manager'] },
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
  const [counts, setCounts] = useState<{ kanban: number; issues: number } | null>(null)
  const [branding, setBranding] = useState<{ brand_name: string; brand_logo_url: string } | null>(null)
  const [userProfile, setUserProfile] = useState<{ initials: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!session) return
    fetch('/api/counts').then(r => r.json()).then(setCounts).catch(() => { })
    fetch('/api/settings').then(r => r.json()).then(s => setBranding({ brand_name: s.brand_name, brand_logo_url: s.brand_logo_url })).catch(() => { })
    fetch('/api/profile').then(r => r.json()).then(p => setUserProfile({ initials: p.initials ?? null, avatar_url: p.avatar_url ?? null })).catch(() => { })
  }, [session])

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
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0 ${branding?.brand_logo_url ? '' : 'bg-primary'}`}>
            {branding?.brand_logo_url
              ? <img src={branding.brand_logo_url} alt="logo" className="w-full h-full object-contain" />
              : (branding?.brand_name ?? 'IT Tracker').slice(0, 2).toUpperCase()
            }
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-semibold text-sm">{branding?.brand_name ?? 'IT Tracker'}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs capitalize">{role}</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
        >
          <X className="w-4 h-4" />
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                ? 'nav-active'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <item.Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {counts && item.href === '/kanban' && counts.kanban > 0 && (
                <span className={`text-[11px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${active ? 'bg-white/30 text-white' : 'bg-primary text-white opacity-80'}`}>
                  {counts.kanban}
                </span>
              )}
              {counts && item.href === '/issues' && counts.issues > 0 && (
                <span className={`text-[11px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${active ? 'bg-white/30 text-white' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'}`}>
                  {counts.issues}
                </span>
              )}
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
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        )}

        <Link
          href="/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-900 dark:text-white text-sm font-medium overflow-hidden shrink-0">
            {userProfile?.avatar_url
              ? <img src={userProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : (userProfile?.initials ?? session?.user?.name?.[0]?.toUpperCase() ?? '?')
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 dark:text-white text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{session?.user?.name}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{session?.user?.email}</p>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-white text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
