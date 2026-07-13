import { APP_VERSION } from '@/config/version'

export function AppVersion() {
  return (
    <span
      aria-label={`App version ${APP_VERSION}`}
      className="pointer-events-none fixed bottom-1 left-1 z-[90] select-none font-mono text-[10px] leading-none text-gray-400 dark:text-slate-500"
    >
      {APP_VERSION}
    </span>
  )
}
