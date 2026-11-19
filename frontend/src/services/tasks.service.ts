import api from './api'
import type { TaskAttachment, TaskDetail, TaskItem, TaskLabel, TaskPriority, TaskRecurrence, TaskType, UserBrief } from '@/types'

export interface TaskListParams {
  scope?: 'mine' | 'team' | 'inbox'
  status?: string
  priority?: TaskPriority
  task_type?: TaskType
  due?: 'overdue' | 'week' | 'ets' | 'today' | 'hot'
  pipeline?: 'backlog' | 'approved'
  label_id?: string
  unsynced?: boolean
  needs_assignment?: boolean
  parent_task_id?: string
  roots_only?: boolean
  assignee_id?: string
  q?: string
}

export interface TaskWriteBody {
  title: string
  estimate_minutes?: number | null
  due_date?: string | null
  description?: string | null
  priority?: TaskPriority
  task_type?: TaskType
  reproduction_steps?: string | null
  screenshot_url?: string | null
  recurrence?: TaskRecurrence
  recurrence_until?: string | null
  parent_task_id?: string | null
  repo_name?: string | null
  auto_approve?: boolean
  assignee_ids?: string[]
  label_ids?: string[]
}

export interface TaskCreateResult {
  tasks: TaskDetail[]
}

export const tasksService = {
  list: (params: TaskListParams = {}) =>
    api.get<TaskItem[]>('/api/v1/tasks', { params }),

  get: (id: string) =>
    api.get<TaskDetail>(`/api/v1/tasks/${id}`),

  create: (body: TaskWriteBody) =>
    api.post<TaskCreateResult>('/api/v1/tasks', body),

  update: (id: string, body: Partial<TaskWriteBody>) =>
    api.patch<TaskDetail>(`/api/v1/tasks/${id}`, body),

  transition: (id: string, status: string) =>
    api.post<TaskDetail>(`/api/v1/tasks/${id}/transition`, { status }),

  cancel: (id: string) =>
    api.delete<TaskDetail>(`/api/v1/tasks/${id}`),

  retrySync: (id: string) =>
    api.post<TaskDetail>(`/api/v1/tasks/${id}/sync/retry`),

  approve: (id: string, approve = true) =>
    api.post<TaskDetail>(`/api/v1/tasks/${id}/approve`, { approve }),

  assignable: () =>
    api.get<UserBrief[]>('/api/v1/tasks/assignable-users'),

  labels: () =>
    api.get<TaskLabel[]>('/api/v1/task-labels'),

  createLabel: (title: string, color: string) =>
    api.post<TaskLabel>('/api/v1/task-labels', { title, color }),

  uploadAttachment: (taskId: string, file: File | Blob, filename?: string) => {
    const form = new FormData()
    form.append('file', file, filename || (file instanceof File ? file.name : 'recording.webm'))
    return api.post<TaskAttachment>(`/api/v1/tasks/${taskId}/attachments`, form)
  },

  deleteAttachment: (attachmentId: string) =>
    api.delete(`/api/v1/tasks/attachments/${attachmentId}`),

  downloadAttachment: async (attachmentId: string, filename: string) => {
    const response = await api.get(`/api/v1/tasks/attachments/${attachmentId}/file`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  },
}
