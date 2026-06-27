'use client'

import { useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import { useAuthStore } from '@/store/auth.store'
import { useT } from '@/hooks/useT'
import type { Role, User } from '@/types'

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  MANAGER: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  SUPERVISOR: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  MEMBER: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
}

interface Props {
  title: string
  creatableRoles: Role[]
}

const EMPTY_CREATE = (role: Role) => ({ username: '', password: '', full_name: '', role })
const EMPTY_EDIT = (u: User) => ({ full_name: u.full_name, is_active: u.is_active, password: '' })

export function UserTable({ title, creatableRoles }: Props) {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const t = useT()
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE(creatableRoles[0]))
  const [editForm, setEditForm] = useState({ full_name: '', is_active: true, password: '' })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: () => userService.create(createForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE(creatableRoles[0]))
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.detail || t('error')),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      userService.update(editingUser!.id, {
        full_name: editForm.full_name || undefined,
        is_active: editForm.is_active,
        password: editForm.password || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.detail || t('error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmDeleteId(null)
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ memberId, supervisorId }: { memberId: string; supervisorId: string | null }) =>
      userService.assignSupervisor(memberId, supervisorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const supervisors = (users ?? []).filter((u) => u.role === 'SUPERVISOR')
  const filteredUsers = (users ?? []).filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  )

  const startEdit = (u: User) => {
    setEditingUser(u)
    setEditForm(EMPTY_EDIT(u))
    setError('')
  }

  const inputCls = 'border border-gray-200 dark:border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-slate-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200'
  const editInputCls = 'border border-gray-200 dark:border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200'

  if (isLoading) return <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 animate-pulse h-48" />

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-4">
        <h2 className="font-medium text-gray-700 dark:text-slate-300 shrink-0">{title}</h2>
        <input
          placeholder={t('search') + '...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`flex-1 max-w-xs ${inputCls}`}
          dir="rtl"
        />
        <button
          onClick={() => { setShowCreate(!showCreate); setError('') }}
          className="bg-gray-900 dark:bg-indigo-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-700 dark:hover:bg-indigo-600 transition-colors shrink-0"
        >
          {showCreate ? t('cancel') : `+ ${t('create_user')}`}
        </button>
      </div>

      {showCreate && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <input
              placeholder={t('username')}
              value={createForm.username}
              onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
              autoComplete="new-password"
              name="new-username"
              className={inputCls}
            />
            <input
              placeholder={t('password')}
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              name="new-password"
              className={inputCls}
            />
            <input
              placeholder={t('full_name')}
              value={createForm.full_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
              className={inputCls}
            />
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
              className={`${inputCls} cursor-pointer`}
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-xs mt-2">{error}</p>}
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !createForm.username || !createForm.password || !createForm.full_name}
            className="mt-3 bg-green-600 dark:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? t('loading') : t('create_user')}
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('full_name')}</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('username')}</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('role')}</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('active')}</th>
            {me?.role === 'MANAGER' && (
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('assign_supervisor')}</th>
            )}
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
          {!filteredUsers.length && (
            <tr>
              <td colSpan={me?.role === 'MANAGER' ? 6 : 5} className="px-6 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">
                {search ? t('no_users') : t('no_users')}
              </td>
            </tr>
          )}
          {filteredUsers.map((u) => (
            <Fragment key={u.id}>
              <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                <td className="px-6 py-3 font-medium text-gray-800 dark:text-slate-200">{u.full_name}</td>
                <td className="px-6 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">{u.username}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                </td>
                <td className="px-6 py-3">
                  <span className={`text-xs ${u.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {u.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {me?.role === 'MANAGER' && (
                  <td className="px-6 py-3">
                    {u.role === 'MEMBER' ? (
                      <select
                        value={u.supervisor_id ?? ''}
                        onChange={(e) => assignMutation.mutate({ memberId: u.id, supervisorId: e.target.value || null })}
                        className="border border-gray-200 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-slate-500"
                      >
                        <option value="">{t('no_supervisor')}</option>
                        {supervisors.map((s) => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="px-6 py-3 text-right">
                  <button onClick={() => startEdit(u)} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 text-xs mr-3">{t('edit')}</button>
                  {confirmDeleteId === u.id ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs mr-2"
                        disabled={deleteMutation.isPending}
                      >
                        {t('confirm')}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 dark:text-slate-500 text-xs">{t('cancel')}</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(u.id)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-xs">{t('delete')}</button>
                  )}
                </td>
              </tr>
              {editingUser?.id === u.id && (
                <tr className="bg-blue-50 dark:bg-blue-950/30">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="grid grid-cols-3 gap-3 max-w-xl">
                      <input
                        placeholder={t('full_name')}
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                        className={editInputCls}
                      />
                      <input
                        placeholder={`${t('password')} (optional)`}
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                        className={editInputCls}
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                          className="rounded"
                        />
                        {t('active')}
                      </label>
                    </div>
                    {error && <p className="text-red-500 dark:text-red-400 text-xs mt-2">{error}</p>}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {updateMutation.isPending ? t('saving') : t('save')}
                      </button>
                      <button onClick={() => setEditingUser(null)} className="text-gray-500 dark:text-slate-400 text-sm px-3">{t('cancel')}</button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
