import axios from 'axios'
import { useLocaleStore } from '@/store/locale.store'
import { translations } from '@/utils/translations'

/** Extracts a clear, user-facing message from an API error — a network
 * failure, a backend `detail` string, or a generic fallback — usable both
 * inside and outside React components (reads the locale store directly). */
export function getErrorMessage(error: unknown): string {
  const t = translations[useLocaleStore.getState().locale]

  if (axios.isAxiosError(error)) {
    if (!error.response) return t.network_error
    const detail = error.response.data?.detail
    if (typeof detail === 'string' && detail) return detail
  }
  return t.error
}
