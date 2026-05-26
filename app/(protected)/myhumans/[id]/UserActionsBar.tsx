'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare, NotebookPen } from 'lucide-react'
import LogNoteDialog from './LogNoteDialog'
import AddTaskDialog from './AddTaskDialog'
import AddInteractionDialog from '@/components/AddInteractionDialog'

interface UserActionsBarProps {
  userId: string
}

export default function UserActionsBar({ userId }: UserActionsBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button asChild size="sm">
        <Link href={`/myhumans/${userId}/messages/new`}>
          <MessageSquare />
          Create Follow-up Draft
        </Link>
      </Button>

      <Button asChild size="sm" variant="outline">
        <Link href={`/myhumans/${userId}/take-notes`}>
          <NotebookPen className="h-4 w-4" />
          Take Notes
        </Link>
      </Button>

      <LogNoteDialog userId={userId} />
      <AddInteractionDialog defaultPersonId={userId} />
      <AddTaskDialog userId={userId} />
    </div>
  )
}
