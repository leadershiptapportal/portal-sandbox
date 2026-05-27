'use client'

import Link from 'next/link'
import { FileText, CheckSquare, Calendar, History, NotebookPen } from 'lucide-react'
import AddTaskDashboardDialog from './AddTaskDashboardDialog'
import AddInteractionDialog from '@/components/AddInteractionDialog'
import LogNoteDialog from '@/app/(protected)/myhumans/[id]/LogNoteDialog'
import TakeNotesDialog from './TakeNotesDialog'

interface Human {
  id: string
  name: string
}

interface Coach {
  id: string
  name: string
}

interface Props {
  humans: Human[]
  coaches: Coach[]
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function ActionCard({
  icon,
  iconBg,
  label,
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
      <div className="pointer-events-none absolute inset-0 flex items-center gap-2.5 px-3 rounded-lg">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <p className="text-xs font-semibold text-slate-700 truncate">{label}</p>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardQuickActions({ humans, coaches }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-4 md:mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Quick Actions</p>
      {/* 2-up on mobile, 3-up on md, 5-up on xl */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        <TakeNotesDialog
          humans={humans}
          trigger={
            <ActionCard
              icon={<NotebookPen className="w-3.5 h-3.5 text-[hsl(213,70%,40%)]" />}
              iconBg="bg-[hsl(213,60%,94%)]"
              label="Take Notes"
              description=""
            >
              <button className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white hover:border-[hsl(213,70%,70%)] hover:bg-[hsl(213,60%,97%)] transition-colors" />
            </ActionCard>
          }
        />

        <LogNoteDialog
          humans={humans}
          trigger={
            <ActionCard
              icon={<FileText className="w-3.5 h-3.5 text-blue-600" />}
              iconBg="bg-blue-100"
              label="Add Note"
              description=""
            >
              <button className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <AddInteractionDialog
          humans={humans}
          trigger={
            <ActionCard
              icon={<History className="w-3.5 h-3.5 text-amber-600" />}
              iconBg="bg-amber-100"
              label="Add Interaction"
              description=""
            >
              <button className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <AddTaskDashboardDialog
          humans={humans}
          coaches={coaches}
          trigger={
            <ActionCard
              icon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" />}
              iconBg="bg-emerald-100"
              label="Add Task"
              description=""
            >
              <button className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <ActionCard
          icon={<Calendar className="w-3.5 h-3.5 text-violet-600" />}
          iconBg="bg-violet-100"
          label="All Interactions"
          description=""
        >
          <Link
            href="/interactions?filter=upcoming"
            className="block w-full min-h-[44px] rounded-lg border border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
          />
        </ActionCard>
      </div>
    </div>
  )
}
