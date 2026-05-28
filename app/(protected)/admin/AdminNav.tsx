'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/users',         label: 'Portal Users' },
  { href: '/admin/relationships', label: 'Relationships' },
  { href: '/admin/profiles',      label: 'Permission Profiles' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-0 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            pathname.startsWith(tab.href)
              ? 'border-[hsl(213,70%,30%)] text-[hsl(213,70%,30%)] dark:border-[hsl(213,60%,65%)] dark:text-[hsl(213,60%,65%)]'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
