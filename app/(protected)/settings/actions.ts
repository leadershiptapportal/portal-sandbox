'use server'

import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { updateUserTheme } from '@/lib/airtable/users'

export async function saveThemeAction(theme: 'light' | 'dark' | 'system') {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) return
  await updateUserTheme(userRecord.airtableId, theme)
}
