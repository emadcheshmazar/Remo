'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskInsights } from '@/components/tasks/TaskInsights'
import { TaskSheet } from '@/components/tasks/TaskSheet'
import { TaskTable } from '@/components/tasks/TaskTable'
import { TaskToolbar, type TaskFilterState } from '@/components/tasks/TaskToolbar'
import { tasksService } from '@/services/tasks.service'
import { jiraService } from '@/services/jira.service'
import { useT } from '@/hooks/useT'
import { useToastStore } from '@/store/toast.store'
import type { TaskItem } from '@/types'

function TasksContent() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const params = useSearchParams()
  const t = useT()
  const qc = useQueryClient()
  const canManageJira = user?.role === 'MANAGER'
  const canInbox = user?.role === 'MANAGER' || user?.role === 'SUPERVISOR'

  const [filters, setFiltersState] = useState<TaskFilterState>({
    scope: params.get('scope') === 'mine' || params.get('scope') === 'inbox' ? (params.get('scope') as 'mine' | 'inbox') : 'team',
    status: params.get('status') || '',
    priority: '',
    taskType: (params.get('task_type') as TaskFilterState['taskType']) || '',
    due: (params.get('due') as TaskFilterState['due']) || '',
    pipeline: (params.get('pipeline') as TaskFilterState['pipeline']) || '',
    unsynced: false,
    labelId: '',
    assigneeId: '',
    q: '',
    view: params.get('view') === 'board' ? 'board' : 'table',
    sprintId: '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<TaskItem | null>(null)

  const setFilters = (patch: Partial<TaskFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role === 'ADMIN') router.push('/admin')
  }, [user, hydrated, router])

  const listParams = {
    scope: filters.scope,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    task_type: filters.taskType || undefined,
    due: (filters.due || undefined) as 'overdue' | 'week' | 'ets' | 'today' | 'hot' | undefined,
    pipeline: filters.pipeline || undefined,
    label_id: filters.labelId || undefined,
    unsynced: filters.unsynced || undefined,
    roots_only: true,
    assignee_id: filters.assigneeId || undefined,
    q: filters.q || undefined,
  }

  const tasks = useQuery({
    queryKey: ['tasks', listParams],
    queryFn: () => tasksService.list(listParams).then((r) => r.data),
    enabled: !!user && user.role !== 'ADMIN',
    refetchInterval: (query) => {
      const rows = query.state.data
      if (Array.isArray(rows) && rows.some((row) => row.jira_sync_status === 'pending')) return 3000
      return 30_000
    },
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
  const sprints = useQuery({
    queryKey: ['jira-sprints', jiraConnection.data?.board_id],
    queryFn: () => jiraService.sprints(jiraConnection.data?.board_id, 'active,closed').then((r) => r.data),
    enabled: !!jiraConnection.data?.board_id,
  })

  const move = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => tasksService.transition(id, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
  const pullSprint = useMutation({
    mutationFn: () => jiraService.pull(filters.sprintId ? Number(filters.sprintId) : null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['jira-connection'] })
      useToastStore.getState().push(t('jira_pull'), 'success')
    },
  })
  const approve = useMutation({
    mutationFn: (id: string) => tasksService.approve(id, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      useToastStore.getState().push(t('task_updated'), 'success')
    },
  })

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status) count += 1
    if (filters.priority) count += 1
    if (filters.taskType) count += 1
    if (filters.due) count += 1
    if (filters.pipeline) count += 1
    if (filters.unsynced) count += 1
    if (filters.labelId) count += 1
    if (filters.assigneeId) count += 1
    if (filters.q.trim()) count += 1
    return count
  }, [filters])

  if (!hydrated || !user || user.role === 'ADMIN') return null

  const canCreateLabel = user.role === 'MANAGER' || user.role === 'SUPERVISOR'
  const rows = tasks.data || []
  const boardColumns = jiraConnection.data?.board_columns || []

  return (
    <AppLayout>
      <div className="space-y-5">
        <TaskToolbar
          filters={filters}
          setFilters={setFilters}
          people={people.data || []}
          labels={labels.data || []}
          canInbox={!!canInbox}
          canAssigneeFilter={!!canInbox}
          canManageJira={!!canManageJira && !!jiraConnection.data?.board_id}
          sprints={sprints.data || []}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onClear={() => setFilters({
            status: '',
            priority: '',
            taskType: '',
            due: '',
            pipeline: '',
            unsynced: false,
            labelId: '',
            assigneeId: '',
            q: '',
          })}
          onNew={() => { setEditing(null); setSheetOpen(true) }}
          onPull={() => pullSprint.mutate()}
          pulling={pullSprint.isPending}
          activeFilterCount={activeFilterCount}
        />

        <TaskInsights
          tasks={rows}
          showInbox={!!canInbox}
          onHot={() => setFilters({ due: 'hot', taskType: '' })}
          onBacklog={() => setFilters({ pipeline: 'backlog' })}
          onUnsynced={() => setFilters({ unsynced: true })}
          onInbox={() => setFilters({ scope: 'inbox' })}
        />

        {tasks.isLoading ? (
          <div className="remo-panel h-52 animate-pulse bg-ink-100/60 dark:bg-ink-900/50" />
        ) : filters.view === 'board' ? (
          <TaskBoard tasks={rows} columns={boardColumns} onMove={(id, next) => move.mutate({ id, next })} />
        ) : (
          <TaskTable tasks={rows} onApprove={(id) => approve.mutate(id)} />
        )}
      </div>

      <TaskSheet
        open={sheetOpen}
        task={editing}
        assignable={people.data || []}
        labels={labels.data || []}
        canCreateLabel={canCreateLabel}
        selfId={user.id}
        canLeaveUnassigned={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
        canApprove={user.role === 'MANAGER' || user.role === 'SUPERVISOR'}
        onClose={() => setSheetOpen(false)}
      />
    </AppLayout>
  )
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksContent />
    </Suspense>
  )
}
