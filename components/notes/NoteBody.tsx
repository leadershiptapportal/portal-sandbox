/**
 * Renders a note body. Supports two storage formats:
 *
 * New (ink_note): inkImageUrl is a separate field; content holds only the
 * optional caption. Pass both props and the image renders below the caption.
 *
 * Legacy: image URL embedded in content as ![Ink note](url). Still parsed
 * for backward compatibility with notes written before the schema change.
 */

interface Props {
  content: string
  /** Cloudinary URL from the dedicated Ink Image URL field (new format). */
  inkImageUrl?: string
  /** Tailwind classes applied to the wrapping text block. */
  className?: string
  /** Limit ink image height so it doesn't dominate small note cards. */
  imageMaxHeightClass?: string
}

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

interface Segment {
  kind: 'text' | 'image'
  value: string   // text content or image URL
  alt?: string
}

function parse(content: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  for (const match of content.matchAll(IMG_RE)) {
    const idx = match.index ?? 0
    if (idx > lastIndex) {
      segments.push({ kind: 'text', value: content.slice(lastIndex, idx) })
    }
    segments.push({ kind: 'image', value: match[2], alt: match[1] || 'Ink note' })
    lastIndex = idx + match[0].length
  }
  if (lastIndex < content.length) {
    segments.push({ kind: 'text', value: content.slice(lastIndex) })
  }
  return segments
}

export default function NoteBody({
  content,
  inkImageUrl,
  className = 'text-sm text-slate-700 whitespace-pre-wrap leading-relaxed',
  imageMaxHeightClass = 'max-h-80',
}: Props) {
  // New format: image lives in inkImageUrl; content is caption-only (no markdown).
  if (inkImageUrl) {
    const caption = content.replace(/^\n+|\n+$/g, '')
    return (
      <div className="space-y-2">
        {caption && <p className={className}>{caption}</p>}
        <img
          src={inkImageUrl}
          alt="Ink note"
          className={`block w-full object-contain rounded-md border border-slate-200 bg-white ${imageMaxHeightClass}`}
          loading="lazy"
        />
      </div>
    )
  }

  // Legacy format: image URL embedded as markdown inside content.
  const segments = parse(content)
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (seg.kind === 'image') {
          return (
            <img
              key={i}
              src={seg.value}
              alt={seg.alt ?? 'Ink note'}
              className={`block w-full object-contain rounded-md border border-slate-200 bg-white ${imageMaxHeightClass}`}
              loading="lazy"
            />
          )
        }
        const trimmed = seg.value.replace(/^\n+|\n+$/g, '')
        if (trimmed.length === 0) return null
        return (
          <p key={i} className={className}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Lightweight helper for surfaces that only need a one-line preview (e.g.
 * dashboard rollups). Strips markdown image syntax so previews don't show a
 * raw URL, and replaces them with a [ink] sentinel the caller can style.
 */
export function previewText(content: string, maxLength = 120): string {
  const stripped = content.replace(IMG_RE, '[ink]').trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength).trimEnd() + '…'
}
