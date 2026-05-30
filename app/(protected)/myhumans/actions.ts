'use server'

import { revalidatePath } from 'next/cache'
import { createHumanRecord } from '@/lib/airtable/humans'

export async function createClientAction(data: {
  firstName: string
  lastName: string
  workEmail: string
  jobTitle?: string
  companyId?: string
  coachId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = await createHumanRecord({
      'First Name': data.firstName,
      'Last Name': data.lastName,
      'Work Email': data.workEmail,
      ...(data.jobTitle ? { 'Job Title': data.jobTitle } : {}),
      ...(data.companyId ? { 'Company': [data.companyId] } : {}),
      ...(data.coachId ? { 'Coach': [data.coachId] } : {}),
    })
    revalidatePath('/myhumans')
    return { success: true, id }
  } catch (err) {
    console.error('[createClientAction]', err)
    return { success: false, error: String(err) }
  }
}
