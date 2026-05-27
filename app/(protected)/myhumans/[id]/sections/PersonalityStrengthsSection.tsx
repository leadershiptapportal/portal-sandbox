import { Brain } from 'lucide-react'
import { SectionHeading, DescriptorText } from './helpers'
import type { User } from '@/lib/types'

interface Props {
  user: User
  // Formatted display labels resolved from personality option tables.
  // e.g. "Type 1 | The Reformer", "INTJ | Architect"
  enneagramLabel?: string
  mbtiLabel?: string
  // Resolved from conflictPostureIds + Conflict Postures table (no lookup field in Users)
  conflictPostureLabel?: string
  // Map of strength name → descriptor text, resolved from the Strengths table.
  strengthDescriptors?: Record<string, string>
}

export default function PersonalityStrengthsSection({
  user,
  enneagramLabel,
  mbtiLabel,
  conflictPostureLabel,
  strengthDescriptors,
}: Props) {
  const hasPersonality =
    !!(user.enneagramType || user.enneagram || user.mbtiType || user.mbti ||
       user.conflictPosture || user.conflictPostureDescriptor ||
       user.apologyLanguage ||
       (user.strengths && user.strengths.length > 0))

  if (!hasPersonality) return null

  const enneagramDisplay = enneagramLabel ?? user.enneagramType ?? user.enneagram
  const mbtiDisplay = mbtiLabel ?? user.mbtiType ?? user.mbti

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={Brain} title="Personality & Strengths" />
      <div className="space-y-5">

        {enneagramDisplay && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Enneagram</p>
            <p className="text-sm font-medium text-slate-800">
              {enneagramDisplay}
            </p>
            {user.enneagramDescriptor && (
              <DescriptorText text={user.enneagramDescriptor} />
            )}
          </div>
        )}

        {mbtiDisplay && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">16 Personalities</p>
            <p className="text-sm font-medium text-slate-800">
              {mbtiDisplay}
            </p>
            {user.mbtiDescriptor && (
              <DescriptorText text={user.mbtiDescriptor} />
            )}
          </div>
        )}

        {(conflictPostureLabel || user.conflictPosture || user.conflictPostureDescriptor) && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Conflict Posture</p>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1.5">
              {(conflictPostureLabel || user.conflictPosture) && (
                <p className="text-sm font-semibold text-amber-800">
                  {conflictPostureLabel ?? user.conflictPosture}
                </p>
              )}
              {user.conflictPostureDescriptor && (
                <DescriptorText text={user.conflictPostureDescriptor} />
              )}
            </div>
          </div>
        )}

        {user.apologyLanguage && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Apology Language</p>
            <p className="text-sm font-medium text-slate-800">{user.apologyLanguage}</p>
            {user.apologyLanguageDescriptor && (
              <DescriptorText text={user.apologyLanguageDescriptor} />
            )}
          </div>
        )}

        {user.strengths && user.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">CliftonStrengths</p>
            <ol className="space-y-2">
              {user.strengths.map((s, i) => {
                const descriptor = strengthDescriptors?.[s.name]
                return (
                  <li key={i}>
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800 font-medium">{s.name}</span>
                      {s.domain && (
                        <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded">
                          {s.domain}
                        </span>
                      )}
                    </div>
                    {descriptor && (
                      <div className="ml-7 mt-0.5">
                        <DescriptorText text={descriptor} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}

      </div>
    </div>
  )
}
