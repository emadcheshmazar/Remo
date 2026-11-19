'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { tasksService } from '@/services/tasks.service'
import { useT } from '@/hooks/useT'
import { PRIORITY_CLASS, PRIORITY_KEY, statusText } from './taskUi'

export function DueTodayWidget() {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['tasks-due-today'],
    queryFn: () => tasksService.list({ scope: 'mine', due: 'today' }).then((r) => r.data),
  })
  const tasks = (data || []).filter((task) => task.status !== 'done' && task.status !== 'cancelled')

  return (
    <div className="remo-panel p-4 w-full max-w-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-accent-700 dark:text-accent-300">{t('task_workspace')}</p>
          <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-ink-50">{t('due_today_tasks')}</h2>
        </div>
        <Link href="/tasks?due=today" className="remo-btn-ghost text-xs text-accent-700 dark:text-accent-300">
          {t('tasks')}
        </Link>
      </div>
      {isLoading ? (
        <div className="h-10 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" />
      ) : tasks.length === 0 ? (
        <p className="remo-hint">{t('no_due_today')}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 5).map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-ink-50 dark:hover:bg-ink-800/60"
              >
                <span className="truncate text-ink-800 dark:text-ink-100">{task.title}</span>
                <span className={`remo-chip shrink-0 ${PRIORITY_CLASS[task.priority]}`}>
                  {t(PRIORITY_KEY[task.priority])} · {statusText(task.board_column || task.status, t)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
