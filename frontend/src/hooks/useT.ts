import { useLocaleStore } from '@/store/locale.store'
import { translations, TKey } from '@/utils/translations'

export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: TKey): string => translations[locale][key]
}
