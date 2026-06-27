// Fixed solar (Jalali) holidays — same date every year
const FIXED_HOLIDAYS: Record<string, string> = {
  '1/1':  'عید نوروز',
  '1/2':  'عید نوروز',
  '1/3':  'عید نوروز',
  '1/4':  'عید نوروز',
  '1/12': 'روز جمهوری اسلامی',
  '1/13': 'سیزده بدر',
  '3/14': 'رحلت امام خمینی',
  '3/15': 'قیام پانزده خرداد',
  '11/22': 'پیروزی انقلاب اسلامی',
  '12/29': 'ملی شدن صنعت نفت',
}

export function getFixedHoliday(jm: number, jd: number): string | null {
  return FIXED_HOLIDAYS[`${jm}/${jd}`] ?? null
}

interface HolidayEntry {
  day: number
  month: number
  year: number
  event: string
  is_holiday: number
}

// Try to fetch from holidayapi.ir (may or may not be accessible)
export async function fetchHolidayMonth(jy: number, jm: number): Promise<Record<number, string>> {
  const fixed: Record<number, string> = {}
  // Always include fixed holidays for this month
  for (let d = 1; d <= 31; d++) {
    const h = getFixedHoliday(jm, d)
    if (h) fixed[d] = h
  }
  try {
    const res = await fetch(`https://holidayapi.ir/jalali/${jy}/${jm}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return fixed
    const data: HolidayEntry[] = await res.json()
    const api: Record<number, string> = { ...fixed }
    for (const h of data) {
      if (h.is_holiday) api[h.day] = h.event
    }
    return api
  } catch {
    return fixed
  }
}
