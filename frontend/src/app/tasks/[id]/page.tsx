'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { SyncBadge } from '@/components/tasks/TaskTable'
import { TaskSheet } from '@/components/tasks/TaskSheet'
import { tasksService } from '@/services/tasks.service'
import { jiraService } from '@/services/jira.service'
import { useT } from '@/hooks/useT'
import { PRIORITY_KEY, formatDue, formatEstimate, statusClass, statusText } from '@/components/tasks/taskUi'
import { useToastStore } from '@/store/toast.store'

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [subtaskOpen, setSubtaskOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const canManageJira = user?.role === 'MANAGER'

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role === 'ADMIN') router.push('/admin')
  }, [user, hydrated, router])

  const task = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksService.get(id).then((r) => r.data),
    enabled: !!user && user.role !== 'ADMIN' && !!id,
    refetchInterval: (query) => (query.state.data?.jira_sync_status === 'pending' ? 3000 : false),
  })

  const people = useQuery({
    queryKey: ['task-assignable'],
    queryFn: () => tasksService.assignable().then((r) => r.data),
    enabled: !!user && user.role !== 'ADMIN',
  })
  const labels = useQuery({
    queryKey: ['task-labels'],
    queryFn: () => tasksService.labels().then((r) => r.data),
    enabled: !!user && user.role !== 'ADMIN',
  })
  const jiraConnection = useQuery({
    queryKey: ['jira-connection'],
    queryFn: () => jiraService.connection().then((r) => r.data),
    enabled: !!canManageJira,
  })

  const transition = useMutation({
    mutationFn: (status: string) => tasksService.transition(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const retry = useMutation({
    mutationFn: () => tasksService.retrySync(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', id] }),
  })
  const cancel = useMutation({
    mutationFn: () => tasksService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const approve = useMutation({
    mutationFn: (value: boolean) => tasksService.approve(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      useToastStore.getState().push(t('task_updated'), 'success')
    },
  })

  if (!hydrated || !user || user.role === 'ADMIN') return null
  const data = task.data
  const baseTransitionColumns = jiraConnection.data?.board_columns?.length
    ? jiraConnection.data.board_columns.map((column) => column.name)
    : ['todo', 'in_progress', 'done']
  const transitionColumns = data?.board_column && !baseTransitionColumns.includes(data.board_column)
    ? [...baseTransitionColumns, data.board_column]
    : baseTransitionColumns

  return (
    <AppLayout>
      <Link href="/tasks" className="text-xs font-medium text-accent-700 hover:underline dark:text-accent-300">
        ← {t('task_back')}
      </Link>

      {task.isLoading || !data ? (
        <div className="mt-4 remo-panel h-48 animate-pulse" />
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="space-y-5">
            <div className="remo-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-mono text-ink-400">{data.key}</span>
                    {data.task_type === 'urgent' && <span className="remo-chip bg-rose-100 text-rose-700">{t('task_type_urgent')}</span>}
                    <span className={`remo-chip ${data.pipeline === 'backlog' ? 'bg-ink-100 text-ink-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {data.pipeline === 'backlog' ? t('task_backlog') : t('task_approved')}
                    </span>
                    {data.approval_status === 'pending' && <span className="remo-chip bg-amber-100 text-amber-800">{t('task_waiting_approval')}</span>}
                    {data.needs_assignment && <span className="remo-chip bg-orange-100 text-orange-800">{t('task_inbox')}</span>}
                    <span className={`remo-chip ${statusClass(data.status)}`}>{statusText(data.board_column || data.status, t)}</span>
                  </div>
                  {data.parent_key && (
                    <Link href={`/tasks/${data.parent_task_id}`} className="mt-2 inline-block text-[11px] text-accent-700 hover:underline dark:text-accent-300">
                      {t('task_parent')}: {data.parent_key} · {data.parent_title}
                    </Link>
                  )}
                  <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-950 dark:text-ink-50">
                    {data.title}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <SyncBadge task={data} />
                  {data.jira_url && (
                    <a href={data.jira_url} target="_blank" rel="noreferrer" className="remo-btn-secondary text-xs">
                      {t('task_open_jira')}
                    </a>
                  )}
                </div>
              </div>

              {data.jira_sync_error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {data.jira_sync_error}
                </p>
              )}

              <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  [t('task_priority'), t(PRIORITY_KEY[data.priority])],
                  [t('task_estimate'), formatEstimate(data.estimate_minutes)],
                  [t('task_due'), formatDue(data.due_date)],
                  [t('task_assignees'), data.assignees.map((a) => a.full_name).join('، ') || '—'],
                  [t('task_reporter'), data.reporter_name],
                  ...(data.repo_name ? [[t('task_repo'), data.repo_name]] : []),
                  ...(data.approved_by_name ? [[t('task_approved_by'), data.approved_by_name]] : []),
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-ink-50/80 px-3 py-2.5 dark:bg-ink-950/50">
                    <dt className="text-[11px] text-ink-400">{label}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{value}</dd>
                  </div>
                ))}
              </dl>

              {data.labels.length > 0 && (
                <div className="mt-4 flex gap-1.5 flex-wrap">
                  {data.labels.map((label) => (
                    <span key={label.id} className="remo-chip text-white" style={{ background: label.color }}>{label.title}</span>
                  ))}
                </div>
              )}

              {data.description && (
                <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap text-ink-700 dark:text-ink-200">{data.description}</p>
              )}
              {data.reproduction_steps && (
                <div className="mt-5 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <h2 className="text-[11px] uppercase tracking-wide text-ink-400">{t('task_reproduction')}</h2>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink-700 dark:text-ink-200">{data.reproduction_steps}</p>
                </div>
              )}
              {data.screenshot_url && (
                <div className="mt-3">
                  <h2 className="text-[11px] uppercase tracking-wide text-ink-400">{t('task_screenshot_url')}</h2>
                  <a href={data.screenshot_url} target="_blank" rel="noreferrer" className="text-sm text-accent-700 break-all hover:underline dark:text-accent-300">
                    {data.screenshot_url}
                  </a>
                </div>
              )}
            </div>

            <div className="remo-panel p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-display text-sm font-semibold text-ink-800 dark:text-ink-100">{t('task_attachments')}</h2>
                {data.can_edit && (
                  <label className="remo-btn-secondary text-xs cursor-pointer">
                    {uploading ? t('loading') : t('task_add_file')}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        setUploading(true)
                        try {
                          await tasksService.uploadAttachment(id, file)
                          qc.invalidateQueries({ queryKey: ['task', id] })
                        } catch (err) {
                          useToastStore.getState().push(String(err))
                        } finally {
                          setUploading(false)
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              {(data.attachments?.length || 0) === 0 ? (
                <p className="text-xs text-ink-400">—</p>
              ) : (
                <ul className="space-y-2">
                  {data.attachments.map((att) => (
                    <li key={att.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50/80 px-3 py-2 dark:bg-ink-950/40">
                      <button
                        type="button"
                        onClick={() => tasksService.downloadAttachment(att.id, att.filename)}
                        className="text-sm text-accent-700 hover:underline truncate text-start dark:text-accent-300"
                      >
                        {att.kind}: {att.filename}
                      </button>
                      {data.can_edit && (
                        <button
                          className="text-xs text-heat-600"
                          onClick={async () => {
                            await tasksService.deleteAttachment(att.id)
                            qc.invalidateQueries({ queryKey: ['task', id] })
                          }}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(data.children?.length || 0) > 0 && (
              <div className="remo-panel p-5">
                <h2 className="font-display text-sm font-semibold text-ink-800 dark:text-ink-100 mb-3">{t('task_subtasks')}</h2>
                <ul className="space-y-2">
                  {data.children.map((child) => (
                    <li key={child.id}>
                      <Link href={`/tasks/${child.id}`} className="block rounded-xl bg-ink-50/80 px-3 py-2 text-sm hover:bg-accent-50 dark:bg-ink-950/40 dark:hover:bg-ink-800">
                        <span className="font-mono text-[11px] text-ink-400">{child.key}</span>
                        <span className="ms-2 text-ink-800 dark:text-ink-100">{child.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="remo-panel p-5">
              <h2 className="font-display text-sm font-semibold text-ink-800 dark:text-ink-100">{t('task_history')}</h2>
              <ul className="mt-3 space-y-2">
                {data.events.map((event) => (
                  <li key={event.id} className="flex gap-3 text-xs text-ink-500">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                    <span>
                      <span className="font-medium text-ink-700 dark:text-ink-200">{event.action}</span>
                      {event.detail ? ` — ${event.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-20 self-start">
            <div className="remo-panel p-4 space-y-3">
              <h2 className="text-[11px] uppercase tracking-wide text-ink-400">{t('task_status')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.can_edit && transitionColumns.map((status) => (
                  <button
                    key={status}
                    disabled={(data.board_column || data.status) === status || transition.isPending}
                    onClick={() => transition.mutate(status)}
                    className="remo-btn-secondary !px-2.5 !py-1.5 text-xs disabled:opacity-40"
                  >
                    {statusText(status, t)}
                  </button>
                ))}
              </div>
            </div>

            <div className="remo-panel p-4 space-y-2">
              {data.can_approve && data.approval_status !== 'approved' && (
                <button
                  onClick={() => approve.mutate(true)}
                  disabled={approve.isPending || data.needs_assignment}
                  className="remo-btn-primary w-full"
                >
                  {t('task_approve')}
                </button>
              )}
              {data.can_approve && data.approval_status === 'approved' && (
                <button onClick={() => approve.mutate(false)} disabled={approve.isPending} className="remo-btn-secondary w-full">
                  {t('task_revoke_approval')}
                </button>
              )}
              {data.can_edit && !data.parent_task_id && (
                <button onClick={() => setSubtaskOpen(true)} className="remo-btn-secondary w-full">
                  {t('task_add_subtask')}
                </button>
              )}
              {data.can_edit && (
                <button onClick={() => setEditing(true)} className="remo-btn-secondary w-full">
                  {t('task_edit')}
                </button>
              )}
              {data.can_retry_sync && data.jira_sync_status !== 'synced' && (
                <button onClick={() => retry.mutate()} className="remo-btn-secondary w-full text-amber-700">
                  {t('task_retry_sync')}
                </button>
              )}
              {data.can_cancel && data.status !== 'cancelled' && (
                <button onClick={() => cancel.mutate()} className="remo-btn-ghost w-full text-heat-600">
                  {t('task_cancel_task')}
                </button>
              )}
            </div>
          </aside>

          <TaskSheet
            open={editing}
            task={data}
            assignable={people.data || []}
            labels={labels.data || []}
            canCreateLabel={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            selfId={user.id}
            canLeaveUnassigned={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            canApprove={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['task', id] }) }}
          />
          <TaskSheet
            open={subtaskOpen}
            parentTask={{ id: data.id, key: data.key, title: data.title }}
            assignable={people.data || []}
            labels={labels.data || []}
            canCreateLabel={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            selfId={user.id}
            canLeaveUnassigned={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            canApprove={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
            onClose={() => { setSubtaskOpen(false); qc.invalidateQueries({ queryKey: ['task', id] }); qc.invalidateQueries({ queryKey: ['tasks'] }) }}
          />
        </div>
      )}
    </AppLayout>
  )
}
