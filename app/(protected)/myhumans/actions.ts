'use server'

import { revalidatePath } from 'next/cache'
import { createHumanRecord } from '@/lib/airtable/humans'
import { createAffiliation } from '@/lib/airtable/affiliations'

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
      coachIds: data.coachId ? [data.coachId] : undefined,
    })
    // Organization is stored as an Affiliation, not the flat Humans.Organization link.
    if (data.organizationId) {
      await createAffiliation({
        humanId: id,
        organizationId: data.organizationId,
        primary: true,
        status: 'Active',
        titleAtOrg: data.jobTitle,
      })
    }
    revalidatePath('/myhumans')
    return { success: true, id }
  } catch (err) {
    console.error('[createClientAction]', err)
    return { success: false, error: String(err) }
  }
}
