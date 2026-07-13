import type { Role } from '@/types'

/** Text color for a user's name, grouped by role — same hues as the
 * role badges elsewhere (UserTable, PresenceBoard) for visual consistency. */
export const ROLE_TEXT_COLOR: Record<Role, string> = {
  ADMIN: 'text-red-600 dark:text-red-400',
  MANAGER: 'text-orange-600 dark:text-orange-400',
  SUPERVISOR: 'text-blue-600 dark:text-blue-400',
  MEMBER: 'text-gray-700 dark:text-slate-300',
}
