import { cookies } from 'next/headers'

export const IMPERSONATE_COOKIE = '__portal_impersonate'

export async function getImpersonatedRecordId(): Promise<string | null> {
  try {
    const store = await cookies()
    return store.get(IMPERSONATE_COOKIE)?.value ?? null
  } catch {
    return null
  }
}
