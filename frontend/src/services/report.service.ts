import api from './api'
import type { DailyReport } from '@/types'

interface ReportUpsert {
  today_text: string
  blockers_text: string
  tomorrow_text: string
}

export const reportService = {
  getToday: () => api.get<DailyReport | null>('/api/v1/reports/today'),
  upsertToday: (data: ReportUpsert) =>
    api.put<DailyReport>('/api/v1/reports/today', data),
  listMine: () => api.get<DailyReport[]>('/api/v1/reports/me'),
  listUser: (userId: string) => api.get<DailyReport[]>(`/api/v1/reports/${userId}`),
}
