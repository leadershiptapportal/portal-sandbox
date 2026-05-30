import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHumanRecord } from '@/lib/airtable/humans'
import { generateRelationshipRows } from '@/lib/airtable/relationships'
import { createAffiliation } from '@/lib/airtable/affiliations'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    firstName,
    lastName,
    jobTitle,
    workEmail,
    organizationId,
    coachIds = [],
    reportsToIds = [],
    directReportIds = [],
  } = body

  if (!firstName?.trim()) {
    return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  }
  if (!lastName?.trim()) {
    return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  }

  try {
    // 1. Create Users record
    const newHumanId = await createHumanRecord({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      workEmail: workEmail?.trim() || undefined,
      coachIds: coachIds.length > 0 ? coachIds : undefined,
      role: 'client',
    })

    // 1b. Organization is stored as an Affiliation, not the flat link.
    if (organizationId) {
      await createAffiliation({
        humanId: newHumanId,
        organizationId,
        primary: true,
        status: 'Active',
        titleAtOrg: jobTitle?.trim() || undefined,
      })
    }

    // 2. Generate Relationship Context rows
    const rcCount =
      (coachIds.length > 0 ? coachIds.length : 0) +
      (reportsToIds.length > 0 ? reportsToIds.length : 0) +
      (directReportIds.length > 0 ? directReportIds.length : 0)

    if (rcCount > 0) {
      await generateRelationshipRows({
        newHumanId,
        coaches: coachIds.length > 0 ? coachIds : undefined,
        reportsTo: reportsToIds.length > 0 ? reportsToIds : undefined,
        directReports: directReportIds.length > 0 ? directReportIds : undefined,
      })
    }

    return NextResponse.json({
      id: newHumanId,
      relationshipContextsCreated: rcCount,
    })
  } catch (err) {
    console.error('[POST /api/humans] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create person' },
      { status: 500 },
    )
  }
}
