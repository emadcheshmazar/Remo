import api from './api'
import type { WorkSession, WorkSummary } from '@/types'

export const workService = {
  start: () => api.post<WorkSession>('/api/v1/work/start'),
  end: () => api.post<WorkSession>('/api/v1/work/end'),
  startFor: (userId: string) => api.post<WorkSession>(`/api/v1/work/${userId}/start`),
  endFor: (userId: string) => api.post<WorkSession>(`/api/v1/work/${userId}/end`),
  getSummary: () => api.get<WorkSummary>('/api/v1/work/summary'),
  getHistory: () => api.get<WorkSession[]>('/api/v1/work/history'),
  getUserHistory: (userId: string) =>
    api.get<WorkSession[]>(`/api/v1/work/history/${userId}`),
}
