import LinkCalendarButton from './LinkCalendarButton'

export default function SyncCalendarSection({ calendarLinked = false }: { calendarLinked?: boolean }) {
  return <LinkCalendarButton linked={calendarLinked} />
}
