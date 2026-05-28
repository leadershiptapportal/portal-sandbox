'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTaskStatusAction } from './actions'
import type { Task, TaskStatus } from '@/lib/types'

const STATUS_STYLES: Record<TaskStatus, string> = {
  'Not Started': 'bg-muted text-muted-foreground',
  'In Progress': 'bg-blue-50 text-blue-700',
  'Complete':    'bg-emerald-50 text-emerald-700',
  'Cancelled':   'bg-rose-50 text-rose-500',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  'Not Started': 'Not Started',
  'In Progress': 'In Progress',
  'Complete':    'Done',
  'Cancelled':   'Cancelled',
}

function formatDue(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TaskItem({ task }: { task: Task }) {
  const router = useRouter()
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatus>(task.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isDone = optimisticStatus === 'Complete'
  const isOverdue =
    task.dueDate &&
    !isDone &&
    new Date(task.dueDate + 'T23:59:59') < new Date()

  async function toggle() {
    const prev = optimisticStatus
    const next: TaskStatus = isDone ? 'Not Started' : 'Complete'
    setOptimisticStatus(next)
    setError('')
    setLoading(true)
    const result = await updateTaskStatusAction(task.id, next)
    setLoading(false)
    if (!result.success) {
      setOptimisticStatus(prev)
      setError('Failed to update — please try again')
    } else {
      router.refresh()
    }
  }

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
      isDone ? 'border-border opacity-60' : 'border-border hover:border-border'
    }`}>
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-border hover:border-emerald-400'
        }`}
      >
        {isDone && <span className="text-[10px] leading-none">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          isDone ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className={`text-xs mt-0.5 ${
            isOverdue ? 'text-rose-500 font-medium' : 'text-muted-foreground'
          }`}>
            {isOverdue ? 'Overdue · ' : 'Due '}{formatDue(task.dueDate)}
          </p>
        )}
        {task.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.notes}</p>
        )}
        {error && (
          <p className="text-xs text-rose-500 mt-0.5">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          STATUS_STYLES[optimisticStatus] ?? 'bg-muted text-muted-foreground'
        }`}>
          {STATUS_LABELS[optimisticStatus] ?? optimisticStatus}
        </span>
      </div>
    </div>
  )
}
