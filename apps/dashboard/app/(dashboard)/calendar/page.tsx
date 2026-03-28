'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase-browser'

interface Appointment {
  id: string
  customer_id: string
  service_id: string
  staff_id: string
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
}

type ViewMode = 'day' | 'week'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const start = addDays(date, -day)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7am - 6pm

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [token, setToken] = useState('')

  const supabase = createSupabaseBrowserClient()

  const fetchAppointments = useCallback(async (accessToken: string) => {
    const startDate = viewMode === 'day'
      ? formatDate(currentDate)
      : formatDate(getWeekDates(currentDate)[0])
    const endDate = viewMode === 'day'
      ? formatDate(addDays(currentDate, 1))
      : formatDate(addDays(getWeekDates(currentDate)[6], 1))

    const res = await fetch(
      `http://localhost:3001/api/v1/appointments?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (res.ok) setAppointments(await res.json())
  }, [currentDate, viewMode])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setToken(session.access_token)
        await fetchAppointments(session.access_token)
      }
    }
    init()
  }, [supabase, fetchAppointments])

  useEffect(() => {
    if (token) fetchAppointments(token)
  }, [token, fetchAppointments])

  const getAppointmentsForDateHour = (date: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.starts_at)
      return formatDate(aptDate) === formatDate(date) && aptDate.getUTCHours() === hour
    })
  }

  const statusColor: Record<string, string> = {
    scheduled: '#3b82f6',
    completed: '#22c55e',
    cancelled: '#ef4444',
    no_show: '#f59e0b',
  }

  const dates = viewMode === 'week' ? getWeekDates(currentDate) : [currentDate]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Calendar</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? -7 : -1))} style={navBtnStyle}>&lt;</button>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(currentDate)}</span>
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 1))} style={navBtnStyle}>&gt;</button>
          <button onClick={() => setCurrentDate(new Date())} style={{ ...navBtnStyle, marginLeft: 8 }}>Today</button>
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as ViewMode)}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 60, padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12 }}>Time</th>
              {dates.map(date => (
                <th key={formatDate(date)} style={{ padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12 }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td style={{ padding: '4px 8px', fontSize: 12, color: '#6b7280', borderRight: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                  {hour}:00
                </td>
                {dates.map(date => {
                  const apts = getAppointmentsForDateHour(date, hour)
                  return (
                    <td
                      key={`${formatDate(date)}-${hour}`}
                      style={{ padding: 2, borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', verticalAlign: 'top', minHeight: 40 }}
                    >
                      {apts.map(apt => (
                        <div
                          key={apt.id}
                          style={{
                            background: statusColor[apt.status] ?? '#e5e7eb',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            marginBottom: 2,
                          }}
                        >
                          {new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' '}{apt.status}
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const navBtnStyle = { padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' } as const
