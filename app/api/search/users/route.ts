import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { searchUsersByName } from '@/lib/airtable/users'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const results = await searchUsersByName(q)
  return NextResponse.json(results)
}
