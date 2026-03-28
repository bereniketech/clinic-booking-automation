'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase-browser'

interface Form {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
}

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([])
  const [token, setToken] = useState('')

  const supabase = createSupabaseBrowserClient()

  const fetchForms = useCallback(async (t: string) => {
    const res = await fetch('http://localhost:3001/api/v1/forms', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setForms(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token)
        fetchForms(session.access_token)
      }
    })
  }, [supabase, fetchForms])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Forms</h1>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Slug', 'Status', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forms.map(f => (
              <tr key={f.id}>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{f.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{f.slug}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: f.active ? '#22c55e' : '#9ca3af' }}>{f.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{new Date(f.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {forms.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No forms yet</div>}
      </div>
    </div>
  )
}
