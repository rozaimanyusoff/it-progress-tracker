import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { getRolePreferences } from '@/lib/role-prefs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const includeManagers = searchParams.get('include_managers') === 'true'
  const roles: Role[] = includeManagers ? [Role.member, Role.manager] : [Role.member]

  const users = await prisma.user.findMany({
    where: { role: { in: roles }, is_active: true },
    select: { id: true, name: true, email: true, role: true, display_role: true },
    orderBy: { name: 'asc' },
  })

  // Filter out users whose effective role has assignable: false
  const rolePrefs = await getRolePreferences()
  const assignable = users.filter(u => {
    const effectiveRole = u.display_role || u.role
    const perm = rolePrefs[effectiveRole] ?? rolePrefs[u.role]
    return perm ? perm.assignable : true
  })

  return NextResponse.json(assignable.map(({ id, name, email }) => ({ id, name, email })))
}
