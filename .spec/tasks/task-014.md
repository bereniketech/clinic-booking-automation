---
task: 014
feature: clinic-booking-automation
status: pending
depends_on: [006, 012]
---

# Task 014: Dashboard — Calendar & Appointments

## Session Bootstrap
> Load these before reading anything else.

Skills: /build-website-web-app, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Build the Calendar and Appointments pages: a day/week calendar view showing booked slots, an appointments list with status filters, a new-booking flow (service → staff → date → available slot → confirm), and reschedule/cancel actions. All scheduling goes through the `apps/api` scheduling engine — no direct DB writes.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/dashboard/src/app/(dashboard)/calendar/page.tsx
// Calendar page — server component for initial data, client for interactivity
import { CalendarClient } from './CalendarClient'

export default async function CalendarPage() {
  // Pass today's date as default; CalendarClient fetches appointments by range
  return <CalendarClient defaultDate={new Date().toISOString().slice(0, 10)} />
}
```

```typescript
// apps/dashboard/src/app/(dashboard)/calendar/CalendarClient.tsx
'use client'
import { useState } from 'react'
import type { Appointment } from '@clinic/shared'

export function CalendarClient({ defaultDate }: { defaultDate: string }) {
  const [view, setView] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(defaultDate)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)

  // Load appointments when date/view changes
  useEffect(() => {
    const { start, end } = getDateRange(currentDate, view)
    fetch(`/api/appointments?from=${start}&to=${end}`)
      .then(r => r.json())
      .then(({ appointments }) => setAppointments(appointments))
  }, [currentDate, view])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex gap-2">
          <button onClick={() => setView('day')} className={view === 'day' ? 'font-bold' : ''}>Day</button>
          <button onClick={() => setView('week')} className={view === 'week' ? 'font-bold' : ''}>Week</button>
        </div>
        <button onClick={() => setShowBookingModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
          + New Booking
        </button>
      </div>

      {/* Calendar grid */}
      <CalendarGrid
        view={view}
        date={currentDate}
        appointments={appointments}
        onDateChange={setCurrentDate}
      />

      {/* New booking modal */}
      {showBookingModal && (
        <BookingModal
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => {
            setShowBookingModal(false)
            // Reload appointments
          }}
        />
      )}
    </div>
  )
}
```

```typescript
// Booking flow — multi-step modal
function BookingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'service' | 'staff' | 'slot' | 'confirm'>('service')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ startsAt: string }[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch available slots when service + staff + date are chosen
  useEffect(() => {
    if (selectedService && selectedStaff && selectedDate) {
      fetch(`/api/slots?serviceId=${selectedService}&staffId=${selectedStaff}&date=${selectedDate}`)
        .then(r => r.json())
        .then(({ slots }) => setSlots(slots))
    }
  }, [selectedService, selectedStaff, selectedDate])

  const confirm = async () => {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        serviceId: selectedService,
        staffId: selectedStaff,
        startsAt: selectedSlot,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error?.code === 'SLOT_CONFLICT' ? 'That slot was just booked. Please choose another.' : 'Booking failed.')
      return
    }
    onSuccess()
  }

  // Render steps: service selector → staff selector → date + slot picker → confirm
  // ... (component tree for each step)
  return <div className="modal">{/* step content */}</div>
}
```

```typescript
// Appointment list with status filters
// apps/dashboard/src/app/(dashboard)/appointments/page.tsx
import { AppointmentList } from './AppointmentList'

export default async function AppointmentsPage() {
  return <AppointmentList />
}

// Client component
function AppointmentList() {
  const [status, setStatus] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all')
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    const qs = status !== 'all' ? `?status=${status}` : ''
    fetch(`/api/appointments${qs}`)
      .then(r => r.json())
      .then(({ appointments }) => setAppointments(appointments))
  }, [status])

  return (
    <div>
      <div className="flex gap-2 p-4">
        {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={status === s ? 'font-bold underline' : ''}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Customer</th><th>Service</th><th>Staff</th><th>Time</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {appointments.map(appt => (
            <AppointmentRow key={appt.id} appointment={appt} onAction={loadAppointments} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AppointmentRow({ appointment, onAction }: { appointment: Appointment; onAction: () => void }) {
  const cancel = async () => {
    await fetch(`/api/appointments/${appointment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    onAction()
  }

  return (
    <tr>
      <td>{appointment.customer?.name}</td>
      <td>{appointment.service?.name}</td>
      <td>{appointment.staff?.name}</td>
      <td>{new Date(appointment.starts_at).toLocaleString()}</td>
      <td>{appointment.status}</td>
      <td>
        {appointment.status === 'scheduled' && (
          <>
            <button onClick={cancel} className="text-red-600 text-xs mr-2">Cancel</button>
            {/* Reschedule opens booking modal pre-filled */}
          </>
        )}
      </td>
    </tr>
  )
}
```

```typescript
// apps/dashboard/src/app/api/slots/route.ts
// Proxy to apps/api slot generation
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const res = await fetch(
    `${process.env.API_URL}/api/v1/slots?${searchParams.toString()}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )
  return NextResponse.json(await res.json())
}
```

### Key Patterns in Use
- **Multi-step booking modal:** Each step depends on the previous. Slots are only fetched when service + staff + date are all selected.
- **409 → user-friendly conflict error:** When `SLOT_CONFLICT` is returned from the API, show a clear message ("slot just booked") rather than a generic error.
- **Calendar grid is display-only:** The grid renders existing appointments from the API — it does not write to the DB. New bookings go through the modal which calls the API.
- **All API calls via Next.js proxy routes:** Browser calls `/api/appointments`, which the proxy route forwards to `apps/api` with the auth token.
- **Status filter is client-side UI state:** Changing the filter re-fetches from the API with a `?status=` query param.

### Architecture Decisions Affecting This Task
- Slot generation lives entirely in `apps/api` — dashboard only displays the returned slots
- The advisory lock in the Postgres function handles concurrent booking from multiple dashboard users
- Cancel flow in the API removes the BullMQ reminder job (task-007) — dashboard just calls `PATCH /appointments/:id` with `{ status: 'cancelled' }`

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-006 + task-012)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Build `CalendarGrid` component: day/week views, time slots on Y-axis, appointment blocks
2. Build `BookingModal` with 4-step flow (service → staff → date/slot → confirm)
3. Build `AppointmentList` with status filter tabs and per-row actions (cancel, reschedule)
4. Build `AppointmentRow` with reschedule flow (opens booking modal pre-filled with existing service/staff)
5. Implement Next.js proxy routes: `/api/appointments`, `/api/appointments/[id]`, `/api/slots`, `/api/services`, `/api/staff`
6. Handle `SLOT_CONFLICT` 409 response with clear user message in booking modal
7. Implement date navigation (prev/next day, prev/next week)
8. Write tests: slot conflict shows correct error message, cancel calls PATCH, slots fetched only when service+staff+date selected

_Requirements: 4.1–4.6, 9.2_
_Skills: /build-website-web-app — multi-step form, calendar UI; /code-writing-software-development — optimistic UI, conflict handling_

---

## Acceptance Criteria
- [ ] Calendar renders all appointments for clinic in day and week views
- [ ] Slot picker shows only available slots from `GET /api/v1/slots`
- [ ] Booking with a conflicting slot shows "slot just booked" message (409 → user message)
- [ ] Cancel action calls `PATCH /appointments/:id` with `{ status: 'cancelled' }`
- [ ] Reschedule opens pre-filled booking modal with new slot selection
- [ ] Appointment list filters correctly by status
- [ ] All API calls go through Next.js proxy routes with auth token
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
