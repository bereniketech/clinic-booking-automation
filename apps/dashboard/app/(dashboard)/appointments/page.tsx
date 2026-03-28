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
  created_at: string
}

interface Slot {
  startsAt: string
  endsAt: string
}

interface Service {
  id: string
  name: string
  duration_minutes: number
}

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [token, setToken] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [bookingError, setBookingError] = useState('')

  const supabase = createSupabaseBrowserClient()

  const fetchAppointments = useCallback(async (accessToken: string) => {
    let url = 'http://localhost:3001/api/v1/appointments'
    if (statusFilter !== 'all') url += `?status=${statusFilter}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.ok) setAppointments(await res.json())
  }, [statusFilter])

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

  const fetchServices = async () => {
    const res = await fetch('http://localhost:3001/api/v1/services', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setServices(await res.json())
  }

  const fetchSlots = async () => {
    if (!selectedService || !selectedStaff || !selectedDate) return
    const res = await fetch(
      `http://localhost:3001/api/v1/slots?serviceId=${selectedService}&staffId=${selectedStaff}&date=${selectedDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.ok) setSlots(await res.json())
  }

  useEffect(() => { fetchSlots() }, [selectedService, selectedStaff, selectedDate])

  const handleBook = async () => {
    if (!selectedSlot || !customerId) return
    setBookingError('')
    const res = await fetch('http://localhost:3001/api/v1/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customerId,
        serviceId: selectedService,
        staffId: selectedStaff,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
      }),
    })
    if (res.status === 409) {
      setBookingError('This slot was just booked by someone else. Please select another.')
      setSlots(slots.filter(s => s.startsAt !== selectedSlot.startsAt))
      setSelectedSlot(null)
      return
    }
    if (!res.ok) {
      setBookingError('Failed to book appointment')
      return
    }
    setShowBooking(false)
    setSelectedSlot(null)
    await fetchAppointments(token)
  }

  const handleCancel = async (id: string) => {
    await fetch(`http://localhost:3001/api/v1/appointments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchAppointments(token)
  }

  const statusColors: Record<string, string> = {
    scheduled: '#3b82f6', completed: '#22c55e', cancelled: '#ef4444', no_show: '#f59e0b',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Appointments</h1>
        <button
          onClick={() => { setShowBooking(true); fetchServices() }}
          style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          New Booking
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'scheduled', 'completed', 'cancelled', 'no_show'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1px solid #d1d5db',
              background: statusFilter === s ? '#3b82f6' : '#fff',
              color: statusFilter === s ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date/Time', 'Status', 'Service', 'Staff', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.map(apt => (
              <tr key={apt.id}>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>
                  {new Date(apt.starts_at).toLocaleString()}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: statusColors[apt.status] ?? '#e5e7eb',
                    color: '#fff',
                    fontSize: 12,
                  }}>{apt.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{apt.service_id}</td>
                <td style={{ padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{apt.staff_id}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  {apt.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(apt.id)}
                      style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #ef4444', color: '#ef4444', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {appointments.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No appointments found</div>
        )}
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>New Booking</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Customer ID</label>
              <input value={customerId} onChange={e => setCustomerId(e.target.value)} style={inputStyle} placeholder="Customer UUID" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Service</label>
              <select value={selectedService} onChange={e => setSelectedService(e.target.value)} style={inputStyle}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min)</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Staff ID</label>
              <input value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={inputStyle} placeholder="Staff UUID" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
            </div>

            {slots.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Available Slots</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {slots.map(slot => (
                    <button
                      key={slot.startsAt}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: selectedSlot?.startsAt === slot.startsAt ? '#3b82f6' : '#fff',
                        color: selectedSlot?.startsAt === slot.startsAt ? '#fff' : '#374151',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {new Date(slot.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bookingError && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>{bookingError}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBooking(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleBook}
                disabled={!selectedSlot || !customerId}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: !selectedSlot || !customerId ? 0.5 : 1 }}
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' } as const
const inputStyle = { width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const }
