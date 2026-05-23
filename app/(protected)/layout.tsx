import { requireCurrentPortalPerson } from "@/lib/auth/requireCurrentPortalPerson";
import AppShell from "@/components/layout/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves Clerk session → People record, enforces Permission Profile gate,
  // and writes Clerk User ID on first email-matched login. Redirects on failure.
  await requireCurrentPortalPerson();

  return <AppShell>{children}</AppShell>;
}
