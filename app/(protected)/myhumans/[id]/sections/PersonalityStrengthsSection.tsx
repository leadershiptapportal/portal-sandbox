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

// ── Shared card shell ─────────────────────────────────────────────────────────

function AttributeCard({
  label,
  name,
  descriptor,
  bg,
  border,
  nameColor,
  children,
}: {
  label: string
  name?: string
  descriptor?: string
  bg: string
  border: string
  nameColor: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      <div className={`rounded-lg border px-4 py-3 space-y-1.5 ${bg} ${border}`}>
        {name && (
          <p className={`text-sm font-semibold leading-snug ${nameColor}`}>{name}</p>
        )}
        {descriptor && <DescriptorText text={descriptor} />}
        {children}
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function PersonalityStrengthsSection({
  user,
  enneagramLabel,
  mbtiLabel,
  conflictPostureLabel,
  strengthDescriptors,
}: Props) {
  const enneagramDisplay = enneagramLabel ?? user.enneagramType ?? user.enneagram
  const mbtiDisplay = mbtiLabel ?? user.mbtiType ?? user.mbti
  const conflictDisplay = conflictPostureLabel ?? user.conflictPosture

  const hasPersonality =
    !!(enneagramDisplay || mbtiDisplay ||
       conflictDisplay || user.conflictPostureDescriptor ||
       user.apologyLanguage ||
       (user.strengths && user.strengths.length > 0))

  if (!hasPersonality) return null

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={Brain} title="Personality & Strengths" />

      <div className="space-y-4">

        {/* Enneagram ── blue */}
        {enneagramDisplay && (
          <AttributeCard
            label="Enneagram"
            name={enneagramDisplay}
            descriptor={user.enneagramDescriptor}
            bg="bg-blue-50 dark:bg-blue-950/40"
            border="border-blue-100 dark:border-blue-800/50"
            nameColor="text-blue-800 dark:text-blue-300"
          />
        )}

        {/* 16 Personalities ── violet */}
        {mbtiDisplay && (
          <AttributeCard
            label="16 Personalities"
            name={mbtiDisplay}
            descriptor={user.mbtiDescriptor}
            bg="bg-violet-50 dark:bg-violet-950/40"
            border="border-violet-100 dark:border-violet-800/50"
            nameColor="text-violet-800 dark:text-violet-300"
          />
        )}

        {/* Conflict Posture ── amber */}
        {(conflictDisplay || user.conflictPostureDescriptor) && (
          <AttributeCard
            label="Conflict Posture"
            name={conflictDisplay}
            descriptor={user.conflictPostureDescriptor}
            bg="bg-amber-50 dark:bg-amber-950/40"
            border="border-amber-100 dark:border-amber-800/50"
            nameColor="text-amber-800 dark:text-amber-300"
          />
        )}

        {/* Apology Language ── emerald */}
        {user.apologyLanguage && (
          <AttributeCard
            label="Apology Language"
            name={user.apologyLanguage}
            descriptor={user.apologyLanguageDescriptor}
            bg="bg-emerald-50 dark:bg-emerald-950/40"
            border="border-emerald-100 dark:border-emerald-800/50"
            nameColor="text-emerald-800 dark:text-emerald-300"
          />
        )}

        {/* CliftonStrengths ── indigo, numbered list */}
        {user.strengths && user.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Clifton Strengths
            </p>
            <div className="rounded-lg border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/40 px-4 py-3">
              <ol className="space-y-3">
                {user.strengths.map((s, i) => {
                  const descriptor = strengthDescriptors?.[s.name]
                  return (
                    <li key={i}>
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{s.name}</span>
                        {s.domain && (
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 rounded">
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
          </div>
        )}

      </div>
    </div>
  )
}
