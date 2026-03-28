'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../../lib/supabase-browser'

interface Service {
  id: string
  name: string
  duration_minutes: number
  buffer_minutes: number
  price: number
  active: boolean
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [token, setToken] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', durationMinutes: 30, bufferMinutes: 0, price: 0 })

  const supabase = createSupabaseBrowserClient()

  const fetchServices = useCallback(async (t: string) => {
    const res = await fetch('http://localhost:3001/api/v1/services', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setServices(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token)
        fetchServices(session.access_token)
      }
    })
  }, [supabase, fetchServices])

  const handleCreate = async () => {
    await fetch('http://localhost:3001/api/v1/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ name: '', durationMinutes: 30, bufferMinutes: 0, price: 0 })
    await fetchServices(token)
  }

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`http://localhost:3001/api/v1/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: !active }),
    })
    await fetchServices(token)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Services</h1>
        <button onClick={() => setShowForm(true)} style={btnPrimary}>Add Service</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Duration', 'Buffer', 'Price', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.duration_minutes} min</td>
                <td style={tdStyle}>{s.buffer_minutes} min</td>
                <td style={tdStyle}>${s.price}</td>
                <td style={tdStyle}>
                  <span style={{ color: s.active ? '#22c55e' : '#9ca3af' }}>{s.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => toggleActive(s.id, s.active)} style={btnSmall}>
                    {s.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {services.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No services yet</div>}
      </div>

      {showForm && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>New Service</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Duration (minutes)</label>
              <input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: +e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Buffer (minutes)</label>
              <input type="number" value={form.bufferMinutes} onChange={e => setForm({ ...form, bufferMinutes: +e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Price</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreate} style={btnPrimary}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '10px 12px', textAlign: 'left' as const, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }
const tdStyle = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 } as const
const inputStyle = { width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const }
const btnPrimary = { padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } as const
const btnSecondary = { padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' } as const
const btnSmall = { padding: '4px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' } as const
const modalOverlay = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modalContent = { background: '#fff', borderRadius: 12, padding: 24, width: 420 }
