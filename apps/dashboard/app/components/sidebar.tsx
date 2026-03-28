'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '../lib/supabase-browser'

const NAV_ITEMS = [
  { href: '/inbox', label: 'Inbox', roles: ['admin', 'provider', 'receptionist'] },
  { href: '/calendar', label: 'Calendar', roles: ['admin', 'provider', 'receptionist'] },
  { href: '/appointments', label: 'Appointments', roles: ['admin', 'provider', 'receptionist'] },
  { href: '/customers', label: 'Customers', roles: ['admin', 'provider', 'receptionist'] },
  { href: '/forms', label: 'Forms', roles: ['admin', 'provider', 'receptionist'] },
  { href: '/workflows', label: 'Workflows', roles: ['admin'] },
  { href: '/settings', label: 'Settings', roles: ['admin'] },
]

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav style={{
      width: 220,
      background: '#1a1a2e',
      color: '#fff',
      padding: '24px 0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '0 16px', marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Clinic</h2>
      </div>
      <div style={{ flex: 1 }}>
        {visibleItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '10px 16px',
              color: pathname === item.href || pathname?.startsWith(item.href + '/') ? '#fff' : '#a0a0b0',
              background: pathname === item.href || pathname?.startsWith(item.href + '/') ? '#2d2d44' : 'transparent',
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <button
        onClick={handleLogout}
        style={{
          margin: '0 16px',
          padding: '10px 16px',
          background: 'none',
          border: '1px solid #555',
          color: '#a0a0b0',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Sign Out
      </button>
    </nav>
  )
}
