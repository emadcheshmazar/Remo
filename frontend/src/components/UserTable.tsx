'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import type { Role, User } from '@/types'

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-orange-100 text-orange-700',
  SUPERVISOR: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-600',
}

interface Props {
  title: string
  creatableRoles: Role[]
}

const EMPTY_CREATE = (role: Role) => ({ username: '', password: '', full_name: '', role })
const EMPTY_EDIT = (u: User) => ({ full_name: u.full_name, is_active: u.is_active, password: '' })

export function UserTable({ title, creatableRoles }: Props) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE(creatableRoles[0]))
  const [editForm, setEditForm] = useState({ full_name: '', is_active: true, password: '' })
  const [error, setError] = useState('')

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
    onError: (e: any) => setError(e.response?.data?.detail || 'Error creating user'),
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
    onError: (e: any) => setError(e.response?.data?.detail || 'Error updating user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmDeleteId(null)
    },
  })

  const startEdit = (u: User) => {
    setEditingUser(u)
    setEditForm(EMPTY_EDIT(u))
    setError('')
  }

  if (isLoading) return <div className="bg-white rounded-lg border p-6 animate-pulse h-48" />

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="font-medium text-gray-700">{title}</h2>
        <button
          onClick={() => { setShowCreate(!showCreate); setError('') }}
          className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {showCreate && (
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <input
              placeholder="Username"
              value={createForm.username}
              onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <input
              placeholder="Password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <input
              placeholder="Full Name"
              value={createForm.full_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !createForm.username || !createForm.password || !createForm.full_name}
            className="mt-3 bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {!users?.length && (
            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No users yet</td></tr>
          )}
          {users?.map((u) => (
            <>
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-800">{u.full_name}</td>
                <td className="px-6 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                </td>
                <td className="px-6 py-3">
                  <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => startEdit(u)} className="text-gray-400 hover:text-gray-700 text-xs mr-3">Edit</button>
                  {confirmDeleteId === u.id ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="text-red-500 hover:text-red-700 text-xs mr-2"
                        disabled={deleteMutation.isPending}
                      >
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 text-xs">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(u.id)} className="text-gray-400 hover:text-red-500 text-xs">Delete</button>
                  )}
                </td>
              </tr>
              {editingUser?.id === u.id && (
                <tr key={`${u.id}-edit`} className="bg-blue-50">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="grid grid-cols-3 gap-3 max-w-xl">
                      <input
                        placeholder="Full Name"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                        className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <input
                        placeholder="New password (optional)"
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                        className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                          className="rounded"
                        />
                        Active
                      </label>
                    </div>
                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingUser(null)} className="text-gray-500 text-sm px-3">Cancel</button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
