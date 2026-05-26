'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare, PenLine } from 'lucide-react'
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

      <LogNoteDialog userId={userId} />
      <AddInteractionDialog defaultPersonId={userId} />
      <AddTaskDialog userId={userId} />

      <Button asChild variant="outline" size="sm">
        <Link href={`/myhumans/${userId}/notes/new/ink`}>
          <PenLine />
          Ink Note
        </Link>
      </Button>
    </div>
  )
}
