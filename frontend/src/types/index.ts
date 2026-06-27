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
  supervisor_id: string | null
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

export type StatusState = 'AVAILABLE' | 'OFFLINE' | 'FOCUS' | 'BREAK' | 'MEETING'
export type ActivityTag = 'FOCUS' | 'BREAK' | 'MEETING'

export interface UserStatus {
  user_id: string
  status: StatusState
  updated_at: string
}

export interface DailyReport {
  id: string
  user_id: string
  date: string
  today_text: string
  blockers_text: string
  tomorrow_text: string
  updated_at: string
}

export interface UserCreate {
  username: string
  password: string
  full_name: string
  role: Role
}

export interface UserUpdate {
  full_name?: string
  is_active?: boolean
  password?: string
}

export type DayType = 'REMOTE' | 'LEAVE'
export type ApprovalStatus = 'APPROVED' | 'REJECTED'

export interface DayEntry {
  user_id: string
  date: string
  day_type: DayType
  set_by: string | null
  approval_status: ApprovalStatus | null
  approved_by: string | null
  approved_minutes: number | null
  approved_at: string | null
}

export interface DayStats {
  date: string
  day_type: DayType | null
  total_work_minutes: number
  focus_minutes: number
  break_minutes: number
  meeting_minutes: number
  approval_status: ApprovalStatus | null
  approved_by: string | null
  approved_minutes: number | null
}

export interface PingData {
  check_id: string
  target_user_id: string
  from_user_id: string
  from_name: string
  message: string
}

export interface PingResultData {
  check_id: string
  from_user_id: string
  target_user_id: string
  target_name: string
  reply_message: string
}

export type EventType = 'SESSION_START' | 'SESSION_END' | 'STATUS_CHANGE' | 'REPORT_SUBMITTED'

export interface TimelineEvent {
  id: string
  user_id: string
  event_type: EventType
  payload: Record<string, unknown>
  occurred_at: string
}
