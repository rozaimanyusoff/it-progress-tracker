'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞', roles: ['manager', 'member'] },
  { href: '/manager', label: 'Manager View', icon: '◈', roles: ['manager'] },
  { href: '/projects/new', label: 'New Project', icon: '+', roles: ['manager'] },
  { href: '/issues', label: 'Issues', icon: '⚠', roles: ['manager', 'member'] },
  { href: '/admin/users', label: 'Team Members', icon: '👥', roles: ['manager'] },
  { href: '/logs', label: 'Audit Logs', icon: '☰', roles: ['manager'] },
  { href: '/export', label: 'Export', icon: '↓', roles: ['manager'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role

  const filtered = navItems.filter(item => item.roles.includes(role))

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-navy-800 border-r border-navy-700 flex flex-col z-50" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
      <div className="p-6 border-b border-navy-700" style={{ borderColor: '#1e3a5f' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">IT</div>
          <div>
            <p className="text-white font-semibold text-sm">IT Tracker</p>
            <p className="text-slate-400 text-xs capitalize">{role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filtered.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-navy-700 hover:text-white'
              }`}
              style={!active ? { '--hover-bg': '#162d4a' } as any : {}}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-navy-700" style={{ borderColor: '#1e3a5f' }}>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-medium">
            {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-red-900/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
