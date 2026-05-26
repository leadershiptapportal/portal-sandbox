'use client'

import Link from 'next/link'
import { FileText, CheckSquare, Calendar, History, NotebookPen } from 'lucide-react'
import AddTaskDashboardDialog from './AddTaskDashboardDialog'
import AddInteractionDialog from '@/components/AddInteractionDialog'
import LogNoteDialog from '@/app/(protected)/myhumans/[id]/LogNoteDialog'
import TakeNotesDialog from './TakeNotesDialog'

interface Client {
  id: string
  name: string
}

interface Coach {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  coaches: Coach[]
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function ActionCard({
  icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {/* Non-interactive label layer — pointer-events-none so the trigger above
          captures clicks. On mobile the description is hidden and padding is
          tightened so the overlay fits within the 72px card height; on sm+
          the original spacing returns. */}
      <div className="pointer-events-none absolute inset-0 flex items-center gap-3 sm:gap-4 px-3 sm:px-5 rounded-xl">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block truncate">{description}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardQuickActions({ clients, coaches }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Quick Actions</p>
      {/* 2-up on mobile, 3-up on md, 5-up on xl */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <TakeNotesDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<NotebookPen className="w-5 h-5 text-[hsl(213,70%,40%)]" />}
              iconBg="bg-[hsl(213,60%,94%)]"
              label="Take Notes"
              description="Handwrite session notes"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-[hsl(213,70%,70%)] hover:bg-[hsl(213,60%,97%)] transition-colors" />
            </ActionCard>
          }
        />

        <LogNoteDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-100"
              label="Add Note"
              description="Record coaching observations"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <AddInteractionDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<History className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-100"
              label="Add Interaction"
              description="Record an interaction manually"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <AddTaskDashboardDialog
          clients={clients}
          coaches={coaches}
          trigger={
            <ActionCard
              icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-100"
              label="Add Task"
              description="Assign a follow-up"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <ActionCard
          icon={<Calendar className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-100"
          label="All Interactions"
          description="Browse past and upcoming"
        >
          <Link
            href="/interactions?filter=upcoming"
            className="block w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
          />
        </ActionCard>
      </div>
    </div>
  )
}
