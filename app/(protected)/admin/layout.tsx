import { redirect } from 'next/navigation'
import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const person = await requireCurrentPortalPerson()
  // isImpersonated means the cookie was set by a real admin — still allow admin area access
  const isRealAdmin = person.role === 'admin' || person.isImpersonated
  if (!isRealAdmin) redirect('/dashboard')

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Admin</h1>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  )
}
