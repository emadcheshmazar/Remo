'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksService, type TaskWriteBody } from '@/services/tasks.service'
import { useToastStore } from '@/store/toast.store'
import { useT } from '@/hooks/useT'
import { jalaliMonthDays, jalaliToIso, todayJalali, isoToJalali, JALALI_MONTHS } from '@/utils/jalali'
import type { TaskItem, TaskLabel, TaskPriority, TaskRecurrence, TaskType, UserBrief } from '@/types'
import { LABEL_COLORS, PRIORITIES, PRIORITY_KEY } from './taskUi'

interface Props {
  open: boolean
  task?: TaskItem | null
  parentTask?: Pick<TaskItem, 'id' | 'key' | 'title'> | null
  assignable: UserBrief[]
  labels: TaskLabel[]
  canCreateLabel: boolean
  selfId: string
  canLeaveUnassigned?: boolean
  canApprove?: boolean
  onClose: () => void
}

function splitEstimate(minutes: number | null | undefined): [string, string] {
  if (!minutes) return ['', '']
  return [String(Math.floor(minutes / 60)), String(minutes % 60)]
}

const RECURRENCES: TaskRecurrence[] = ['none', 'daily', 'weekly', 'monthly']

export function TaskSheet({
  open,
  task,
  parentTask = null,
  assignable,
  labels,
  canCreateLabel,
  selfId,
  canLeaveUnassigned = false,
  canApprove = false,
  onClose,
}: Props) {
  const t = useT()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [title, setTitle] = useState('')
  const [hours, setHours] = useState('')
  const [mins, setMins] = useState('')
  const [dueJy, setDueJy] = useState(todayJalali()[0])
  const [dueJm, setDueJm] = useState(todayJalali()[1])
  const [dueJd, setDueJd] = useState(todayJalali()[2])
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [taskType, setTaskType] = useState<TaskType>('sprint')
  const [description, setDescription] = useState('')
  const [reproduction, setReproduction] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [repoName, setRepoName] = useState('')
  const [autoApprove, setAutoApprove] = useState(false)
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none')
  const [untilJy, setUntilJy] = useState(todayJalali()[0])
  const [untilJm, setUntilJm] = useState(todayJalali()[1])
  const [untilJd, setUntilJd] = useState(todayJalali()[2])
  const [hasUntil, setHasUntil] = useState(false)
  const [more, setMore] = useState(false)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  const isUrgent = taskType === 'urgent'

  useEffect(() => {
    if (!open) return
    const [jy, jm, jd] = task?.due_date ? isoToJalali(task.due_date) : todayJalali()
    const [h, m] = splitEstimate(task?.estimate_minutes)
    const until = task?.recurrence_until ? isoToJalali(task.recurrence_until) : todayJalali()
    setTitle(task?.title || '')
    setHours(h)
    setMins(m)
    setDueJy(jy)
    setDueJm(jm)
    setDueJd(jd)
    setPriority(task?.priority || (task?.task_type === 'urgent' ? 'high' : 'medium'))
    setTaskType(task?.task_type || 'sprint')
    setDescription(task?.description || '')
    setReproduction(task?.reproduction_steps || '')
    setScreenshotUrl(task?.screenshot_url || '')
    setRepoName(task?.repo_name || '')
    setAutoApprove(false)
    setRecurrence(task?.recurrence || 'none')
    setHasUntil(Boolean(task?.recurrence_until))
    setUntilJy(until[0])
    setUntilJm(until[1])
    setUntilJd(until[2])
    setMore(Boolean(
      task?.description
      || task?.labels?.length
      || task?.attachments?.length
      || task?.reproduction_steps
      || task?.screenshot_url
      || task?.repo_name
      || (task?.recurrence && task.recurrence !== 'none'),
    ))
    setAssigneeIds(task ? task.assignees.map((a) => a.id) : (canLeaveUnassigned ? [] : [selfId]))
    setLabelIds(task ? task.labels.map((l) => l.id) : [])
    setNewLabel('')
    setPendingFiles([])
    setRecording(false)
    setError('')
  }, [open, task, selfId, canLeaveUnassigned])

  useEffect(() => {
    if (!open || task) return
    if (taskType === 'urgent' && priority === 'medium') setPriority('high')
    if (taskType === 'sprint' && priority === 'high' && !hours && !mins) setPriority('medium')
  }, [taskType, open, task, priority, hours, mins])

  const days = useMemo(() => jalaliMonthDays(dueJy, dueJm), [dueJy, dueJm])
  const safeDay = Math.min(dueJd, days)
  const untilDays = useMemo(() => jalaliMonthDays(untilJy, untilJm), [untilJy, untilJm])
  const safeUntilDay = Math.min(untilJd, untilDays)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['tasks-due-today'] })
    qc.invalidateQueries({ queryKey: ['task-labels'] })
    if (task?.id) qc.invalidateQueries({ queryKey: ['task', task.id] })
  }

  const uploadPending = async (taskIds: string[]) => {
    if (!pendingFiles.length) return
    for (const id of taskIds) {
      for (const file of pendingFiles) {
        await tasksService.uploadAttachment(id, file)
      }
    }
  }

  const save = useMutation({
    mutationFn: async (body: TaskWriteBody) => {
      if (task) {
        const updated = await tasksService.update(task.id, {
          ...body,
          assignee_ids: body.assignee_ids?.slice(0, 1),
        })
        await uploadPending([task.id])
        return { tasks: [updated.data] }
      }
      const created = await tasksService.create(body)
      await uploadPending(created.data.tasks.map((row) => row.id))
      return created.data
    },
    onSuccess: (result) => {
      invalidate()
      const toast = useToastStore.getState()
      const first = result.tasks[0]
      const count = result.tasks.length
      if (count > 1) {
        toast.push(`${t('task_created')} ×${count}`, 'success')
      } else if (first?.jira_issue_key && first.jira_sync_status === 'synced') {
        toast.push(`${t('task_synced_toast')} ${first.jira_issue_key}`, 'success')
      } else if (first?.jira_sync_status === 'pending') {
        toast.push(t('task_pending_toast'), 'info')
      } else if (first?.needs_assignment) {
        toast.push(t('task_inbox_saved'), 'info')
      } else {
        toast.push(task ? t('task_updated') : t('task_created'), 'success')
      }
      onClose()
    },
  })

  const addLabel = useMutation({
    mutationFn: () => tasksService.createLabel(newLabel.trim(), LABEL_COLORS[labels.length % LABEL_COLORS.length]),
    onSuccess: (res) => {
      setLabelIds((prev) => [...prev, res.data.id])
      setNewLabel('')
      qc.invalidateQueries({ queryKey: ['task-labels'] })
    },
  })

  if (!open) return null

  const submit = () => {
    const estimate = (Number(hours) || 0) * 60 + (Number(mins) || 0)
    if (!title.trim()) { setError(t('task_title')); return }
    if (!isUrgent && estimate < 1) { setError(t('task_estimate')); return }
    if (!canLeaveUnassigned && assigneeIds.length < 1) { setError(t('task_assignees')); return }
    if (task && assigneeIds.length > 1) { setError(t('task_one_assignee')); return }
    setError('')
    save.mutate({
      title: title.trim(),
      estimate_minutes: estimate > 0 ? estimate : null,
      due_date: jalaliToIso(dueJy, dueJm, safeDay),
      description: description.trim() || null,
      priority,
      task_type: taskType,
      reproduction_steps: reproduction.trim() || null,
      screenshot_url: screenshotUrl.trim() || null,
      repo_name: repoName.trim() || null,
      parent_task_id: parentTask?.id || task?.parent_task_id || null,
      auto_approve: canApprove ? autoApprove : undefined,
      recurrence,
      recurrence_until: recurrence !== 'none' && hasUntil
        ? jalaliToIso(untilJy, untilJm, safeUntilDay)
        : null,
      assignee_ids: assigneeIds,
      label_ids: labelIds,
    })
  }

  const toggleAssignee = (id: string) => {
    if (task) {
      setAssigneeIds((prev) => (prev.includes(id) ? [] : [id]))
      return
    }
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })
        setPendingFiles((prev) => [...prev, file])
        setRecording(false)
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(t('task_mic_denied'))
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    mediaRef.current = null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white shadow-lift max-h-[90vh] overflow-y-auto dark:border-ink-700 dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-accent-700 dark:text-accent-300">{t('task_workspace')}</p>
            <h2 className="font-display font-semibold text-ink-900 dark:text-ink-50">{task ? t('task_edit') : t('new_task')}</h2>
          </div>
          <button onClick={onClose} className="remo-btn-ghost h-8 w-8 !p-0 text-lg">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="remo-seg">
            {(['sprint', 'urgent'] as TaskType[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTaskType(value)}
                className={`remo-seg-item ${taskType === value ? (value === 'urgent' ? 'bg-heat-500 text-white shadow-sm' : 'remo-seg-item-active') : ''}`}
              >
                {value === 'urgent' ? t('task_type_urgent') : t('task_type_sprint')}
              </button>
            ))}
          </div>
          {isUrgent && (
            <p className="text-[11px] text-heat-600">{t('task_urgent_hint')}</p>
          )}
          {parentTask && (
            <p className="text-[11px] text-accent-700 dark:text-accent-300">
              {t('task_parent')}: {parentTask.key} · {parentTask.title}
            </p>
          )}

          <label className="block">
            <span className="remo-label">{t('task_title')} *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="remo-input mt-1"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="remo-label">
                {t('task_estimate')}{isUrgent ? ` (${t('task_optional')})` : ' *'}
              </span>
              <div className="mt-1 flex gap-2">
                <input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder={t('task_hours')} className="remo-input" />
                <input type="number" min={0} max={59} value={mins} onChange={(e) => setMins(e.target.value)} placeholder={t('task_mins')} className="remo-input" />
              </div>
            </label>
            <label className="block">
              <span className="remo-label">{t('task_due')} *</span>
              <div className="mt-1 flex gap-1">
                <select value={safeDay} onChange={(e) => setDueJd(Number(e.target.value))} className="remo-input !px-1.5 text-xs">
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={dueJm} onChange={(e) => setDueJm(Number(e.target.value))} className="remo-input !px-1.5 text-xs">
                  {JALALI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
                <select value={dueJy} onChange={(e) => setDueJy(Number(e.target.value))} className="remo-input !px-1.5 text-xs">
                  {[dueJy - 1, dueJy, dueJy + 1, dueJy + 2].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </label>
          </div>

          <div>
            <span className="remo-label">
              {t('task_assignees')}{canLeaveUnassigned ? '' : ' *'}
            </span>
            <p className="remo-hint mt-0.5">
              {task ? t('task_one_assignee') : t('task_multi_creates')}
            </p>
            {canLeaveUnassigned && (
              <button
                type="button"
                onClick={() => setAssigneeIds([])}
                className={`mt-2 remo-toggle ${assigneeIds.length === 0 ? 'remo-toggle-warn' : ''}`}
              >
                {t('task_leave_unassigned')}
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {assignable.map((user) => {
                const on = assigneeIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleAssignee(user.id)}
                    className={`remo-toggle ${on ? 'remo-toggle-on' : ''}`}
                  >
                    {user.full_name}
                  </button>
                )
              })}
            </div>
          </div>

          {!isUrgent && (
            <div>
              <span className="remo-label">{t('task_priority')}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRIORITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPriority(item)}
                    className={`remo-toggle ${priority === item ? 'remo-toggle-on' : ''}`}
                  >
                    {t(PRIORITY_KEY[item])}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={() => setMore((v) => !v)} className="remo-btn-ghost !px-0 text-xs text-accent-700 dark:text-accent-300">
            {t('task_more')} {more ? '▴' : '▾'}
          </button>
          {more && (
            <div className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
              {isUrgent && (
                <div>
                  <span className="remo-label">{t('task_priority')}</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRIORITIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPriority(item)}
                        className={`remo-toggle ${priority === item ? 'remo-toggle-on' : ''}`}
                      >
                        {t(PRIORITY_KEY[item])}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="block">
                <span className="remo-label">{t('task_description')}</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="remo-input mt-1" />
              </label>
              <label className="block">
                <span className="remo-label">{t('task_repo')}</span>
                <input value={repoName} onChange={(e) => setRepoName(e.target.value)} className="remo-input mt-1" placeholder="org/service" />
              </label>
              <label className="block">
                <span className="remo-label">{t('task_reproduction')}</span>
                <textarea value={reproduction} onChange={(e) => setReproduction(e.target.value)} rows={3} className="remo-input mt-1" />
              </label>
              <label className="block">
                <span className="remo-label">{t('task_screenshot_url')}</span>
                <input value={screenshotUrl} onChange={(e) => setScreenshotUrl(e.target.value)} className="remo-input mt-1" />
              </label>
              <div>
                <span className="remo-label">{t('task_recurrence')}</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {RECURRENCES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRecurrence(value)}
                      className={`remo-toggle ${recurrence === value ? 'remo-toggle-on' : ''}`}
                    >
                      {t(`task_recurrence_${value}` as 'task_recurrence_none')}
                    </button>
                  ))}
                </div>
                {recurrence !== 'none' && (
                  <label className="mt-2 flex flex-wrap items-center gap-2 remo-hint">
                    <input type="checkbox" checked={hasUntil} onChange={(e) => setHasUntil(e.target.checked)} className="rounded border-ink-300 text-accent-700 focus:ring-accent-500" />
                    {t('task_recurrence_until')}
                    {hasUntil && (
                      <span className="flex gap-1">
                        <select value={safeUntilDay} onChange={(e) => setUntilJd(Number(e.target.value))} className="remo-input !w-auto !px-1.5 !py-1 text-xs">
                          {Array.from({ length: untilDays }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={untilJm} onChange={(e) => setUntilJm(Number(e.target.value))} className="remo-input !w-auto !px-1.5 !py-1 text-xs">
                          {JALALI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                        </select>
                        <select value={untilJy} onChange={(e) => setUntilJy(Number(e.target.value))} className="remo-input !w-auto !px-1.5 !py-1 text-xs">
                          {[untilJy - 1, untilJy, untilJy + 1, untilJy + 2].map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </span>
                    )}
                  </label>
                )}
              </div>
              <div>
                <span className="remo-label">{t('task_labels')}</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const on = labelIds.includes(label.id)
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => setLabelIds((prev) => (on ? prev.filter((id) => id !== label.id) : [...prev, label.id]))}
                        className="remo-chip border"
                        style={{ borderColor: label.color, background: on ? label.color : 'transparent', color: on ? '#fff' : label.color }}
                      >
                        {label.title}
                      </button>
                    )
                  })}
                </div>
                {canCreateLabel && (
                  <div className="mt-2 flex gap-2">
                    <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t('task_add_label')} className="remo-input flex-1 !py-1.5 text-xs" />
                    <button type="button" disabled={!newLabel.trim() || addLabel.isPending} onClick={() => addLabel.mutate()} className="remo-btn-secondary !px-3">+</button>
                  </div>
                )}
              </div>
              <div>
                <span className="remo-label">{t('task_attachments')}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="remo-btn-secondary text-xs">
                    {t('task_add_file')}
                  </button>
                  <button
                    type="button"
                    onClick={() => (recording ? stopRecording() : startRecording())}
                    className={`remo-btn-secondary text-xs ${recording ? '!border-heat-500 !bg-heat-500 !text-white' : ''}`}
                  >
                    {recording ? t('task_stop_voice') : t('task_record_voice')}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,audio/*,.pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length) setPendingFiles((prev) => [...prev, ...files])
                      e.target.value = ''
                    }}
                  />
                </div>
                {(pendingFiles.length > 0 || (task?.attachments?.length || 0) > 0) && (
                  <ul className="mt-2 space-y-1 remo-hint">
                    {task?.attachments?.map((att) => (
                      <li key={att.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1 dark:bg-ink-900/60">
                        <span className="remo-chip bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{att.kind}</span>
                        <span className="truncate text-ink-600 dark:text-ink-300">{att.filename}</span>
                      </li>
                    ))}
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-accent-50 px-2 py-1 dark:bg-accent-950/30">
                        <span className="truncate text-ink-700 dark:text-ink-200">+ {file.name}</span>
                        <button type="button" className="ms-auto text-heat-600" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!task && canApprove && (
            <label className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="rounded border-ink-300 text-accent-700 focus:ring-accent-500" />
              {t('task_auto_approve')}
            </label>
          )}

          {error && <p className="text-xs text-heat-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-ink-100 dark:border-ink-800 flex justify-end gap-2">
          <button onClick={onClose} className="remo-btn-ghost">{t('cancel')}</button>
          <button onClick={submit} disabled={save.isPending} className="remo-btn-primary">
            {save.isPending ? t('saving') : t('task_save')}
          </button>
        </div>
      </div>
    </div>
  )
}
