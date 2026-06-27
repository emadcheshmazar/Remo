import api from './api'
import type { ApprovalStatus, DayEntry, DayStats, DayType, TimelineEvent, DailyReport, User } from '@/types'

export const calendarService = {
  getMyTodayEntry: () =>
    api.get<DayEntry | null>('/api/v1/calendar/me/today'),

  getCalendarUsers: () =>
    api.get<User[]>('/api/v1/calendar/team-users'),

  getUserMonth: (userId: string, start: string, end: string) =>
    api.get<DayEntry[]>(`/api/v1/calendar/${userId}`, { params: { start, end } }),

  getTeamMonth: (start: string, end: string) =>
    api.get<DayEntry[]>('/api/v1/calendar/team', { params: { start, end } }),

  getDayStats: (userId: string, date: string) =>
    api.get<DayStats>(`/api/v1/calendar/${userId}/stats`, { params: { date } }),

  setDayType: (userId: string, date: string, day_type: DayType) =>
    api.put<DayEntry>(`/api/v1/calendar/${userId}/${date}`, { day_type }),

  clearDay: (userId: string, date: string) =>
    api.delete(`/api/v1/calendar/${userId}/${date}`),

  approveDay: (userId: string, date: string, status: ApprovalStatus, approved_minutes: number | null) =>
    api.post<DayEntry>(`/api/v1/calendar/${userId}/${date}/approve`, { status, approved_minutes }),

  clearApproval: (userId: string, date: string) =>
    api.delete<DayEntry>(`/api/v1/calendar/${userId}/${date}/approve`),

  getTimelineByDate: (userId: string, date: string) =>
    api.get<TimelineEvent[]>(`/api/v1/timeline/${userId}/by-date`, { params: { date } }),

  getReportByDate: (userId: string, date: string) =>
    api.get<DailyReport | null>(`/api/v1/reports/${userId}/${date}`),
}
