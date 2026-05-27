import { redirect } from 'next/navigation'

// This route has been renamed to [interactionId]. Redirect for backwards compatibility.
export default async function LegacyInteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>
}) {
  const { id, meetingId } = await params
  redirect(`/myhumans/${id}/interactions/${meetingId}`)
}
