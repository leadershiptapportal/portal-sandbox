import Link from 'next/link'
import { Mail } from 'lucide-react'
import type { Message } from '@/lib/types'

interface MessageHistoryProps {
  messages: Message[]
  userId: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: 'Pending' | 'Sent' }) {
  if (status === 'Sent') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 shrink-0">
        Sent
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 shrink-0">
      Pending
    </span>
  )
}

function MessageRow({ msg, userId }: { msg: Message; userId: string }) {
  const subject = msg.subject ?? msg.messageName
  const preview = msg.body ? msg.body.slice(0, 120) + (msg.body.length > 120 ? '…' : '') : null

  const inner = (
    <div className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{subject}</p>
          {msg.created && (
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(msg.created)}</p>
          )}
          {preview && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{preview}</p>
          )}
        </div>
        <StatusBadge status={msg.status} />
      </div>
    </div>
  )

  if (msg.interactionId) {
    return (
      <Link
        href={`/myhumans/${userId}/interactions/${msg.interactionId}`}
        className="block"
      >
        {inner}
      </Link>
    )
  }

  return <div>{inner}</div>
}

export default function MessageHistory({ messages, userId }: MessageHistoryProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">Message History</h2>
      {messages.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} userId={userId} />
          ))}
        </div>
      )}
    </div>
  )
}
