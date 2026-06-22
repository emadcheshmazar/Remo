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
