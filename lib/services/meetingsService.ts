/**
 * @deprecated This module has been renamed to interactionsService.ts.
 * All exports are re-exported from there for backwards compatibility.
 */
export {
  getInteractions as getMeetings,
  getInteractionsForUser as getMeetingsForUser,
  getInteractionDetail as getMeetingDetail,
  updateInteractionNotes as updateMeetingNotes,
  buildEmailToUserMap,
  findClientForInteraction as findClientForMeeting,
  groupInteractionsByUser as groupMeetingsByUser,
} from '@/lib/services/interactionsService'
