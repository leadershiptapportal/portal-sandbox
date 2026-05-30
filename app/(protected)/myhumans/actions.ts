'use server'

import { revalidatePath } from 'next/cache'
import { createHumanRecord } from '@/lib/airtable/humans'
import { createAffiliation } from '@/lib/airtable/affiliations'
import { createOrganization } from '@/lib/airtable/organizations'
import { createRelationshipContext } from '@/lib/airtable/relationships'

export async function createClientAction(data: {
  firstName: string
  lastName: string
  workEmail: string
  jobTitle?: string
  organizationId?: string
  newOrg?: { name: string; domain?: string; orgType?: string }
  coachId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = await createHumanRecord({
      firstName: data.firstName,
      lastName: data.lastName,
      workEmail: data.workEmail,
    })

    let orgId = data.organizationId
    if (!orgId && data.newOrg?.name?.trim()) {
      orgId = await createOrganization({
        name: data.newOrg.name,
        domain: data.newOrg.domain,
        type: data.newOrg.orgType,
      })
    }

    if (data.coachId) {
      await createRelationshipContext({
        humanId: id,
        leadId: data.coachId,
        type: 'coaching',
        status: 'Active',
      })
    }

    if (orgId) {
      await createAffiliation({
        humanId: id,
        organizationId: orgId,
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
