"""Tehran calendar helpers for task due-date filters.

ETS periods match the frontend: a period named after Jalali month M runs from
day 24 of the previous month through day 23 of month M.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TEHRAN = ZoneInfo("Asia/Tehran")
ETS_PERIOD_START_DAY = 24
ETS_PERIOD_END_DAY = 23


def tehran_today() -> date:
    return datetime.now(TEHRAN).date()


def tehran_week_bounds(day: date) -> tuple[date, date]:
    """Saturday–Friday week that contains `day` (Jalali week)."""
    delta = (day.weekday() - 5) % 7
    start = day - timedelta(days=delta)
    return start, start + timedelta(days=6)


def _is_gregorian_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    dpm = [31, 29 if _is_gregorian_leap(gy) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    g_d_no = (
        365 * (gy - 1600)
        + (gy - 1600 + 3) // 4
        - (gy - 1600 + 99) // 100
        + (gy - 1600 + 399) // 400
    )
    for i in range(gm - 1):
        g_d_no += dpm[i]
    g_d_no += gd - 1
    j_d_no = g_d_no - 79
    j_np = j_d_no // 12053
    j_d_no %= 12053
    jy = 979 + 33 * j_np + 4 * (j_d_no // 1461)
    j_d_no %= 1461
    if j_d_no >= 366:
        jy += (j_d_no - 1) // 365
        j_d_no = (j_d_no - 1) % 365
    jdpm = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
    jm = 0
    while jm < 11 and j_d_no >= jdpm[jm]:
        j_d_no -= jdpm[jm]
        jm += 1
    return jy, jm + 1, j_d_no + 1


def from_jalali(jy: int, jm: int, jd: int) -> tuple[int, int, int]:
    j_day_no = 365 * (jy - 979) + ((jy - 979) // 33) * 8 + (((jy - 979) % 33 + 3) // 4)
    jdpm = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
    for i in range(jm - 1):
        j_day_no += jdpm[i]
    j_day_no += jd - 1
    g_day_no = j_day_no + 79
    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097
    leap = True
    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1
        else:
            leap = False
    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461
    if g_day_no >= 366:
        leap = False
        g_day_no -= 1
        gy += g_day_no // 365
        g_day_no %= 365
    gdpm = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    while gm < 12 and g_day_no >= gdpm[gm]:
        g_day_no -= gdpm[gm]
        gm += 1
    return gy, gm + 1, g_day_no + 1


def jalali_to_date(jy: int, jm: int, jd: int) -> date:
    gy, gm, gd = from_jalali(jy, jm, jd)
    return date(gy, gm, gd)


def _prev_jalali_month(jy: int, jm: int) -> tuple[int, int]:
    return (jy - 1, 12) if jm == 1 else (jy, jm - 1)


def _next_jalali_month(jy: int, jm: int) -> tuple[int, int]:
    return (jy + 1, 1) if jm == 12 else (jy, jm + 1)


def ets_period_of(jy: int, jm: int, jd: int) -> tuple[int, int]:
    if jd >= ETS_PERIOD_START_DAY:
        return _next_jalali_month(jy, jm)
    return jy, jm


def ets_period_bounds(jy: int, jm: int) -> tuple[date, date]:
    py, pm = _prev_jalali_month(jy, jm)
    start = jalali_to_date(py, pm, ETS_PERIOD_START_DAY)
    end = jalali_to_date(jy, jm, ETS_PERIOD_END_DAY)
    return start, end


def current_ets_bounds(day: date | None = None) -> tuple[date, date]:
    day = day or tehran_today()
    jy, jm, jd = to_jalali(day.year, day.month, day.day)
    py, pm = ets_period_of(jy, jm, jd)
    return ets_period_bounds(py, pm)
