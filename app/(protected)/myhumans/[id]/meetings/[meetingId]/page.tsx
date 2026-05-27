import { redirect } from 'next/navigation'

// This route has been replaced by /myhumans/[id]/interactions/[interactionId].
export default async function LegacyMeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>
}) {
  const { id, meetingId } = await params
  redirect(`/myhumans/${id}/interactions/${meetingId}`)
}
