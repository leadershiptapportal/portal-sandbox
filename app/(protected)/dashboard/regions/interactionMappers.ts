import { findClientForInteraction } from '@/lib/services/interactionsService'
import { resolveDisplayTz } from '@/lib/utils/dateFormat'
import type { Interaction, Human } from '@/lib/types'
import type { UpcomingItem } from '../UpcomingInteractionsCard'

function getDisplayName(user: Human): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.workEmail ?? ''
}

interface MapOpts {
  emailToUser: Map<string, Human>
  notedInteractionIds: Set<string>
  coachEmail: string
}

/**
 * Filters and dedupes a list of Interactions, then maps them into UpcomingItems
 * for rendering in dashboard widgets.
 *
 * - `activeContextIds`: when provided (i.e. for non-admins), drops interactions
 *   whose RC isn't in the coach's active set. Pass `null` to skip.
 * - Dedups by `Provider Event ID` first (so calendar fan-out collapses),
 *   then by title+startTime as a fallback for legacy rows.
 */
export function interactionsToUpcomingItems(
  interactions: Interaction[],
  opts: MapOpts & { activeContextIds: Set<string> | null },
): UpcomingItem[] {
  const { emailToUser, notedInteractionIds, coachEmail, activeContextIds } = opts

  const ownershipFiltered = activeContextIds
    ? interactions.filter(
        (m) => !m.relationshipContextId || activeContextIds.has(m.relationshipContextId),
      )
    : interactions

  const seenById = new Set<string>()
  const seenKeys = new Set<string>()
  const deduped = ownershipFiltered.filter((m) => {
    if (m.providerEventId) {
      if (seenById.has(m.providerEventId)) return false
      seenById.add(m.providerEventId)
      return true
    }
    const key = `${m.title ?? ''}|${m.startTime ?? ''}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  return deduped.map((interaction) => {
    const client =
      findClientForInteraction(interaction, emailToUser) ??
      (interaction.senderEmail
        ? (emailToUser.get(interaction.senderEmail.toLowerCase().trim()) ?? null)
        : null)
    const tz = resolveDisplayTz(interaction.timezone)
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
    const timeRange = interaction.endTime
      ? `${fmt(interaction.startTime)} – ${fmt(interaction.endTime)} ET`
      : `${fmt(interaction.startTime)} ET`

    const externalEmails = interaction.participantEmails.filter(
      (e) => e && !e.toLowerCase().includes('leadershiptap.com') && e.toLowerCase() !== coachEmail,
    )

    return {
      interactionId: interaction.id,
      providerEventId: interaction.providerEventId ?? null,
      title: interaction.title,
      startTime: interaction.startTime,
      endTime: interaction.endTime,
      timezone: tz,
      weekday: new Date(interaction.startTime).toLocaleString('en-US', { timeZone: tz, weekday: 'short' }),
      day: parseInt(new Date(interaction.startTime).toLocaleString('en-US', { timeZone: tz, day: 'numeric' }), 10),
      month: new Date(interaction.startTime).toLocaleString('en-US', { timeZone: tz, month: 'short' }),
      timeRange,
      humanId: client?.id ?? null,
      humanName: interaction.humanName ?? (client ? getDisplayName(client) : null),
      displayLabel: client ? null : (() => {
        const allEmails = [interaction.senderEmail, ...interaction.participantEmails]
          .filter(Boolean)
          .map((e) => e!.trim().toLowerCase())
          .filter((e) => e && !e.includes('leadershiptap') && e !== coachEmail)
        const domains = [...new Set(
          allEmails
            .map((e) => e.split('@')[1]?.replace(/\.(com|net|org|io)$/, '') ?? '')
            .filter(Boolean),
        )]
        return domains.slice(0, 2).join(', ') || null
      })(),
      participantEmails: externalEmails,
      hasNote: notedInteractionIds.has(interaction.id),
      interactionType: interaction.interactionType,
      source: interaction.source,
    }
  })
}

/** @deprecated Use interactionsToUpcomingItems instead */
export const meetingsToUpcomingItems = interactionsToUpcomingItems
