---
task: 012
feature: clinic-booking-automation
status: pending
depends_on: [003]
---

# Task 012: Next.js dashboard — foundation & auth

## Session Bootstrap
> Load these before reading anything else.

Skills: /build-website-web-app, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Scaffold the `apps/dashboard` Next.js App Router application with Supabase Auth SSR session handling, a persistent sidebar layout, and role-based route guards. This is the foundation all subsequent dashboard tasks (013–015) build on.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/dashboard/src/lib/supabase/server.ts
// Server-side Supabase client using cookies (App Router)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}
```

```typescript
// apps/dashboard/src/middleware.ts
// Route protection via Supabase Auth session check
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) { response.cookies.set({ name, value, ...options }) },
        remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Redirect unauthenticated users to login
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth).*)'],
}
```

```typescript
// apps/dashboard/src/app/(dashboard)/layout.tsx
// Persistent sidebar layout for all authenticated routes
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Extract role from app_metadata (set by API on invite/registration)
  const role = user.app_metadata?.role ?? 'staff'
  const clinicId = user.app_metadata?.clinic_id

  return (
    <div className="flex h-screen">
      <Sidebar role={role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

```typescript
// apps/dashboard/src/components/Sidebar.tsx
// Navigation with role-based visibility
const navItems = [
  { label: 'Inbox',       href: '/inbox',       icon: 'MessageSquare', roles: ['admin', 'staff'] },
  { label: 'Calendar',    href: '/calendar',    icon: 'Calendar',      roles: ['admin', 'staff'] },
  { label: 'Appointments',href: '/appointments',icon: 'ClipboardList', roles: ['admin', 'staff'] },
  { label: 'CRM',         href: '/crm',         icon: 'Users',         roles: ['admin', 'staff'] },
  { label: 'Forms',       href: '/forms',       icon: 'FileText',      roles: ['admin', 'staff'] },
  { label: 'Workflows',   href: '/workflows',   icon: 'Zap',           roles: ['admin'] },
  { label: 'Settings',    href: '/settings',    icon: 'Settings',      roles: ['admin'] },
]

export default function Sidebar({ role }: { role: string }) {
  const visible = navItems.filter(item => item.roles.includes(role))
  return (
    <nav className="w-64 border-r bg-white flex flex-col">
      {/* clinic logo / name */}
      <div className="p-4 border-b font-semibold">Clinic OS</div>
      <ul className="flex-1 p-2 space-y-1">
        {visible.map(item => (
          <li key={item.href}>
            <a href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-sm">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

```typescript
// apps/dashboard/src/app/login/page.tsx
// Login page — Supabase Auth email + password
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/inbox')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-80 space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" className="w-full border rounded px-3 py-2" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" className="w-full border rounded px-3 py-2" required />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Sign in
        </button>
      </form>
    </div>
  )
}
```

### Key Patterns in Use
- **`@supabase/ssr` for App Router:** Use `createServerClient` (server components, middleware) and `createBrowserClient` (client components). Never use `createClient` from `@supabase/supabase-js` directly in App Router.
- **Role from `app_metadata`:** Role and `clinic_id` are in JWT `app_metadata` — read via `user.app_metadata` in server components. Never trust client-supplied role.
- **Middleware refreshes session:** The middleware pattern above keeps the session cookie fresh. Without it, sessions expire silently.
- **Route group `(dashboard)`:** All authenticated pages live under `app/(dashboard)/` with the shared layout. Login lives outside at `app/login/`.

### Architecture Decisions Affecting This Task
- Supabase Auth is the single auth layer — no separate API auth needed for dashboard routes
- `clinic_id` and `role` come from JWT `app_metadata` set by the API at invite time (task-003)
- Dashboard calls the `apps/api` REST endpoints for all data — it never queries Supabase DB directly except for auth session management

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-003)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Scaffold `apps/dashboard` with `create-next-app` (App Router, TypeScript, Tailwind)
2. Install `@supabase/ssr`, `@supabase/supabase-js`
3. Create `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` helpers
4. Implement `src/middleware.ts` for session refresh + unauthenticated redirect
5. Create `app/(dashboard)/layout.tsx` with server-side user check and `Sidebar`
6. Implement `Sidebar` component with role-filtered nav items
7. Implement `app/login/page.tsx` login form
8. Implement `app/auth/callback/route.ts` for invite-accept / OAuth callback
9. Add placeholder pages for all 7 nav routes (inbox, calendar, appointments, crm, forms, workflows, settings) — just `<h1>` stubs
10. Write tests: middleware redirects unauthenticated, authenticated user sees sidebar, admin sees Workflows/Settings, staff does not

_Requirements: 9.4, 9.5_
_Skills: /build-website-web-app — Next.js App Router, Supabase SSR auth; /code-writing-software-development — middleware, route guards_

---

## Acceptance Criteria
- [ ] Unauthenticated request to `/inbox` redirects to `/login`
- [ ] After login, session persists across page refresh
- [ ] Admin role: all 7 nav items visible
- [ ] Staff role: Workflows and Settings nav items hidden
- [ ] `clinic_id` extracted from JWT `app_metadata` and available in server components
- [ ] Auth callback route handles invite-accept flow
- [ ] All placeholder routes render without error
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
