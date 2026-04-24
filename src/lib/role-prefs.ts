import { prisma } from '@/lib/prisma'

export type RolePerm = {
   create: boolean
   update: boolean
   view: boolean
   delete: boolean
   receive_notifications: boolean
   assignable: boolean
}

const DEFAULTS: Record<string, RolePerm> = {
   manager: { create: true, update: true, view: true, delete: true, receive_notifications: true, assignable: true },
   member: { create: true, update: true, view: true, delete: false, receive_notifications: true, assignable: true },
}

export async function getRolePreferences(): Promise<Record<string, RolePerm>> {
   const row = await prisma.appSetting.findUnique({ where: { key: 'role_preferences' } })
   if (!row?.value) return DEFAULTS
   try {
      const parsed = JSON.parse(row.value)
      if (!parsed || typeof parsed !== 'object') return DEFAULTS
      const result: Record<string, RolePerm> = {}
      for (const [roleName, perms] of Object.entries(parsed as Record<string, Partial<RolePerm>>)) {
         result[roleName] = {
            create: Boolean(perms?.create),
            update: Boolean(perms?.update),
            view: Boolean(perms?.view),
            delete: Boolean(perms?.delete),
            receive_notifications: perms?.receive_notifications !== undefined
               ? Boolean(perms.receive_notifications)
               : (DEFAULTS[roleName]?.receive_notifications ?? true),
            assignable: perms?.assignable !== undefined
               ? Boolean(perms.assignable)
               : (DEFAULTS[roleName]?.assignable ?? true),
         }
      }
      return result
   } catch {
      return DEFAULTS
   }
}

export async function canReceiveNotifications(
   user: { role: string; display_role: string | null }
): Promise<boolean> {
   const prefs = await getRolePreferences()
   const effectiveRole = user.display_role || user.role
   const rolePerm = prefs[effectiveRole] ?? prefs[user.role]
   // If role not found in prefs, default to true (don't silently suppress)
   return rolePerm ? rolePerm.receive_notifications : true
}

/**
 * Filter a list of users, returning only those whose role has receive_notifications enabled.
 */
export async function filterUsersCanReceiveNotifications<
   T extends { role: string; display_role?: string | null }
>(users: T[]): Promise<T[]> {
   const prefs = await getRolePreferences()
   return users.filter(u => {
      const effectiveRole = u.display_role || u.role
      const rolePerm = prefs[effectiveRole] ?? prefs[u.role]
      return rolePerm ? rolePerm.receive_notifications : true
   })
}
