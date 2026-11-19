'use client'

import type { TaskLabel, TaskPriority, TaskType, UserBrief } from '@/types'
import { useT } from '@/hooks/useT'
import { PRIORITIES, PRIORITY_KEY, STATUSES, STATUS_KEY } from './taskUi'
import { formatEtsPeriodRange, todayEtsPeriod } from '@/utils/jalali'

export interface TaskFilterState {
  scope: 'mine' | 'team' | 'inbox'
  status: string
  priority: TaskPriority | ''
  taskType: TaskType | ''
  due: '' | 'hot' | 'overdue' | 'today' | 'week' | 'ets'
  pipeline: '' | 'backlog' | 'approved'
  unsynced: boolean
  labelId: string
  assigneeId: string
  q: string
  view: 'table' | 'board'
  sprintId: string
}

interface Props {
  filters: TaskFilterState
  setFilters: (patch: Partial<TaskFilterState>) => void
  people: UserBrief[]
  labels: TaskLabel[]
  canInbox: boolean
  canAssigneeFilter: boolean
  canManageJira: boolean
  sprints: { id: number; name: string; state: string }[]
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onClear: () => void
  onNew: () => void
  onPull?: () => void
  pulling?: boolean
  activeFilterCount: number
}

export function TaskToolbar({
  filters,
  setFilters,
  people,
  labels,
  canInbox,
  canAssigneeFilter,
  canManageJira,
  sprints,
  showAdvanced,
  onToggleAdvanced,
  onClear,
  onNew,
  onPull,
  pulling,
  activeFilterCount,
}: Props) {
  const t = useT()
  const [etsY, etsM] = todayEtsPeriod()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent-700 dark:text-accent-300">{t('task_workspace')}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-950 dark:text-ink-50 tracking-tight">
            {t('tasks')}
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400 max-w-xl">{t('task_workspace_hint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="remo-seg">
            <button
              type="button"
              onClick={() => setFilters({ view: 'table' })}
              className={`remo-seg-item ${filters.view === 'table' ? 'remo-seg-item-active' : ''}`}
            >
              {t('task_table')}
            </button>
            <button
              type="button"
              onClick={() => setFilters({ view: 'board' })}
              className={`remo-seg-item ${filters.view === 'board' ? 'remo-seg-item-active' : ''}`}
            >
              {t('task_board')}
            </button>
          </div>
          <button type="button" onClick={onNew} className="remo-btn-primary">
            + {t('new_task')}
          </button>
        </div>
      </div>

      <div className="remo-panel p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="remo-seg">
            {([
              ['mine', t('task_mine')],
              ['team', t('task_team')],
              ...(canInbox ? [['inbox', t('task_inbox')] as const] : []),
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters({ scope: value })}
                className={`remo-seg-item ${filters.scope === value ? 'remo-seg-item-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <input
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              placeholder={t('task_search')}
              className="remo-input pe-9"
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">⌕</span>
          </div>

          <button type="button" onClick={onToggleAdvanced} className="remo-btn-secondary text-xs">
            {t('task_filters')}
            {activeFilterCount > 0 && (
              <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-accent-700 px-1 text-[10px] text-white dark:bg-accent-400 dark:text-ink-950">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button type="button" onClick={onClear} className="remo-btn-ghost text-xs">
              {t('task_clear_filters')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {([
            ['', t('all')],
            ['sprint', t('task_type_sprint')],
            ['urgent', t('task_type_urgent')],
          ] as const).map(([value, label]) => (
            <button
              key={value || 'type-all'}
              type="button"
              onClick={() => setFilters({ taskType: value })}
              className={`remo-chip border ${filters.taskType === value ? (value === 'urgent' ? 'border-heat-500 bg-heat-500/10 text-heat-600' : 'border-accent-600 bg-accent-50 text-accent-800 dark:bg-accent-900/30 dark:text-accent-200') : 'border-ink-200 text-ink-500 dark:border-ink-700'}`}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-ink-200 dark:bg-ink-700" />
          {([
            ['', t('all')],
            ['hot', t('task_hot')],
            ['overdue', t('task_overdue')],
            ['today', t('due_today_tasks')],
            ['week', t('task_this_week')],
            ['ets', t('task_this_ets')],
          ] as const).map(([value, label]) => (
            <button
              key={value || 'due-all'}
              type="button"
              onClick={() => setFilters({ due: value })}
              className={`remo-chip border ${filters.due === value ? (value === 'hot' ? 'border-heat-500 bg-heat-500/10 text-heat-600' : 'border-ink-800 bg-ink-900 text-white dark:border-ink-200 dark:bg-ink-100 dark:text-ink-900') : 'border-ink-200 text-ink-500 dark:border-ink-700'}`}
            >
              {label}
            </button>
          ))}
          {filters.due === 'ets' && (
            <span className="remo-chip text-ink-400">{formatEtsPeriodRange(etsY, etsM)}</span>
          )}
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-ink-100 dark:border-ink-800 animate-fade-up">
            <label className="space-y-1">
              <span className="text-[11px] text-ink-400">{t('task_pipeline')}</span>
              <select
                value={filters.pipeline}
                onChange={(e) => setFilters({ pipeline: e.target.value as TaskFilterState['pipeline'] })}
                className="remo-input"
              >
                <option value="">{t('all')}</option>
                <option value="backlog">{t('task_backlog')}</option>
                <option value="approved">{t('task_approved')}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-ink-400">{t('task_status')}</span>
              <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} className="remo-input">
                <option value="">{t('task_all_statuses')}</option>
                {STATUSES.map((item) => <option key={item} value={item}>{t(STATUS_KEY[item])}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-ink-400">{t('task_priority')}</span>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ priority: e.target.value as TaskPriority | '' })}
                className="remo-input"
              >
                <option value="">{t('all')}</option>
                {PRIORITIES.map((item) => <option key={item} value={item}>{t(PRIORITY_KEY[item])}</option>)}
              </select>
            </label>
            {canAssigneeFilter && (
              <label className="space-y-1">
                <span className="text-[11px] text-ink-400">{t('task_person')}</span>
                <select value={filters.assigneeId} onChange={(e) => setFilters({ assigneeId: e.target.value })} className="remo-input">
                  <option value="">{t('all')}</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </label>
            )}
            <label className="space-y-1">
              <span className="text-[11px] text-ink-400">{t('task_labels')}</span>
              <select value={filters.labelId} onChange={(e) => setFilters({ labelId: e.target.value })} className="remo-input">
                <option value="">{t('all')}</option>
                {labels.map((label) => <option key={label.id} value={label.id}>{label.title}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-ink-600 dark:text-ink-300">
              <input
                type="checkbox"
                checked={filters.unsynced}
                onChange={(e) => setFilters({ unsynced: e.target.checked })}
                className="rounded border-ink-300 text-accent-700 focus:ring-accent-500"
              />
              {t('task_unsynced')}
            </label>
            {canManageJira && (
              <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                <label className="flex-1 space-y-1 min-w-[160px]">
                  <span className="text-[11px] text-ink-400">{t('jira_active_sprints')}</span>
                  <select value={filters.sprintId} onChange={(e) => setFilters({ sprintId: e.target.value })} className="remo-input">
                    <option value="">{t('jira_active_sprints')}</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.state}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={onPull} disabled={pulling} className="remo-btn-secondary">
                  {pulling ? t('loading') : filters.sprintId ? t('jira_pull_sprint') : t('jira_pull_active_sprints')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
