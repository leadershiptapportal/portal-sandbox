interface PlaceholderSectionProps {
  icon: React.ReactNode
  title: string
  message: string
}

export default function PlaceholderSection({ icon, title, message }: PlaceholderSectionProps) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 flex flex-col items-center text-center">
      <div className="text-muted-foreground/60 [&>svg]:h-8 [&>svg]:w-8 mb-3">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
    </div>
  )
}
