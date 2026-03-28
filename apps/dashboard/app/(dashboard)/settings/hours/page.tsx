'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../../lib/supabase-browser'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface WorkingHoursEntry {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export default function WorkingHoursPage() {
  const [staffId, setStaffId] = useState('')
  const [hours, setHours] = useState<WorkingHoursEntry[]>([])
  const [token, setToken] = useState('')
  const [localHours, setLocalHours] = useState<Record<number, { start: string; end: string }>>({})
  const [saving, setSaving] = useState(false)

  const supabase = createSupabaseBrowserClient()

  const fetchHours = useCallback(async (userId: string, t: string) => {
    const res = await fetch(`http://localhost:3001/api/v1/staff/${userId}/working-hours`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) {
      const data = await res.json()
      setHours(data)
      const local: Record<number, { start: string; end: string }> = {}
      data.forEach((h: WorkingHoursEntry) => {
        local[h.day_of_week] = { start: h.start_time, end: h.end_time }
      })
      setLocalHours(local)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token)
      }
    })
  }, [supabase])

  const handleLoad = () => {
    if (staffId && token) fetchHours(staffId, token)
  }

  const handleSave = async () => {
    setSaving(true)
    for (const [dayStr, times] of Object.entries(localHours)) {
      const day = parseInt(dayStr)
      if (times.start && times.end) {
        await fetch(`http://localhost:3001/api/v1/staff/${staffId}/working-hours/${day}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ startTime: times.start, endTime: times.end }),
        })
      }
    }
    setSaving(false)
    await fetchHours(staffId, token)
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Working Hours</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={staffId}
          onChange={e => setStaffId(e.target.value)}
          placeholder="Enter Staff ID"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, width: 300 }}
        />
        <button onClick={handleLoad} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Load</button>
      </div>

      {staffId && (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
          {DAYS.map((day, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 100, fontSize: 14, fontWeight: 500 }}>{day}</span>
              <input
                type="time"
                value={localHours[i]?.start ?? ''}
                onChange={e => setLocalHours({ ...localHours, [i]: { ...localHours[i], start: e.target.value, end: localHours[i]?.end ?? '' } })}
                style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4 }}
              />
              <span>to</span>
              <input
                type="time"
                value={localHours[i]?.end ?? ''}
                onChange={e => setLocalHours({ ...localHours, [i]: { ...localHours[i], start: localHours[i]?.start ?? '', end: e.target.value } })}
                style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>
          ))}
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}
    </div>
  )
}
