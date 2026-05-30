'use server'

import { revalidatePath } from 'next/cache'
import { createHumanRecord } from '@/lib/airtable/humans'

export async function createClientAction(data: {
  firstName: string
  lastName: string
  workEmail: string
  jobTitle?: string
  organizationId?: string
  coachId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = await createHumanRecord({
      firstName: data.firstName,
      lastName: data.lastName,
      workEmail: data.workEmail,
      title: data.jobTitle,
      organizationIds: data.organizationId ? [data.organizationId] : undefined,
      coachIds: data.coachId ? [data.coachId] : undefined,
    })
    revalidatePath('/myhumans')
    return { success: true, id }
  } catch (err) {
    console.error('[createClientAction]', err)
    return { success: false, error: String(err) }
  }
}
