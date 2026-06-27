import api from './api'
import type { UserStatus, ActivityTag } from '@/types'

export const statusService = {
  getMyStatus: () => api.get<UserStatus | null>('/api/v1/status/me'),
  setTag: (tag: ActivityTag | null) =>
    api.patch<UserStatus>('/api/v1/status/me', { tag }),
  getAll: () => api.get<UserStatus[]>('/api/v1/status'),
  sendPing: (userId: string, message: string) =>
    api.post<{ check_id: string }>(`/api/v1/status/ping/${userId}`, { message }),
  respondPing: (checkId: string, fromUserId: string, replyMessage: string) =>
    api.post(`/api/v1/status/ping/${checkId}/respond`, { from_user_id: fromUserId, reply_message: replyMessage }),
}
