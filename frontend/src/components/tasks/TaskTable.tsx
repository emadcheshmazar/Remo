'use client'

import Link from 'next/link'
import type { TaskItem } from '@/types'
import { useT } from '@/hooks/useT'
import {
  PRIORITY_CLASS,
  PRIORITY_KEY,
  SYNC_CLASS,
  SYNC_KEY,
  formatDue,
  formatEstimate,
  statusClass,
  statusText,
} from './taskUi'

export function SyncBadge({ task }: { task: Pick<TaskItem, 'jira_sync_status' | 'jira_sync_error' | 'jira_issue_key'> }) {
  const t = useT()
  return (
    <span
      title={task.jira_sync_error || task.jira_issue_key || ''}
      className={`remo-chip ${SYNC_CLASS[task.jira_sync_status]}`}
    >
      {t(SYNC_KEY[task.jira_sync_status])}
    </span>
  )
}

function MetaChip({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`remo-chip ${className}`}>{children}</span>
}

export function TaskTable({
  tasks,
  onApprove,
}: {
  tasks: TaskItem[]
  onApprove?: (id: string) => void
}) {
  const t = useT()
  if (tasks.length === 0) {
    return (
      <div className="remo-panel px-6 py-16 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent-50 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200">
          ✓
        </div>
        <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-50">{t('task_empty')}</h3>
        <p className="mt-1 text-sm text-ink-500">{t('task_empty_hint')}</p>
      </div>
    )
  }

  return (
    <div className="remo-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
              <th className="text-start px-4 py-3 font-medium">{t('task_key')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_title')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_assignees')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_priority')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_due')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_status')}</th>
              <th className="text-start px-4 py-3 font-medium">{t('task_sync')}</th>
              <th className="text-start px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="border-t border-ink-50/90 transition hover:bg-accent-50/40 dark:border-ink-800/80 dark:hover:bg-ink-800/40"
              >
                <td className="px-4 py-3 align-top">
                  <Link href={`/tasks/${task.id}`} className="font-mono text-[11px] text-ink-400 hover:text-accent-700">
                    {task.key}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {task.task_type === 'urgent' && (
                      <MetaChip className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{t('task_type_urgent')}</MetaChip>
                    )}
                    {task.pipeline === 'backlog' && (
                      <MetaChip className="bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">{t('task_backlog')}</MetaChip>
                    )}
                    {task.approval_status === 'pending' && (
                      <MetaChip className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t('task_waiting_approval')}</MetaChip>
                    )}
                    {task.needs_assignment && (
                      <MetaChip className="bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">{t('task_inbox')}</MetaChip>
                    )}
                  </div>
                  <Link href={`/tasks/${task.id}`} className="font-medium text-ink-900 hover:text-accent-700 dark:text-ink-50 dark:hover:text-accent-300">
                    {task.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
                    <span>{formatEstimate(task.estimate_minutes)}</span>
                    {task.repo_name && <span className="font-mono">· {task.repo_name}</span>}
                    {(task.children?.length || 0) > 0 && <span>· {task.children.length} {t('task_subtasks')}</span>}
                  </div>
                  {(task.labels?.length || 0) > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {task.labels.map((label) => (
                        <span key={label.id} className="remo-chip text-white" style={{ background: label.color }}>
                          {label.title}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-ink-600 dark:text-ink-300">
                  {task.assignees.map((a) => a.full_name).join('، ') || (task.needs_assignment ? t('task_leave_unassigned') : '—')}
                  {task.unmapped_assignee && (
                    <div className="text-[11px] text-sky-700 dark:text-sky-300">{task.unmapped_assignee}</div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`remo-chip ${PRIORITY_CLASS[task.priority]}`}>{t(PRIORITY_KEY[task.priority])}</span>
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap text-ink-600 dark:text-ink-300">
                  {formatDue(task.due_date)}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`remo-chip ${statusClass(task.status)}`}>
                    {statusText(task.board_column || task.status, t)}
                  </span>
                </td>
                <td className="px-4 py-3 align-top"><SyncBadge task={task} /></td>
                <td className="px-4 py-3 align-top">
                  {onApprove && task.can_approve && task.approval_status !== 'approved' && !task.needs_assignment && (
                    <button
                      type="button"
                      onClick={() => onApprove(task.id)}
                      className="remo-btn-secondary !px-2 !py-1 text-[11px]"
                    >
                      {t('task_approve')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
