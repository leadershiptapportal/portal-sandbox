'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { IMPERSONATE_COOKIE } from '@/lib/auth/impersonation'

const API = `https://api.airtable.com/v0`

function getEnv() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

async function assertAdmin() {
  const u = await getCurrentUserRecord()
  if (u.realRole !== 'admin') throw new Error('Not authorized')
  return u
}

export async function updateUserRoleAction(recordId: string, role: string) {
  await assertAdmin()
  const { apiKey, baseId } = getEnv()
  const res = await airtableFetch(`${API}/${baseId}/${TABLES.PEOPLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.USERS.ROLE]: role } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to update role: ${text}`)
  }
  revalidatePath('/admin/users')
}

export async function updateUserPermissionProfileAction(recordId: string, profileId: string) {
  await assertAdmin()
  const { apiKey, baseId } = getEnv()
  // profileId='' means clear the profile
  const profileIds = profileId ? [profileId] : []
  const res = await airtableFetch(`${API}/${baseId}/${TABLES.PEOPLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.USERS.PERMISSION_PROFILE]: profileIds } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to update profile: ${text}`)
  }
  revalidatePath('/admin/users')
}

export async function startImpersonationAction(airtableRecordId: string) {
  const u = await getCurrentUserRecord()
  if (u.realRole !== 'admin') return
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, airtableRecordId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  redirect('/dashboard')
}
