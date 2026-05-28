import { requireCurrentPortalPerson } from "@/lib/auth/requireCurrentPortalPerson";
import AppShell from "@/components/layout/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const person = await requireCurrentPortalPerson();

  return (
    <AppShell
      isAdmin={person.role === 'admin'}
      isImpersonated={person.isImpersonated}
      impersonatedName={`${person.firstName} ${person.lastName}`.trim()}
    >
      {children}
    </AppShell>
  );
}
