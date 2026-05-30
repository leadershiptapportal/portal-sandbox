import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHumanRecord } from '@/lib/airtable/humans'
import { generateRelationshipRows } from '@/lib/airtable/relationships'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    firstName,
    lastName,
    jobTitle,
    workEmail,
    companyId,
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
      'First Name': firstName.trim(),
      'Last Name': lastName.trim(),
      ...(jobTitle?.trim() ? { 'Job Title': jobTitle.trim() } : {}),
      ...(workEmail?.trim() ? { 'Work Email': workEmail.trim() } : {}),
      ...(companyId ? { 'Company': [companyId] } : {}),
      ...(coachIds.length > 0 ? { 'Coach': coachIds } : {}),
      'Role': 'client',
    })

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
    console.error('[POST /api/people] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create person' },
      { status: 500 },
    )
  }
}
