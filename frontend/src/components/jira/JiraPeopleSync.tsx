'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jiraService, type JiraPersonPreview } from '@/services/jira.service'
import { useToastStore } from '@/store/toast.store'
import { useT } from '@/hooks/useT'
import type { UserBrief } from '@/types'

interface Props {
  projectKey?: string
  remoUsers: UserBrief[]
}

type RowState = JiraPersonPreview & {
  selected: boolean
  role: 'MEMBER' | 'SUPERVISOR'
  supervisor_id: string
  remo_user_id: string
}

const STATUS_STYLE: Record<JiraPersonPreview['status'], string> = {
  unmatched: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  conflict: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800',
  mapped: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
}

export function JiraPeopleSync({ projectKey, remoUsers }: Props) {
  const t = useT()
  const qc = useQueryClient()
  const [rows, setRows] = useState<RowState[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'conflict' | 'mapped'>('all')
  const [defaultRole, setDefaultRole] = useState<'MEMBER' | 'SUPERVISOR'>('MEMBER')
  const [defaultSupervisor, setDefaultSupervisor] = useState('')
  const [passwords, setPasswords] = useState<{ username: string; password: string }[]>([])

  const supervisors = useMemo(
    () => remoUsers.filter((user) => user.role === 'SUPERVISOR'),
    [remoUsers],
  )

  const preview = useMutation({
    mutationFn: () => jiraService.previewPeople(projectKey).then((r) => r.data),
    onSuccess: (data) => {
      setRows(
        data.map((person) => ({
          ...person,
          selected: person.status !== 'mapped',
          role: 'MEMBER',
          supervisor_id: defaultSupervisor,
          remo_user_id: person.remo_user_id || '',
        })),
      )
      setLoaded(true)
      useToastStore.getState().push(t('jira_people_loaded'), 'success')
    },
    onError: (err) => useToastStore.getState().push(String(err)),
  })

  const importPeople = useMutation({
    mutationFn: () => {
      const selected = rows.filter((row) => row.selected)
      return jiraService.importPeople({
        default_role: defaultRole,
        default_supervisor_id: defaultSupervisor || null,
        people: selected.map((row) => ({
          jira_username: row.jira_username,
          jira_display_name: row.jira_display_name,
          jira_email: row.jira_email,
          role: row.role,
          supervisor_id: row.role === 'MEMBER' ? (row.supervisor_id || defaultSupervisor || null) : null,
          remo_user_id: row.remo_user_id || null,
        })),
      }).then((r) => r.data)
    },
    onSuccess: (result) => {
      const temps = result.imported
        .filter((item) => item.temporary_password && item.remo_username)
        .map((item) => ({ username: item.remo_username!, password: item.temporary_password! }))
      setPasswords(temps)
      qc.invalidateQueries({ queryKey: ['jira-user-map'] })
      qc.invalidateQueries({ queryKey: ['jira-remo-users'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      useToastStore.getState().push(
        `${t('jira_people_imported')}: ${result.created_count} ${t('jira_people_created')} · ${result.linked_count} ${t('jira_people_linked')}`,
        'success',
      )
      preview.mutate()
    },
    onError: (err) => useToastStore.getState().push(String(err)),
  })

  const visible = rows.filter((row) => filter === 'all' || row.status === filter)
  const selectedCount = rows.filter((row) => row.selected).length
  const unmatchedCount = rows.filter((row) => row.status === 'unmatched').length

  return (
    <section className="remo-panel overflow-hidden">
      <div className="border-b border-ink-100 px-5 py-4 dark:border-ink-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-accent-700 dark:text-accent-300">Jira</p>
            <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-ink-50">{t('jira_people_sync')}</h2>
            <p className="remo-hint mt-1 max-w-xl leading-relaxed">
              {t('jira_people_sync_hint')}
            </p>
          </div>
          <button
            type="button"
            disabled={!projectKey || preview.isPending}
            onClick={() => preview.mutate()}
            className="remo-btn-primary text-xs"
          >
            {preview.isPending ? t('loading') : t('jira_people_fetch')}
          </button>
        </div>
      </div>

      {!projectKey ? (
        <p className="px-5 py-8 text-center text-sm text-ink-400">{t('jira_people_need_project')}</p>
      ) : !loaded ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-ink-500 dark:text-ink-400">{t('jira_people_empty')}</p>
          <p className="remo-hint mt-1">{t('jira_people_empty_hint')}</p>
        </div>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', t('all')],
              ['unmatched', `${t('jira_people_new')} (${unmatchedCount})`],
              ['conflict', t('jira_people_conflict')],
              ['mapped', t('jira_people_mapped')],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`remo-toggle ${filter === value ? 'remo-toggle-on' : ''}`}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <label className="remo-hint flex items-center gap-1.5">
              {t('jira_people_default_role')}
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as 'MEMBER' | 'SUPERVISOR')}
                className="remo-input !w-auto !py-1 text-xs"
              >
                <option value="MEMBER">{t('role_member')}</option>
                <option value="SUPERVISOR">{t('role_supervisor')}</option>
              </select>
            </label>
            {supervisors.length > 0 && (
              <label className="remo-hint flex items-center gap-1.5">
                {t('jira_people_default_supervisor')}
                <select
                  value={defaultSupervisor}
                  onChange={(e) => {
                    setDefaultSupervisor(e.target.value)
                    setRows((prev) => prev.map((row) => ({ ...row, supervisor_id: row.supervisor_id || e.target.value })))
                  }}
                  className="remo-input !w-auto !py-1 text-xs"
                >
                  <option value="">—</option>
                  {supervisors.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/80 text-[11px] text-ink-400 dark:bg-ink-950/50 dark:text-ink-500">
                <tr>
                  <th className="w-8 px-3 py-2 text-start">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((row) => row.selected)}
                      onChange={(e) => {
                        const on = e.target.checked
                        setRows((prev) => prev.map((row) => (
                          visible.some((v) => v.jira_username === row.jira_username)
                            ? { ...row, selected: on }
                            : row
                        )))
                      }}
                      className="rounded border-ink-300 text-accent-700 focus:ring-accent-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-start font-medium">{t('jira_username')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('jira_people_status')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('team')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('role')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('supervisor')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.jira_username} className="border-t border-ink-50 dark:border-ink-800/70">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => setRows((prev) => prev.map((item) => (
                          item.jira_username === row.jira_username ? { ...item, selected: e.target.checked } : item
                        )))}
                        className="rounded border-ink-300 text-accent-700 focus:ring-accent-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink-800 dark:text-ink-100">{row.jira_display_name || row.jira_username}</div>
                      <div className="font-mono text-[11px] text-ink-400">{row.jira_username}</div>
                      {row.jira_email && <div className="text-[11px] text-ink-400">{row.jira_email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`remo-chip border ${STATUS_STYLE[row.status]}`}>
                        {row.status === 'unmatched' ? t('jira_people_new') : row.status === 'conflict' ? t('jira_people_conflict') : t('jira_people_mapped')}
                      </span>
                      {row.status === 'unmatched' && row.suggested_username && (
                        <div className="remo-hint mt-1">{t('jira_people_will_create')}: {row.suggested_username}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {(row.status === 'conflict' || row.status === 'mapped') ? (
                        <select
                          value={row.remo_user_id}
                          onChange={(e) => setRows((prev) => prev.map((item) => (
                            item.jira_username === row.jira_username ? { ...item, remo_user_id: e.target.value } : item
                          )))}
                          className="remo-input !py-1 text-xs"
                        >
                          <option value="">—</option>
                          {remoUsers.map((user) => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.role}
                        onChange={(e) => setRows((prev) => prev.map((item) => (
                          item.jira_username === row.jira_username ? { ...item, role: e.target.value as 'MEMBER' | 'SUPERVISOR' } : item
                        )))}
                        className="remo-input !w-auto !py-1 text-xs"
                      >
                        <option value="MEMBER">{t('role_member')}</option>
                        <option value="SUPERVISOR">{t('role_supervisor')}</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {row.role === 'MEMBER' ? (
                        <select
                          value={row.supervisor_id}
                          onChange={(e) => setRows((prev) => prev.map((item) => (
                            item.jira_username === row.jira_username ? { ...item, supervisor_id: e.target.value } : item
                          )))}
                          className="remo-input !w-auto !py-1 text-xs"
                        >
                          <option value="">—</option>
                          {supervisors.map((user) => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="remo-hint">
              {selectedCount} {t('jira_people_selected')}
            </p>
            <button
              type="button"
              disabled={selectedCount < 1 || importPeople.isPending}
              onClick={() => importPeople.mutate()}
              className="remo-btn-primary"
            >
              {importPeople.isPending ? t('saving') : t('jira_people_import')}
            </button>
          </div>
        </div>
      )}

      {passwords.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-[2px]" onClick={() => setPasswords([])}>
          <div
            className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-5 shadow-lift dark:border-ink-700 dark:bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-semibold text-ink-900 dark:text-ink-50">{t('jira_people_temp_passwords')}</h3>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('jira_people_temp_hint')}</p>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {passwords.map((item) => (
                <li key={item.username} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 font-mono text-xs dark:bg-ink-950">
                  <span>{item.username}</span>
                  <span className="text-accent-700 dark:text-accent-300">{item.password}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPasswords([])}
              className="remo-btn-primary mt-4 w-full"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
