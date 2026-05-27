/**
 * @deprecated This module has been renamed to interactions.ts.
 * All exports are re-exported from there for backwards compatibility.
 */
export {
  getAllUpcomingInteractions as getAllUpcomingMeetings,
  getRecentPastInteractions as getRecentPastMeetings,
  getAllInteractions as getAllMeetings,
  getInteractionsByUserEmail as getMeetingsByUserEmail,
  getInteractionById as getMeetingById,
  updatePortalEventNotes,
  getPortalEventsByClientEmail,
  createManualInteraction as createManualMeeting,
} from '@/lib/airtable/interactions'

export type {
  CreateManualInteractionData as CreateManualMeetingData,
} from '@/lib/airtable/interactions'
