// ─── Gregorian → Jalali ───────────────────────────────────────────────────────
// Standard algorithm; the critical -79 offset aligns Gregorian/Jalali epochs.
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const dpm = [31, isLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let g_d_no = 365 * (gy - 1600) + Math.floor((gy - 1600 + 3) / 4) -
    Math.floor((gy - 1600 + 99) / 100) + Math.floor((gy - 1600 + 399) / 400)
  for (let i = 0; i < gm - 1; i++) g_d_no += dpm[i]
  g_d_no += gd - 1

  let j_d_no = g_d_no - 79                          // ← critical -79 offset

  let j_np = Math.floor(j_d_no / 12053)
  j_d_no %= 12053
  let jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no / 1461)
  j_d_no %= 1461
  if (j_d_no >= 366) {
    jy += Math.floor((j_d_no - 1) / 365)
    j_d_no = (j_d_no - 1) % 365
  }
  const jdpm = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
  let jm = 0
  while (jm < 11 && j_d_no >= jdpm[jm]) { j_d_no -= jdpm[jm]; jm++ }
  return [jy, jm + 1, j_d_no + 1]
}

// ─── Jalali → Gregorian ───────────────────────────────────────────────────────
export function fromJalali(jy: number, jm: number, jd: number): [number, number, number] {
  let j_day_no = 365 * (jy - 979) + Math.floor((jy - 979) / 33) * 8 +
    Math.floor(((jy - 979) % 33 + 3) / 4)
  const jdpm = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
  for (let i = 0; i < jm - 1; i++) j_day_no += jdpm[i]
  j_day_no += jd - 1
  let g_day_no = j_day_no + 79
  let gy = 1600 + 400 * Math.floor(g_day_no / 146097)
  g_day_no %= 146097
  let leap = true
  if (g_day_no >= 36525) {
    g_day_no--
    gy += 100 * Math.floor(g_day_no / 36524)
    g_day_no %= 36524
    if (g_day_no >= 365) g_day_no++
    else leap = false
  }
  gy += 4 * Math.floor(g_day_no / 1461)
  g_day_no %= 1461
  if (g_day_no >= 366) {
    leap = false
    g_day_no--
    gy += Math.floor(g_day_no / 365)
    g_day_no %= 365
  }
  const gdpm = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  while (gm < 12 && g_day_no >= gdpm[gm]) { g_day_no -= gdpm[gm]; gm++ }
  return [gy, gm + 1, g_day_no + 1]
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

export const JALALI_WEEKDAYS = [
  'شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه',
]

// Short weekday headers — starts Saturday (شنبه)
export const JALALI_DAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  const [gy] = fromJalali(jy, 12, 1)
  return (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 30 : 29
}

// Weekday index (0=شنبه … 6=جمعه) of the 1st day of a Jalali month
export function jalaliMonthStartDay(jy: number, jm: number): number {
  const [gy, gm, gd] = fromJalali(jy, jm, 1)
  const dow = new Date(gy, gm - 1, gd).getDay() // Sun=0..Sat=6
  return (dow + 1) % 7  // Shanbe=0, Yek=1 … Jomeh=6
}

export function todayJalali(): [number, number, number] {
  const n = new Date()
  return toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

// Full Jalali datetime string: "چهارشنبه ۱۴۰۵/۰۴/۰۳ ۱۷:۲۵"
export function nowJalaliString(): string {
  const n = new Date()
  const [jy, jm, jd] = toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate())
  const dow = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getDay()
  const weekday = JALALI_WEEKDAYS[(dow + 1) % 7]
  const hh = String(n.getHours()).padStart(2, '0')
  const mm = String(n.getMinutes()).padStart(2, '0')
  return `${weekday} ${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')} ${hh}:${mm}`
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = fromJalali(jy, jm, jd)
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

export function isoToJalali(iso: string): [number, number, number] {
  const [gy, gm, gd] = iso.split('-').map(Number)
  return toJalali(gy, gm, gd)
}

export function formatJalali(jy: number, jm: number, jd: number): string {
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`
}

// Returns [startIso, endIso] of a full Jalali month in ISO format.
// A Jalali month can span two Gregorian months, so we need the full range.
export function jalaliMonthIsoRange(jy: number, jm: number): [string, string] {
  const startIso = jalaliToIso(jy, jm, 1)
  const endIso = jalaliToIso(jy, jm, jalaliMonthDays(jy, jm))
  return [startIso, endIso]
}
