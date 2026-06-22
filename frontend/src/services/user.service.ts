import api from './api'
import type { User, UserCreate, UserUpdate } from '@/types'

export const userService = {
  list: () => api.get<User[]>('/api/v1/users'),
  create: (data: UserCreate) => api.post<User>('/api/v1/users', data),
  update: (id: string, data: UserUpdate) => api.patch<User>(`/api/v1/users/${id}`, data),
  remove: (id: string) => api.delete(`/api/v1/users/${id}`),
}
