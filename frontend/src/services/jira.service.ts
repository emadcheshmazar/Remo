import api from './api'
import type { JiraConnection, JiraSyncJob, JiraUserMap, UserBrief } from '@/types'

export interface JiraConnectionWrite {
  base_url: string
  auth_type: 'bearer' | 'basic'
  username?: string | null
  secret?: string | null
  default_project_key: string
  default_issuetype_name?: string
  default_issuetype_id?: string | null
  board_id?: number | null
  board_name?: string | null
  owner_manager_id?: string | null
  status_map?: Record<string, string[]>
}

export interface JiraBoard {
  id: number
  name: string
  type?: string
}

export interface JiraSprint {
  id: number
  name: string
  state: string
  startDate?: string
  endDate?: string
  completeDate?: string
}

export interface JiraPersonPreview {
  jira_username: string
  jira_display_name: string | null
  jira_email: string | null
  active: boolean
  status: 'mapped' | 'unmatched' | 'conflict'
  remo_user_id: string | null
  remo_full_name: string | null
  remo_username: string | null
  suggested_username: string | null
}

export interface JiraPeopleImportRequest {
  people: {
    jira_username: string
    jira_display_name?: string | null
    jira_email?: string | null
    role?: 'MEMBER' | 'SUPERVISOR'
    supervisor_id?: string | null
    remo_user_id?: string | null
  }[]
  default_role?: 'MEMBER' | 'SUPERVISOR'
  default_supervisor_id?: string | null
}

export interface JiraPeopleImportResult {
  imported: {
    jira_username: string
    action: 'created' | 'linked' | 'skipped'
    remo_user_id: string | null
    remo_username: string | null
    temporary_password: string | null
    detail: string | null
  }[]
  created_count: number
  linked_count: number
  skipped_count: number
}

export const jiraService = {
  connection: () =>
    api.get<JiraConnection | null>('/api/v1/jira/connection'),

  saveConnection: (body: JiraConnectionWrite) =>
    api.put<JiraConnection>('/api/v1/jira/connection', body),

  test: (body: JiraConnectionWrite) =>
    api.post<{
      myself: string
      server_title?: string
      version?: string
      deployment?: string
      project_ok: boolean
      projects: { key: string; name: string }[]
      boards?: JiraBoard[]
    }>('/api/v1/jira/connection/test', body),

  projects: () =>
    api.get<{ id: string; key: string; name: string }[]>('/api/v1/jira/projects'),

  issueTypes: (project: string) =>
    api.get<Record<string, unknown>>('/api/v1/jira/issuetypes', { params: { project } }),

  boards: (project?: string) =>
    api.get<JiraBoard[]>('/api/v1/jira/boards', { params: { project } }),

  sprints: (boardId?: number | null, state = 'active,closed') =>
    api.get<JiraSprint[]>('/api/v1/jira/sprints', { params: { board_id: boardId || undefined, state } }),

  syncBoard: (boardId?: number | null) =>
    api.post<JiraConnection>('/api/v1/jira/board/sync', null, { params: { board_id: boardId || undefined } }),

  saveStatusMap: (status_map: Record<string, string[]>) =>
    api.put<Record<string, string[]>>('/api/v1/jira/status-map', { status_map }),

  userMap: () =>
    api.get<JiraUserMap[]>('/api/v1/jira/user-map'),

  saveUserMap: (items: Omit<JiraUserMap, 'id'>[]) =>
    api.put<JiraUserMap[]>('/api/v1/jira/user-map', { items }),

  remoUsers: () =>
    api.get<UserBrief[]>('/api/v1/jira/remo-users'),

  searchUsers: (q: string) =>
    api.get<{ name: string; displayName?: string; emailAddress?: string }[]>('/api/v1/jira/users/search', { params: { q } }),

  previewPeople: (project?: string) =>
    api.get<JiraPersonPreview[]>('/api/v1/jira/people/preview', { params: { project } }),

  importPeople: (body: JiraPeopleImportRequest) =>
    api.post<JiraPeopleImportResult>('/api/v1/jira/people/import', body),

  jobs: () =>
    api.get<JiraSyncJob[]>('/api/v1/jira/sync/jobs'),

  pull: (sprintId?: number | null) =>
    api.post<{ updated: number }>('/api/v1/jira/sync/pull', sprintId ? { sprint_id: sprintId } : undefined),

  registerWebhook: (callback_url?: string) =>
    api.post<{ ok: boolean; url: string }>('/api/v1/jira/webhook/register', { callback_url: callback_url || null }),
}
