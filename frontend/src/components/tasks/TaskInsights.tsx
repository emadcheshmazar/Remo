'use client'

import type { TaskItem } from '@/types'
import { useT } from '@/hooks/useT'

interface Props {
  tasks: TaskItem[]
  onHot: () => void
  onBacklog: () => void
  onUnsynced: () => void
  onInbox: () => void
  showInbox: boolean
}

export function TaskInsights({ tasks, onHot, onBacklog, onUnsynced, onInbox, showInbox }: Props) {
  const t = useT()
  const open = (task: TaskItem) => task.status !== 'done' && task.status !== 'cancelled'
  const today = new Date().toISOString().slice(0, 10)
  const hot = tasks.filter((task) => open(task) && (task.task_type === 'urgent' || (!!task.due_date && task.due_date < today))).length
  const backlog = tasks.filter((task) => open(task) && (task.pipeline === 'backlog' || task.approval_status === 'pending')).length
  const unsynced = tasks.filter((task) => task.jira_sync_status === 'error' || task.jira_sync_status === 'pending' || task.jira_sync_status === 'unmapped').length
  const inbox = tasks.filter((task) => task.needs_assignment && open(task)).length

  const cards = [
    { key: 'all', label: t('task_insight_total'), value: tasks.length, hint: t('task_insight_total_hint'), onClick: undefined as undefined | (() => void), tone: 'text-ink-800 dark:text-ink-100' },
    { key: 'hot', label: t('task_hot'), value: hot, hint: t('task_insight_hot_hint'), onClick: onHot, tone: 'text-heat-600' },
    { key: 'backlog', label: t('task_waiting_approval'), value: backlog, hint: t('task_insight_backlog_hint'), onClick: onBacklog, tone: 'text-amber-700 dark:text-amber-300' },
    ...(showInbox
      ? [{ key: 'inbox', label: t('task_inbox'), value: inbox, hint: t('task_insight_inbox_hint'), onClick: onInbox, tone: 'text-orange-700 dark:text-orange-300' }]
      : []),
    { key: 'sync', label: t('task_unsynced'), value: unsynced, hint: t('task_insight_sync_hint'), onClick: onUnsynced, tone: 'text-sky-700 dark:text-sky-300' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Comp = card.onClick ? 'button' : 'div'
        return (
          <Comp
            key={card.key}
            type={card.onClick ? 'button' : undefined}
            onClick={card.onClick}
            className={`remo-panel px-4 py-3 text-start transition ${card.onClick ? 'hover:-translate-y-0.5 hover:shadow-lift cursor-pointer' : ''}`}
          >
            <div className="text-[11px] uppercase tracking-wide text-ink-400">{card.label}</div>
            <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${card.tone}`}>{card.value}</div>
            <div className="mt-1 text-[11px] text-ink-400 leading-snug">{card.hint}</div>
          </Comp>
        )
      })}
    </div>
  )
}
