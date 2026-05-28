'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { updateUserTheme } from '@/lib/airtable/users'
import { IMPERSONATE_COOKIE } from '@/lib/auth/impersonation'

export async function saveThemeAction(theme: 'light' | 'dark' | 'system') {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.realAirtableId) return
  // Always save theme to the real user's record, not the impersonated one
  await updateUserTheme(userRecord.realAirtableId, theme)
}

export async function startImpersonationAction(airtableRecordId: string) {
  const userRecord = await getCurrentUserRecord()
  // Only admins can impersonate — verified against Airtable role
  if (userRecord.role !== 'admin') return

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

export async function stopImpersonationAction() {
  const store = await cookies()
  store.delete(IMPERSONATE_COOKIE)
  redirect('/dashboard')
}
