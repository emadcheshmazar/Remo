import api from './api'
import type { TimelineEvent } from '@/types'

export const timelineService = {
  getMine: () => api.get<TimelineEvent[]>('/api/v1/timeline/me'),
  getToday: () => api.get<TimelineEvent[]>('/api/v1/timeline/me/today'),
  getUser: (userId: string) => api.get<TimelineEvent[]>(`/api/v1/timeline/${userId}`),
}
