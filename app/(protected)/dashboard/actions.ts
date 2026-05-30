'use server'

import { revalidatePath } from 'next/cache'
import { createTask, updateTask, updateTaskStatus, deleteTask, type UpdateTaskData } from '@/lib/airtable/tasks'
import type { TaskStatus } from '@/lib/types'
import { createNote, updateNote, deleteNote } from '@/lib/airtable/notes'
import { getInteractionsByUserEmail } from '@/lib/airtable/interactions'
import { getHumanById } from '@/lib/services/humansService'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { resolveContextForSubject } from '@/lib/airtable/relationships'

export async function dashboardUpdateTaskStatusAction(
  taskId: string,
  status: TaskStatus,
): Promise<{ success: boolean }> {
  const result = await updateTaskStatus(taskId, status)
  if ('error' in result) {
    console.error('[dashboardUpdateTaskStatusAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardUpdateTaskAction(
  taskId: string,
  data: UpdateTaskData,
): Promise<{ success: boolean; error?: string }> {
  const result = await updateTask(taskId, data)
  if ('error' in result) {
    console.error('[dashboardUpdateTaskAction]', result.error)
    return { success: false, error: result.error }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardDeleteTaskAction(
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteTask(taskId)
  if ('error' in result) {
    console.error('[dashboardDeleteTaskAction]', result.error)
    return { success: false, error: result.error }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardCreateTaskAction(data: {
  title: string
  notes?: string
  dueDate?: string
  assignedToPersonId?: string   // undefined → self-assign (personal_reminder)
  humanId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }
    await createTask({
      title: data.title,
      notes: data.notes,
      dueDate: data.dueDate,
      humanId: data.humanId ?? data.assignedToPersonId,
      createdByPersonId: userRecord.airtableId,
      assignedToPersonId: data.assignedToPersonId ?? userRecord.airtableId,
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardCreateTaskAction]', err)
    return { success: false, error: String(err) }
  }
}

// ── Notes ──────────────────────────────────────────────────────────────────────

// Fetch a human's 10 most recent past interactions for the interaction-link dropdown
export async function fetchHumanInteractionsAction(
  humanId: string,
): Promise<Array<{ id: string; label: string }>> {
  try {
    const user = await getHumanById(humanId)
    if (!user) return []
    const email = user.workEmail
    if (!email) return []
    const meetings = await getInteractionsByUserEmail(email)
    const now = new Date()
    return meetings
      .filter((m) => m.startTime && new Date(m.startTime) < now)
      .slice(0, 10)
      .map((m) => {
        const d = new Date(m.startTime)
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { id: m.id, label: `${dateLabel} · ${m.title || 'Untitled Interaction'}` }
      })
  } catch (err) {
    console.error('[fetchHumanInteractionsAction]', err)
    return []
  }
}

// Save a note to the Notes table, optionally linked to an interaction
export async function dashboardLogNoteAction(params: {
  humanId: string
  content: string
  interactionId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, params.humanId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: params.content,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.humanId,
      humanId: params.humanId,
      relationshipContextId: rc.id,
      interactionId: params.interactionId,
      noteType: params.interactionId ? 'interaction_note' : 'general_note',
    })
    revalidatePath('/dashboard')
    if (params.interactionId) revalidatePath(`/myhumans/${params.humanId}`)
    return { success: true }
  } catch (err) {
    console.error('[dashboardLogNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardSaveNoteAction(
  humanId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, humanId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: humanId,
      humanId,
      relationshipContextId: rc.id,
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardSaveNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardUpdateNoteAction(
  noteId: string,
  body: string,
): Promise<{ success: boolean }> {
  const result = await updateNote(noteId, body)
  if ('error' in result) {
    console.error('[dashboardUpdateNoteAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardDeleteNoteAction(
  noteId: string,
): Promise<{ success: boolean }> {
  const result = await deleteNote(noteId)
  if ('error' in result) {
    console.error('[dashboardDeleteNoteAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function savePortalEventNotesAction(
  meetingId: string,
  notes: string,
  humanId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, humanId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: notes,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: humanId,
      humanId,
      relationshipContextId: rc.id,
      interactionId: meetingId,
      noteType: 'interaction_note',
    })
    revalidatePath('/dashboard')
    revalidatePath(`/myhumans/${humanId}`)
    return { success: true }
  } catch (err) {
    console.error('[savePortalEventNotesAction]', err)
    return { success: false, error: String(err) }
  }
}
