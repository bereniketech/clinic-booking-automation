'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase-browser'

interface Customer {
  id: string
  name: string | null
  phone: string
  tags: string[]
  created_at: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [token, setToken] = useState('')
  const [total, setTotal] = useState(0)

  const supabase = createSupabaseBrowserClient()

  const fetchCustomers = useCallback(async (t: string) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (tagFilter) params.set('tag', tagFilter)
    const res = await fetch(`http://localhost:3001/api/v1/customers?${params}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) {
      const data = await res.json()
      setCustomers(data.customers ?? [])
      setTotal(data.total ?? 0)
    }
  }, [search, tagFilter])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token)
        fetchCustomers(session.access_token)
      }
    })
  }, [supabase, fetchCustomers])

  useEffect(() => { if (token) fetchCustomers(token) }, [token, fetchCustomers])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Customers ({total})</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..." style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
        <input value={tagFilter} onChange={e => setTagFilter(e.target.value)} placeholder="Filter by tag..." style={{ width: 200, padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
      </div>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Phone', 'Tags', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{c.name ?? '-'}</td>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{c.phone}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  {c.tags?.map(t => (
                    <span key={t} style={{ display: 'inline-block', padding: '2px 8px', marginRight: 4, background: '#eff6ff', color: '#3b82f6', borderRadius: 12, fontSize: 12 }}>{t}</span>
                  ))}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No customers found</div>}
      </div>
    </div>
  )
}
