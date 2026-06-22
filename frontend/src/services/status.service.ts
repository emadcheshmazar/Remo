import api from './api'
import type { UserStatus, StatusState } from '@/types'

export const statusService = {
  getMyStatus: () => api.get<UserStatus | null>('/api/v1/status/me'),
  updateMyStatus: (status: StatusState) =>
    api.patch<UserStatus>('/api/v1/status/me', { status }),
  getAll: () => api.get<UserStatus[]>('/api/v1/status'),
}
