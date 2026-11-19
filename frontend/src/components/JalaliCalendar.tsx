'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  jalaliMonthDays,
  JALALI_MONTHS,
  JALALI_DAYS_SHORT,
  jalaliToIso,
  todayJalali,
  prevJalaliMonth,
  ETS_PERIOD_START_DAY,
  ETS_PERIOD_END_DAY,
  formatEtsPeriodRange,
  fromJalali,
} from '@/utils/jalali'
import { fetchHolidayMonth } from '@/utils/holidays'
import { useT } from '@/hooks/useT'
import type { DayType } from '@/types'

export interface DayUser {
  id: string
  name: string
  day_type: DayType
}

export interface DayMeta {
  users: DayUser[]
}

interface CalendarDay {
  jy: number
  jm: number
  jd: number
  iso: string
  inNamedMonth: boolean
}

interface Props {
  /** ETS period end-month (period named after this month). */
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

function weekdayIndex(jy: number, jm: number, jd: number): number {
  const [gy, gm, gd] = fromJalali(jy, jm, jd)
  const dow = new Date(gy, gm - 1, gd).getDay() // Sun=0..Sat=6
  return (dow + 1) % 7 // Shanbe=0 … Jomeh=6
}

function buildEtsPeriodDays(year: number, month: number): CalendarDay[] {
  const [py, pm] = prevJalaliMonth(year, month)
  const prevDays = jalaliMonthDays(py, pm)
  const result: CalendarDay[] = []

  for (let jd = ETS_PERIOD_START_DAY; jd <= prevDays; jd++) {
    result.push({
      jy: py,
      jm: pm,
      jd,
      iso: jalaliToIso(py, pm, jd),
      inNamedMonth: false,
    })
  }
  for (let jd = 1; jd <= ETS_PERIOD_END_DAY; jd++) {
    result.push({
      jy: year,
      jm: month,
      jd,
      iso: jalaliToIso(year, month, jd),
      inNamedMonth: true,
    })
  }
  return result
}

export function JalaliCalendar({ year, month, onMonthChange, selectedDate, onDayClick, days }: Props) {
  const t = useT()
  const [todayJy, todayJm, todayJd] = todayJalali()
  const todayIso = jalaliToIso(todayJy, todayJm, todayJd)
  const [py, pm] = prevJalaliMonth(year, month)

  const periodDays = useMemo(() => buildEtsPeriodDays(year, month), [year, month])
  const startDow = weekdayIndex(periodDays[0].jy, periodDays[0].jm, periodDays[0].jd)

  const { data: holidaysPrev = {} } = useQuery({
    queryKey: ['holidays', py, pm],
    queryFn: () => fetchHolidayMonth(py, pm),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
  const { data: holidaysCurr = {} } = useQuery({
    queryKey: ['holidays', year, month],
    queryFn: () => fetchHolidayMonth(year, month),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })

  const holidayByIso = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [day, label] of Object.entries(holidaysPrev)) {
      map[jalaliToIso(py, pm, Number(day))] = label
    }
    for (const [day, label] of Object.entries(holidaysCurr)) {
      map[jalaliToIso(year, month, Number(day))] = label
    }
    return map
  }, [holidaysPrev, holidaysCurr, py, pm, year, month])

  const prevPeriod = () => month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1)
  const nextPeriod = () => month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1)

  const cells: (CalendarDay | null)[] = [
    ...Array(startDow).fill(null),
    ...periodDays,
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div dir="rtl" className="w-full select-none">
      {/* Period nav */}
      <div className="flex items-center justify-between mb-1 px-1">
        <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-xl">›</button>
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">
            {t('ets_period')} {JALALI_MONTHS[month - 1]} {year}
          </h2>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
            {formatEtsPeriodRange(year, month)}
          </p>
        </div>
        <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-xl">‹</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700 mb-0 mt-3">
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
          const meta = days[day.iso]
          const isToday = day.iso === todayIso
          const isSelected = selectedDate === day.iso
          const holiday = holidayByIso[day.iso]
          const weekend = i % 7 === 5 || i % 7 === 6
          const dayUsers = meta?.users ?? []
          const shown = dayUsers.slice(0, 3)
          const overflow = dayUsers.length - shown.length

          return (
            <div
              key={day.iso}
              onClick={() => onDayClick(day.iso)}
              className={`border-r border-b border-gray-100 dark:border-slate-700 min-h-[90px] p-1.5 cursor-pointer transition-colors group
                ${weekend ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30'}
                ${!day.inNamedMonth && !weekend ? 'bg-slate-50/80 dark:bg-slate-900/40' : ''}
                ${isSelected ? '!bg-indigo-50 dark:!bg-indigo-950/50 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700' : ''}
              `}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-[10px] leading-tight text-right truncate max-w-[60%]
                  ${holiday ? 'text-red-500 dark:text-red-400 font-medium' : 'text-transparent'}
                `}>
                  {holiday ?? ''}
                </span>
                <div className="flex flex-col items-end shrink-0">
                  {!day.inNamedMonth && (
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 leading-none mb-0.5">
                      {JALALI_MONTHS[day.jm - 1]}
                    </span>
                  )}
                  <span className={`text-sm font-bold leading-none
                    ${isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs' : ''}
                    ${weekend && !isToday ? 'text-red-500 dark:text-red-400' : !isToday ? 'text-gray-700 dark:text-slate-300' : ''}
                    ${!day.inNamedMonth && !isToday && !weekend ? 'text-gray-400 dark:text-slate-500' : ''}
                    ${isSelected && !isToday ? 'text-indigo-700 dark:text-indigo-400' : ''}
                  `}>
                    {day.jd}
                  </span>
                </div>
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
        <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 inline-block" />
          ماه قبل (از ۲۴)
        </span>
      </div>
    </div>
  )
}
