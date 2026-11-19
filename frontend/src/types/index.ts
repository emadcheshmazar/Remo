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
  username?: string
  full_name?: string
  is_active?: boolean
  password?: string
  role?: Role
}

export type DayType = 'REMOTE' | 'LEAVE'
export type ApprovalStatus = 'APPROVED' | 'REJECTED'

export interface DayEntry {
  user_id: string
  date: string
  day_type: DayType
  set_by: string | null
  notes: string | null
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

export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'
export type TaskStatus = string
export type TaskType = 'sprint' | 'urgent'
export type JiraSyncStatus = 'pending' | 'synced' | 'error' | 'not_configured' | 'unmapped'

export interface TaskAttachment {
  id: string
  kind: 'file' | 'image' | 'audio' | string
  filename: string
  content_type: string | null
  size_bytes: number
  url: string
  uploaded_by: string | null
  created_at: string
}

export interface JiraBoardColumn {
  name: string
  status_ids?: string[]
  status_names?: string[]
}

export interface TaskAssignee {
  id: string
  username: string
  full_name: string
  position: number
}

export interface TaskLabel {
  id: string
  title: string
  color: string
}

export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type TaskPipeline = 'backlog' | 'approved'
export type TaskApprovalStatus = 'pending' | 'approved'

export interface TaskChildBrief {
  id: string
  key: string
  title: string
  status: string
  approval_status: TaskApprovalStatus
  pipeline: TaskPipeline
}

export interface TaskItem {
  id: string
  key: string
  local_key: string
  title: string
  description: string | null
  estimate_minutes: number | null
  due_date: string | null
  priority: TaskPriority
  task_type: TaskType
  needs_assignment: boolean
  pipeline: TaskPipeline
  approval_status: TaskApprovalStatus
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  parent_task_id: string | null
  parent_key: string | null
  parent_title: string | null
  repo_name: string | null
  reproduction_steps: string | null
  screenshot_url: string | null
  recurrence: TaskRecurrence
  recurrence_until: string | null
  status: TaskStatus
  reporter_id: string
  reporter_name: string
  assignees: TaskAssignee[]
  labels: TaskLabel[]
  attachments: TaskAttachment[]
  children: TaskChildBrief[]
  unmapped_assignee: string | null
  source: 'remo' | 'jira'
  jira_issue_key: string | null
  jira_sync_status: JiraSyncStatus
  jira_sync_error: string | null
  jira_url: string | null
  jira_status_id: string | null
  jira_status_name: string | null
  board_column: string | null
  jira_sprint_id: number | null
  jira_sprint_name: string | null
  jira_last_synced_at: string | null
  created_at: string
  updated_at: string
  can_edit: boolean
  can_retry_sync: boolean
  can_cancel: boolean
  can_assign: boolean
  can_approve: boolean
}

export interface TaskEvent {
  id: string
  action: string
  detail: string | null
  actor_id: string | null
  created_at: string
}

export interface TaskDetail extends TaskItem {
  events: TaskEvent[]
}

export interface UserBrief {
  id: string
  username: string
  full_name: string
  role: Role
}

export interface JiraConnection {
  base_url: string
  auth_type: 'bearer' | 'basic'
  username: string | null
  has_secret: boolean
  default_project_key: string
  default_issuetype_name: string
  default_issuetype_id: string | null
  board_id: number | null
  board_name: string | null
  board_columns: JiraBoardColumn[]
  owner_manager_id: string | null
  status_map: Record<string, string[]>
  webhook_secret: string
  webhook_url: string
  last_polled_at: string | null
  error_count: number
  configured: boolean
}

export interface JiraUserMap {
  id: string
  jira_username: string
  jira_display_name: string | null
  jira_email: string | null
  remo_user_id: string | null
}

export interface JiraSyncJob {
  id: string
  task_id: string | null
  job_type: string
  status: string
  attempts: number
  error: string | null
  detail: string | null
  created_at: string
  updated_at: string
}
