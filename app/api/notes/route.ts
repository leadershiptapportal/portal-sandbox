import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getNotesByHuman, createNote } from '@/lib/airtable/notes'
import type { NoteType } from '@/lib/airtable/notes'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const humanId = searchParams.get('humanId')
  if (!humanId) {
    return NextResponse.json({ error: 'humanId is required' }, { status: 400 })
  }

  const notes = await getNotesByHuman(humanId)
  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const body = (await req.json()) as {
    content: string
    date?: string
    humanId?: string
    subjectPersonId?: string
    interactionId?: string
    noteType?: NoteType
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
  }

  const note = await createNote({
    content: body.content.trim(),
    date: body.date,
    authorPersonId: userRecord.airtableId,
    coachName: userRecord.name || undefined,
    humanId: body.humanId,
    subjectPersonId: body.subjectPersonId ?? body.humanId,
    interactionId: body.interactionId,
    noteType: body.noteType,
  })
  return NextResponse.json(note, { status: 201 })
}
