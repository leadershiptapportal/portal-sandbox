'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  Network,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import GlobalSearch from '@/components/GlobalSearch'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'My Dashboard', enabled: true },
  { href: '/myhumans', icon: Users, label: 'My Humans', enabled: true },
  { href: '/interactions', icon: Calendar, label: 'My Interactions', enabled: true },
  { href: '/settings', icon: Settings, label: 'Settings', enabled: true },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  isAdmin?: boolean
}

// ── Reusable nav row ──────────────────────────────────────────────────────────

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  enabled,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  collapsed: boolean
  enabled: boolean
}) {
  const base =
    'group relative flex items-center min-h-[44px] rounded-lg border-l-[3px] transition-colors'
  const layout = collapsed ? 'justify-center w-10 mx-auto px-0' : 'pl-[9px] pr-3 gap-3'
  const palette = !enabled
    ? 'border-transparent text-muted-foreground cursor-not-allowed'
    : active
      ? 'border-[hsl(213,70%,30%)] bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)] font-medium dark:bg-[hsl(213,70%,18%)] dark:text-[hsl(213,60%,72%)] dark:border-[hsl(213,60%,55%)]'
      : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

  const inner = (
    <>
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      {!collapsed && <span className="text-base truncate">{label}</span>}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50"
          role="tooltip"
        >
          {label}
        </span>
      )}
    </>
  )

  if (!enabled) {
    return (
      <div
        className={`${base} ${layout} ${palette}`}
        title={collapsed ? `${label} (Coming soon)` : 'Coming soon'}
        aria-label={`${label} (Coming soon)`}
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`${base} ${layout} ${palette}`}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {inner}
    </Link>
  )
}

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()

  return (
    <>
      {/* ── Mobile bottom navigation bar ── */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border h-16">
        <div className="flex w-full items-stretch">
          {navItems.map(({ href, icon: Icon, label, enabled }) => {
            const active = enabled && pathname.startsWith(href)
            if (!enabled) {
              return (
                <div
                  key={href}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground/40 cursor-not-allowed select-none"
                  title="Coming soon"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
              )
            }
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-[hsl(213,70%,30%)] dark:text-[hsl(213,60%,72%)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              href="/admin/relationships"
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                pathname.startsWith('/admin')
                  ? 'text-[hsl(213,70%,30%)] dark:text-[hsl(213,60%,72%)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </Link>
          )}
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium">Sign out</span>
          </button>
        </div>
      </nav>

      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 flex-col bg-sidebar border-r border-sidebar-border z-40 transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <div className="px-3 py-5 border-b border-sidebar-border h-[73px] flex items-center">
          {collapsed ? (
            <Link
              href="/dashboard"
              className="mx-auto w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
              title="MyHumans.App"
              aria-label="MyHumans.App home"
            >
              <img src="/myhumans-logo.png" alt="MyHumans.App" className="w-9 h-9 object-cover" />
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
              <img src="/myhumans-logo.png" alt="MyHumans.App" className="w-8 h-8 object-contain flex-shrink-0" />
              <span
                className="font-bold text-[hsl(213,70%,30%)] dark:text-[hsl(213,60%,72%)] text-base leading-tight truncate"
                style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
              >
                MyHumans.App
              </span>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {/* Search */}
          <div className="mb-3">
            <GlobalSearch collapsed={collapsed} />
          </div>

          {navItems.map(({ href, icon, label, enabled }) => (
            <NavRow
              key={href}
              href={href}
              icon={icon}
              label={label}
              enabled={enabled}
              active={enabled && pathname.startsWith(href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Admin */}
        {isAdmin && (
          <div className="px-2 pb-1">
            <NavRow
              href="/admin/relationships"
              icon={Network}
              label="Relationships"
              enabled
              active={pathname.startsWith('/admin')}
              collapsed={collapsed}
            />
          </div>
        )}

        {/* Bottom: user + sign out */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          {user && (
            <div
              className={`flex items-center rounded-lg ${
                collapsed ? 'justify-center px-0 py-1' : 'gap-3 px-3 py-2'
              }`}
              title={collapsed ? (user.fullName ?? user.primaryEmailAddress?.emailAddress ?? '') : undefined}
            >
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName ?? 'User avatar'}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                  {(user.fullName ?? user.primaryEmailAddress?.emailAddress ?? '?')[0].toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <span className="text-sm text-sidebar-foreground truncate min-w-0">
                  {user.fullName ?? user.primaryEmailAddress?.emailAddress}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className={`group relative flex items-center min-h-[44px] rounded-lg text-base text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${
              collapsed ? 'justify-center w-10 mx-auto px-0' : 'gap-3 px-3 w-full'
            }`}
            title={collapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="truncate">Sign out</span>}
            {collapsed && (
              <span
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50"
                role="tooltip"
              >
                Sign out
              </span>
            )}
          </button>
        </div>

        {/* Floating collapse toggle */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-50"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </aside>
    </>
  )
}
