'use client'

import Link from 'next/link'
import type { JiraBoardColumn, TaskItem } from '@/types'
import { useT } from '@/hooks/useT'
import { STATUS_KEY, formatDue, formatEstimate } from './taskUi'
import { SyncBadge } from './TaskTable'

const FALLBACK_COLUMNS: JiraBoardColumn[] = [
  { name: 'todo' },
  { name: 'in_progress' },
  { name: 'done' },
]

function columnKey(value: string): string {
  return value.trim().toLowerCase()
}

function taskColumn(task: TaskItem): string {
  return task.board_column || task.status
}

export function TaskBoard({
  tasks,
  columns,
  onMove,
}: {
  tasks: TaskItem[]
  columns?: JiraBoardColumn[]
  onMove: (id: string, status: string) => void
}) {
  const t = useT()
  const visible = tasks.filter((task) => task.status !== 'cancelled')
  const baseColumns = columns?.length ? columns : FALLBACK_COLUMNS
  const seen = new Set(baseColumns.map((column) => columnKey(column.name)))
  const extraColumns = visible
    .map((task) => taskColumn(task))
    .filter((name) => {
      const key = columnKey(name)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((name) => ({ name }))
  const boardColumns = [...baseColumns, ...extraColumns]

  if (visible.length === 0) {
    return (
      <div className="remo-panel px-6 py-16 text-center text-sm text-ink-500">
        {t('task_empty')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {boardColumns.map((columnDef) => {
        const name = columnDef.name
        const column = visible.filter((task) => columnKey(taskColumn(task)) === columnKey(name))
        const labelKey = STATUS_KEY[name]
        return (
          <section
            key={name}
            className="rounded-2xl border border-ink-200/70 bg-ink-100/40 p-2.5 min-h-52 dark:border-ink-800 dark:bg-ink-900/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/task-id')
              if (id) onMove(id, name)
            }}
          >
            <div className="flex items-center justify-between px-2 py-2">
              <h3 className="text-xs font-semibold tracking-wide text-ink-500 dark:text-ink-300">
                {labelKey ? t(labelKey) : name}
              </h3>
              <span className="remo-chip bg-white/80 text-ink-500 dark:bg-ink-800 dark:text-ink-300">{column.length}</span>
            </div>
            <div className="space-y-2">
              {column.map((task) => (
                <article
                  key={task.id}
                  draggable={task.can_edit}
                  onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                  className="group rounded-xl border border-ink-200/80 bg-white/90 p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift dark:border-ink-700 dark:bg-ink-950/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/tasks/${task.id}`} className="text-[11px] font-mono text-ink-400 group-hover:text-accent-700">
                      {task.key}
                    </Link>
                    <SyncBadge task={task} />
                  </div>
                  <Link href={`/tasks/${task.id}`} className="mt-1.5 block text-sm font-medium text-ink-900 dark:text-ink-50">
                    {task.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {task.task_type === 'urgent' && (
                      <span className="remo-chip bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{t('task_type_urgent')}</span>
                    )}
                    {task.approval_status === 'pending' && (
                      <span className="remo-chip bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t('task_waiting_approval')}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-ink-500">
                    <span className="truncate">{task.assignees.map((a) => a.full_name).join('، ') || task.unmapped_assignee || '—'}</span>
                    <span className="shrink-0">{formatEstimate(task.estimate_minutes)} · {formatDue(task.due_date)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
