export type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'MEMBER'

export interface Me {
  id: string
  username: string
  full_name: string
  role: Role
}

export interface User {
  id: string
  username: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: Me
}

export interface WorkSession {
  id: string
  user_id: string
  date: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
}

export interface WorkSummary {
  is_active: boolean
  session: WorkSession | null
  total_minutes_today: number
}
