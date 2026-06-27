'use client'

import { useQuery } from '@tanstack/react-query'
import {
  jalaliMonthDays,
  jalaliMonthStartDay,
  JALALI_MONTHS,
  JALALI_DAYS_SHORT,
  jalaliToIso,
  todayJalali,
} from '@/utils/jalali'
import { fetchHolidayMonth } from '@/utils/holidays'
import type { DayType } from '@/types'

export interface DayUser {
  id: string
  name: string
  day_type: DayType
}

export interface DayMeta {
  users: DayUser[]
}

interface Props {
  year: number
  month: number
  onMonthChange: (y: number, m: number) => void
  selectedDate?: string | null
  onDayClick: (isoDate: string) => void
  days: Record<string, DayMeta>
}

const TYPE_CHIP: Record<DayType, string> = {
  REMOTE: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700',
  LEAVE:  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700',
}

function isWeekend(startDay: number, dayNum: number): boolean {
  const dow = (startDay + dayNum - 1) % 7
  return dow === 5 || dow === 6
}

export function JalaliCalendar({ year, month, onMonthChange, selectedDate, onDayClick, days }: Props) {
  const [todayJy, todayJm, todayJd] = todayJalali()
  const daysInMonth = jalaliMonthDays(year, month)
  const startDay = jalaliMonthStartDay(year, month)

  const { data: holidays = {} } = useQuery({
    queryKey: ['holidays', year, month],
    queryFn: () => fetchHolidayMonth(year, month),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })

  const prevMonth = () => month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1)
  const nextMonth = () => month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1)

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div dir="rtl" className="w-full select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-xl">›</button>
        <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">
          {JALALI_MONTHS[month - 1]} {year}
        </h2>
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-xl">‹</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700 mb-0">
        {JALALI_DAYS_SHORT.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-semibold py-2
              ${i === 5 || i === 6 ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-slate-500'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-l border-t border-gray-100 dark:border-slate-700">
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className={`border-r border-b border-gray-100 dark:border-slate-700 min-h-[90px]
                  ${i % 7 === 5 || i % 7 === 6 ? 'bg-red-50/40 dark:bg-red-950/20' : 'bg-gray-50/30 dark:bg-slate-800/30'}`}
              />
            )
          }
          const iso = jalaliToIso(year, month, day)
          const meta = days[iso]
          const isToday = year === todayJy && month === todayJm && day === todayJd
          const isSelected = selectedDate === iso
          const holiday = holidays[day]
          const weekend = isWeekend(startDay, day)
          const dayUsers = meta?.users ?? []
          const shown = dayUsers.slice(0, 3)
          const overflow = dayUsers.length - shown.length

          return (
            <div
              key={iso}
              onClick={() => onDayClick(iso)}
              className={`border-r border-b border-gray-100 dark:border-slate-700 min-h-[90px] p-1.5 cursor-pointer transition-colors group
                ${weekend ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30'}
                ${isSelected ? '!bg-indigo-50 dark:!bg-indigo-950/50 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700' : ''}
              `}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-[10px] leading-tight text-right truncate max-w-[60%]
                  ${holiday ? 'text-red-500 dark:text-red-400 font-medium' : 'text-transparent'}
                `}>
                  {holiday ?? ''}
                </span>
                <span className={`text-sm font-bold leading-none shrink-0
                  ${isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs' : ''}
                  ${weekend && !isToday ? 'text-red-500 dark:text-red-400' : !isToday ? 'text-gray-700 dark:text-slate-300' : ''}
                  ${isSelected && !isToday ? 'text-indigo-700 dark:text-indigo-400' : ''}
                `}>
                  {day}
                </span>
              </div>

              <div className="space-y-0.5">
                {shown.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border truncate font-medium ${TYPE_CHIP[u.day_type]}`}
                  >
                    <span className={`w-1 h-1 rounded-full shrink-0 ${u.day_type === 'REMOTE' ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <span className="truncate">{u.name}</span>
                  </div>
                ))}
                {overflow > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 pr-1">+{overflow} نفر</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-sm bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 inline-block" />
          ریموت
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 inline-block" />
          مرخصی
        </span>
        <span className="flex items-center gap-1.5 text-xs text-red-400 dark:text-red-500">
          <span className="w-2 h-2 rounded-sm bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 inline-block" />
          تعطیل
        </span>
      </div>
    </div>
  )
}
