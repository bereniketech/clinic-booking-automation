'use client'

import Link from 'next/link'

const SECTIONS = [
  { href: '/settings/services', label: 'Services', description: 'Manage clinic services and pricing' },
  { href: '/settings/staff', label: 'Staff', description: 'Invite and manage staff members' },
  { href: '/settings/hours', label: 'Working Hours', description: 'Set staff schedules and availability' },
  { href: '/settings/workflows', label: 'Workflows', description: 'Configure automation rules' },
]

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Settings</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            style={{
              display: 'block',
              padding: 20,
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{section.label}</h3>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
