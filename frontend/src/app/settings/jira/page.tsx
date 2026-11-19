'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { jiraService, type JiraBoard, type JiraConnectionWrite } from '@/services/jira.service'
import { JiraPeopleSync } from '@/components/jira/JiraPeopleSync'
import { useToastStore } from '@/store/toast.store'
import { useT } from '@/hooks/useT'
import type { JiraUserMap } from '@/types'

const DEFAULT_JIRA_BASE_URL = 'https://jirarnd.dariarnd.ir'

const STATUS_KEYS = ['todo', 'in_progress', 'done', 'cancelled'] as const

function lines(values: string[] | undefined): string {
  return (values || []).join(', ')
}

function parseList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

export default function JiraSettingsPage() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()
  const qc = useQueryClient()

  const [baseUrl, setBaseUrl] = useState(DEFAULT_JIRA_BASE_URL)
  const [authType, setAuthType] = useState<'bearer' | 'basic'>('bearer')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [project, setProject] = useState('')
  const [issueType, setIssueType] = useState('Task')
  const [issueTypeId, setIssueTypeId] = useState('')
  const [boardId, setBoardId] = useState('')
  const [boardName, setBoardName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [statusText, setStatusText] = useState<Record<string, string>>({
    todo: 'To Do, Open, Backlog',
    in_progress: 'In Progress',
    done: 'Done, Resolved, Closed',
    cancelled: 'Cancelled, Canceled',
  })
  const [mapRows, setMapRows] = useState<Omit<JiraUserMap, 'id'>[]>([])
  const [testMessage, setTestMessage] = useState('')
  const [projectOptions, setProjectOptions] = useState<{ key: string; name: string }[]>([])
  const [boardOptions, setBoardOptions] = useState<JiraBoard[]>([])

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role !== 'ADMIN' && user.role !== 'MANAGER') router.push('/dashboard')
  }, [user, hydrated, router])

  const connection = useQuery({
    queryKey: ['jira-connection'],
    queryFn: () => jiraService.connection().then((r) => r.data),
    enabled: !!user && (user.role === 'ADMIN' || user.role === 'MANAGER'),
  })

  useEffect(() => {
    const data = connection.data
    if (!data) return
    setBaseUrl(data.base_url)
    setAuthType(data.auth_type)
    setUsername(data.username || '')
    setProject(data.default_project_key)
    setIssueType(data.default_issuetype_name || 'Task')
    setIssueTypeId(data.default_issuetype_id || '')
    setBoardId(data.board_id ? String(data.board_id) : '')
    setBoardName(data.board_name || '')
    setOwnerId(data.owner_manager_id || '')
    setStatusText({
      todo: lines(data.status_map.todo),
      in_progress: lines(data.status_map.in_progress),
      done: lines(data.status_map.done),
      cancelled: lines(data.status_map.cancelled),
    })
  }, [connection.data])

  const maps = useQuery({
    queryKey: ['jira-user-map'],
    queryFn: () => jiraService.userMap().then((r) => r.data),
    enabled: !!connection.data,
  })
  useEffect(() => {
    if (!maps.data) return
    setMapRows(maps.data.map((row) => ({
      jira_username: row.jira_username,
      jira_display_name: row.jira_display_name,
      jira_email: row.jira_email,
      remo_user_id: row.remo_user_id,
    })))
  }, [maps.data])

  const remoUsers = useQuery({
    queryKey: ['jira-remo-users'],
    queryFn: () => jiraService.remoUsers().then((r) => r.data),
    enabled: !!user && (user.role === 'ADMIN' || user.role === 'MANAGER'),
  })
  const jobs = useQuery({
    queryKey: ['jira-jobs'],
    queryFn: () => jiraService.jobs().then((r) => r.data),
    enabled: !!connection.data,
  })
  const projects = useQuery({
    queryKey: ['jira-projects'],
    queryFn: () => jiraService.projects().then((r) => r.data),
    enabled: !!connection.data,
    retry: false,
  })
  useEffect(() => {
    if (!projects.data?.length) return
    setProjectOptions(projects.data.map((item) => ({ key: item.key, name: item.name })))
  }, [projects.data])
  const issueTypes = useQuery({
    queryKey: ['jira-issuetypes', project],
    queryFn: () => jiraService.issueTypes(project).then((r) => r.data),
    enabled: !!connection.data && !!project,
    retry: false,
  })
  const boards = useQuery({
    queryKey: ['jira-boards', project],
    queryFn: () => jiraService.boards(project).then((r) => r.data),
    enabled: !!connection.data && !!project,
    retry: false,
  })
  useEffect(() => {
    if (!boards.data) return
    setBoardOptions(boards.data)
  }, [boards.data])

  const payload = (): JiraConnectionWrite => ({
    base_url: baseUrl.trim(),
    auth_type: authType,
    username: username.trim() || null,
    secret: secret.trim() || null,
    default_project_key: project.trim(),
    default_issuetype_name: issueType.trim() || 'Task',
    default_issuetype_id: issueTypeId || null,
    board_id: boardId ? Number(boardId) : null,
    board_name: boardName || null,
    owner_manager_id: ownerId || null,
    status_map: {
      todo: parseList(statusText.todo),
      in_progress: parseList(statusText.in_progress),
      done: parseList(statusText.done),
      cancelled: parseList(statusText.cancelled),
    },
  })

  const save = useMutation({
    mutationFn: () => jiraService.saveConnection(payload()),
    onSuccess: () => {
      setSecret('')
      qc.invalidateQueries({ queryKey: ['jira-connection'] })
      qc.invalidateQueries({ queryKey: ['jira-boards'] })
      useToastStore.getState().push(t('jira_saved'), 'success')
    },
  })
  const test = useMutation({
    mutationFn: () => jiraService.test(payload()),
    onSuccess: (res) => {
      const info = res.data
      const list = (info.projects || []).filter((item) => item.key)
      setProjectOptions(list.map((item) => ({ key: item.key, name: item.name || item.key })))
      if (info.boards?.length) {
        setBoardOptions(info.boards)
      }
      if (list.length && !list.some((item) => item.key === project)) {
        setProject(list[0].key)
      }
      setTestMessage(
        `${t('jira_connected')}: ${info.myself || ''} · ${info.server_title || ''} ${info.version || ''} · ${list.length} ${t('jira_projects_loaded')}`
      )
      useToastStore.getState().push(t('jira_projects_loaded'), 'success')
    },
  })
  const saveMap = useMutation({
    mutationFn: () => jiraService.saveUserMap(mapRows.filter((row) => row.jira_username.trim())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira-user-map'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      useToastStore.getState().push(t('save'), 'success')
    },
  })
  const pull = useMutation({
    mutationFn: () => jiraService.pull(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira-connection'] })
      qc.invalidateQueries({ queryKey: ['jira-jobs'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const syncBoard = useMutation({
    mutationFn: (selectedBoardId?: number | null) => jiraService.syncBoard(selectedBoardId ?? (boardId ? Number(boardId) : null)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira-connection'] })
      useToastStore.getState().push(t('jira_board_synced'), 'success')
    },
  })
  const register = useMutation({
    mutationFn: () => jiraService.registerWebhook(),
    onSuccess: () => useToastStore.getState().push(t('jira_register_webhook'), 'success'),
  })

  if (!hydrated || !user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) return null

  const typeOptions = (() => {
    const raw = issueTypes.data?.issueTypes || issueTypes.data?.values
    return Array.isArray(raw) ? raw as { id?: string; name?: string }[] : []
  })()
  const conn = connection.data

  return (
    <AppLayout>
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-wide text-accent-700 dark:text-accent-300">Integrations</p>
        <h1 className="font-display text-xl font-semibold text-ink-900 dark:text-ink-50">{t('jira_settings')}</h1>
      </div>
      <div className="grid max-w-3xl gap-4">
        <section className="remo-panel space-y-3 p-4">
          <label className="block">
            <span className="remo-label">{t('jira_base_url')}</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="remo-input mt-1" placeholder={DEFAULT_JIRA_BASE_URL} />
          </label>
          <div className="flex gap-3 text-xs text-ink-600 dark:text-ink-300">
            <label className="flex items-center gap-1.5"><input type="radio" checked={authType === 'bearer'} onChange={() => setAuthType('bearer')} className="text-accent-700 focus:ring-accent-500" />{t('jira_auth_bearer')}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={authType === 'basic'} onChange={() => setAuthType('basic')} className="text-accent-700 focus:ring-accent-500" />{t('jira_auth_basic')}</label>
          </div>
          {authType === 'basic' && (
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('username')} className="remo-input" />
          )}
          <label className="block">
            <span className="remo-label">{t('jira_token')}</span>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder="••••••••••••"
              className="remo-input mt-1 font-mono"
            />
          </label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="remo-label">{t('jira_project')}</span>
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={test.isPending || (!secret.trim() && !conn?.has_secret)}
                className="remo-btn-secondary text-[11px]"
              >
                {test.isPending ? t('loading') : t('jira_load_projects')}
              </button>
            </div>
            <select
              value={project}
              onChange={(e) => {
                setProject(e.target.value)
                setIssueTypeId('')
                setBoardId('')
                setBoardName('')
              }}
              className="remo-input"
            >
              <option value="">{t('jira_select_project')}</option>
              {projectOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.key} — {item.name}</option>
              ))}
            </select>
          </div>
          <label className="block">
            <span className="remo-label">{t('jira_issuetype')}</span>
            {typeOptions.length > 0 ? (
              <select
                value={issueTypeId || issueType}
                onChange={(e) => {
                  const found = typeOptions.find((item) => item.id === e.target.value || item.name === e.target.value)
                  if (found?.id) setIssueTypeId(found.id)
                  if (found?.name) setIssueType(found.name)
                  else setIssueType(e.target.value)
                }}
                className="remo-input mt-1"
              >
                <option value="">{t('jira_issuetype')}</option>
                {typeOptions.map((item) => (
                  <option key={item.id || item.name} value={item.id || item.name}>{item.name}</option>
                ))}
              </select>
            ) : (
              <input value={issueType} onChange={(e) => setIssueType(e.target.value)} className="remo-input mt-1" />
            )}
          </label>
          <label className="block">
            <span className="remo-label">{t('jira_board')}</span>
            <select
              value={boardId}
              onChange={(e) => {
                const selected = boardOptions.find((item) => String(item.id) === e.target.value)
                setBoardId(e.target.value)
                setBoardName(selected?.name || '')
                if (conn && selected?.id) syncBoard.mutate(selected.id)
              }}
              className="remo-input mt-1"
            >
              <option value="">{t('jira_select_board')}</option>
              {boardOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {user.role === 'ADMIN' && (
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="remo-input">
              <option value="">{t('role_manager')}</option>
              {(remoUsers.data || []).filter((person) => person.role === 'MANAGER').map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !project} className="remo-btn-primary">{t('jira_save')}</button>
            <button onClick={() => test.mutate()} disabled={test.isPending} className="remo-btn-secondary">{t('jira_test')}</button>
          </div>
          {testMessage && <p className="text-xs text-emerald-600">{testMessage}</p>}
        </section>

        <section className="remo-panel space-y-2 p-4">
          <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-ink-50">{t('jira_status_map')}</h2>
          {STATUS_KEYS.map((key) => (
            <label key={key} className="block">
              <span className="remo-label">
                {t(key === 'todo' ? 'status_todo' : key === 'in_progress' ? 'status_in_progress' : key === 'done' ? 'status_done' : 'status_cancelled')}
              </span>
              <input
                value={statusText[key] || ''}
                onChange={(e) => setStatusText((prev) => ({ ...prev, [key]: e.target.value }))}
                className="remo-input mt-1"
              />
            </label>
          ))}
        </section>

        {conn && (
          <section className="remo-panel space-y-2 p-4 text-sm">
            <h2 className="font-display font-semibold text-ink-900 dark:text-ink-50">{t('jira_callback')}</h2>
            <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-950">
              <div className="flex items-center justify-between gap-2">
                <span className="remo-label">{t('jira_board_columns')}</span>
                <button
                  onClick={() => syncBoard.mutate()}
                  disabled={!boardId || syncBoard.isPending}
                  className="remo-btn-secondary text-[11px]"
                >
                  {syncBoard.isPending ? t('loading') : t('jira_sync_board')}
                </button>
              </div>
              <p className="remo-hint mt-1">
                {(conn.board_columns || []).map((column) => column.name).join(' · ') || '—'}
              </p>
            </div>
            <code className="block break-all rounded-xl bg-ink-50 p-2 text-xs dark:bg-ink-950">{conn.webhook_url}</code>
            <p className="remo-hint">secret: {conn.webhook_secret}</p>
            <p className="remo-hint">{t('jira_last_poll')}: {conn.last_polled_at || '—'} · {t('jira_errors')}: {conn.error_count}</p>
            <div className="flex gap-2">
              <button onClick={() => register.mutate()} className="remo-btn-secondary text-xs">{t('jira_register_webhook')}</button>
              <button onClick={() => pull.mutate()} className="remo-btn-secondary text-xs">{t('jira_pull')}</button>
            </div>
          </section>
        )}

        <JiraPeopleSync projectKey={project || connection.data?.default_project_key} remoUsers={remoUsers.data || []} />

        <section className="remo-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-ink-50">{t('jira_user_map')}</h2>
            <button
              onClick={() => setMapRows((rows) => [...rows, { jira_username: '', jira_display_name: null, jira_email: null, remo_user_id: null }])}
              className="remo-btn-ghost text-xs text-accent-700"
            >
              +
            </button>
          </div>
          <div className="space-y-2">
            {mapRows.map((row, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  value={row.jira_username}
                  onChange={(e) => setMapRows((rows) => rows.map((item, i) => i === index ? { ...item, jira_username: e.target.value } : item))}
                  placeholder={t('jira_username')}
                  className="remo-input text-xs"
                />
                <input
                  value={row.jira_email || ''}
                  onChange={(e) => setMapRows((rows) => rows.map((item, i) => i === index ? { ...item, jira_email: e.target.value } : item))}
                  placeholder="email"
                  className="remo-input text-xs"
                />
                <select
                  value={row.remo_user_id || ''}
                  onChange={(e) => setMapRows((rows) => rows.map((item, i) => i === index ? { ...item, remo_user_id: e.target.value || null } : item))}
                  className="remo-input text-xs"
                >
                  <option value="">—</option>
                  {(remoUsers.data || []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={() => saveMap.mutate()} className="remo-btn-primary mt-3 text-xs">{t('save')}</button>
        </section>

        <section className="remo-panel p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-ink-900 dark:text-ink-50">{t('task_history')}</h2>
          {(jobs.data || []).length === 0 ? (
            <p className="remo-hint">{t('jira_no_jobs')}</p>
          ) : (
            <ul className="space-y-1 remo-hint">
              {(jobs.data || []).map((job) => (
                <li key={job.id} className="rounded-lg bg-ink-50 px-2 py-1.5 dark:bg-ink-950">
                  {job.job_type} · {job.status}{job.error ? ` — ${job.error}` : ''}{job.detail ? ` — ${job.detail}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
