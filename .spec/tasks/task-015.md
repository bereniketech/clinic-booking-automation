---
task: 015
feature: clinic-booking-automation
status: pending
depends_on: [006, 008, 012]
---

# Task 015: Dashboard — Settings (services, staff, working hours, workflows)

## Session Bootstrap
> Load these before reading anything else.

Skills: /build-website-web-app, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Build the Settings section: services CRUD, staff management (invite / deactivate / role), per-staff working hours editor, holiday/block management, and the workflow builder UI (trigger → conditions → actions). All settings writes go through `apps/api`. Settings routes are admin-only.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/dashboard/src/app/(dashboard)/settings/layout.tsx
// Settings sub-navigation (admin only — middleware + layout guard)
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/inbox')

  const tabs = [
    { label: 'Services',      href: '/settings/services' },
    { label: 'Staff',         href: '/settings/staff' },
    { label: 'Working Hours', href: '/settings/working-hours' },
    { label: 'Holidays',      href: '/settings/holidays' },
    { label: 'Workflows',     href: '/settings/workflows' },
  ]

  return (
    <div className="flex h-full">
      <nav className="w-48 border-r p-4 space-y-1">
        {tabs.map(t => <a key={t.href} href={t.href} className="block py-2 text-sm hover:underline">{t.label}</a>)}
      </nav>
      <div className="flex-1 p-6 overflow-auto">{children}</div>
    </div>
  )
}
```

```typescript
// Services CRUD page
// apps/dashboard/src/app/(dashboard)/settings/services/page.tsx
'use client'
import { useEffect, useState } from 'react'

interface Service {
  id: string
  name: string
  duration_minutes: number
  buffer_minutes: number
  price: number
  category: string
  staff_ids: string[]
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  useEffect(() => { loadServices() }, [])

  const loadServices = () =>
    fetch('/api/services').then(r => r.json()).then(({ services }) => setServices(services))

  const deleteService = async (id: string) => {
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    loadServices()
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-semibold">Services</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
          + Add Service
        </button>
      </div>
      <table className="w-full text-sm border rounded">
        <thead className="bg-gray-50">
          <tr><th className="p-3 text-left">Name</th><th>Duration</th><th>Buffer</th><th>Price</th><th>Staff</th><th></th></tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.id} className="border-t">
              <td className="p-3">{s.name}</td>
              <td className="p-3">{s.duration_minutes}m</td>
              <td className="p-3">{s.buffer_minutes}m</td>
              <td className="p-3">${s.price}</td>
              <td className="p-3">{s.staff_ids.length} staff</td>
              <td className="p-3 space-x-2">
                <button onClick={() => { setEditing(s); setShowForm(true) }} className="text-blue-600 text-xs">Edit</button>
                <button onClick={() => deleteService(s.id)} className="text-red-600 text-xs">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showForm && <ServiceForm service={editing} onClose={() => setShowForm(false)} onSaved={loadServices} />}
    </div>
  )
}
```

```typescript
// Working hours editor — per staff, per day
// apps/dashboard/src/app/(dashboard)/settings/working-hours/page.tsx
'use client'
import { useEffect, useState } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface DayHours {
  day: number        // 0 = Monday
  start: string      // 'HH:MM'
  end: string
  enabled: boolean
}

export default function WorkingHoursPage() {
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [hours, setHours] = useState<DayHours[]>([])

  useEffect(() => {
    fetch('/api/staff').then(r => r.json()).then(({ staff }) => {
      setStaff(staff)
      if (staff.length > 0) setSelectedStaffId(staff[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedStaffId) {
      fetch(`/api/staff/${selectedStaffId}/working-hours`)
        .then(r => r.json())
        .then(({ hours }) => setHours(hours))
    }
  }, [selectedStaffId])

  const saveHours = async () => {
    await fetch(`/api/staff/${selectedStaffId}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    })
  }

  const updateDay = (day: number, patch: Partial<DayHours>) => {
    setHours(prev => prev.map(h => h.day === day ? { ...h, ...patch } : h))
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Working Hours</h2>
      <select value={selectedStaffId ?? ''} onChange={e => setSelectedStaffId(e.target.value)}
        className="border rounded px-3 py-2 mb-4 text-sm">
        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="space-y-2">
        {DAYS.map((label, idx) => {
          const day = hours.find(h => h.day === idx)
          return (
            <div key={idx} className="flex items-center gap-4 text-sm">
              <input type="checkbox" checked={day?.enabled ?? false}
                onChange={e => updateDay(idx, { enabled: e.target.checked })} />
              <span className="w-28">{label}</span>
              <input type="time" value={day?.start ?? '09:00'} disabled={!day?.enabled}
                onChange={e => updateDay(idx, { start: e.target.value })} />
              <span>–</span>
              <input type="time" value={day?.end ?? '17:00'} disabled={!day?.enabled}
                onChange={e => updateDay(idx, { end: e.target.value })} />
            </div>
          )
        })}
      </div>
      <button onClick={saveHours} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm">
        Save
      </button>
    </div>
  )
}
```

```typescript
// Workflow builder — trigger + conditions + actions
// apps/dashboard/src/app/(dashboard)/settings/workflows/WorkflowBuilder.tsx
'use client'
import { useState } from 'react'

const TRIGGER_OPTIONS = [
  { value: 'message.received',      label: 'Message received' },
  { value: 'appointment.created',   label: 'Appointment created' },
  { value: 'appointment.cancelled', label: 'Appointment cancelled' },
  { value: 'form.submitted',        label: 'Form submitted' },
]

const CONDITION_FIELDS = [
  { value: 'message.content',       label: 'Message content' },
  { value: 'customer.tag',          label: 'Customer tag' },
  { value: 'appointment.service',   label: 'Appointment service' },
  { value: 'appointment.status',    label: 'Appointment status' },
]

const OPERATORS = ['eq', 'neq', 'contains', 'not_contains']

const ACTION_TYPES = [
  { value: 'send_whatsapp', label: 'Send WhatsApp message' },
  { value: 'add_tag',       label: 'Add tag to customer' },
  { value: 'assign_staff',  label: 'Assign staff' },
  { value: 'trigger_workflow', label: 'Trigger another workflow' },
]

export function WorkflowBuilder({ workflow, onSave }: {
  workflow?: { id: string; name: string; trigger_type: string; conditions: any[]; actions: any[]; active: boolean }
  onSave: () => void
}) {
  const [name, setName] = useState(workflow?.name ?? '')
  const [trigger, setTrigger] = useState(workflow?.trigger_type ?? 'message.received')
  const [conditions, setConditions] = useState(workflow?.conditions ?? [])
  const [actions, setActions] = useState(workflow?.actions ?? [])

  const addCondition = () =>
    setConditions(prev => [...prev, { field: 'message.content', operator: 'contains', value: '' }])

  const addAction = () =>
    setActions(prev => [...prev, { type: 'send_whatsapp', params: {} }])

  const save = async () => {
    const method = workflow ? 'PATCH' : 'POST'
    const url = workflow ? `/api/workflows/${workflow.id}` : '/api/workflows'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, trigger_type: trigger, conditions, actions }),
    })
    onSave()
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Workflow name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Trigger</label>
        <select value={trigger} onChange={e => setTrigger(e.target.value)} className="border rounded px-3 py-2 text-sm">
          {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Conditions (all must match)</span>
          <button onClick={addCondition} className="text-blue-600 text-xs">+ Add</button>
        </div>
        {conditions.map((cond, i) => (
          <ConditionRow key={i} condition={cond} onChange={c => setConditions(prev => prev.map((x, j) => j === i ? c : x))} onRemove={() => setConditions(prev => prev.filter((_, j) => j !== i))} />
        ))}
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Actions (executed in order)</span>
          <button onClick={addAction} className="text-blue-600 text-xs">+ Add</button>
        </div>
        {actions.map((action, i) => (
          <ActionRow key={i} action={action} onChange={a => setActions(prev => prev.map((x, j) => j === i ? a : x))} onRemove={() => setActions(prev => prev.filter((_, j) => j !== i))} />
        ))}
      </div>
      <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save Workflow</button>
    </div>
  )
}
```

### Key Patterns in Use
- **Settings layout enforces admin role server-side:** The `SettingsLayout` server component checks `app_metadata.role` and redirects non-admins. This is defense-in-depth on top of the middleware.
- **Working hours editor is optimistic:** Changes are held in local state; `PUT /working-hours` is called only on "Save" click.
- **Workflow builder stores conditions/actions as arrays of plain objects:** The UI produces the same shape as the `WorkflowCondition[]` and `WorkflowAction[]` types from task-008. No transformation needed before sending to the API.
- **Toggle active/inactive:** Workflows list page has an on/off toggle that calls `PATCH /api/v1/workflows/:id/toggle`. This is a separate endpoint from the full update.
- **Service with no staff → not bookable:** When saving a service, the staff assignment multi-select sets `staff_ids`. If empty, the service appears in the list but the slot generation endpoint returns `[]`.

### Architecture Decisions Affecting This Task
- All write operations go through `apps/api` — no direct Supabase mutations from the dashboard
- Working hours changes take effect immediately for the next slot generation call (no cache)
- Workflow conditions and actions are stored as JSONB in the API — the builder UI is just a visual editor for that JSON

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-006 + task-008 + task-012)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Build `SettingsLayout` with admin-only guard and sub-navigation tabs
2. Build `ServicesPage`: list table + `ServiceForm` modal (name, duration, buffer, price, staff multi-select)
3. Build `StaffPage`: list table + invite form (`POST /api/staff/invite`) + role selector + deactivate button
4. Build `WorkingHoursPage`: staff selector + per-day enabled/start/end editor + save
5. Build `HolidaysPage`: date range picker list + add/remove (`GET/POST/DELETE /api/clinics/blocks`)
6. Build `WorkflowsPage`: list of workflows with active toggle + `WorkflowBuilder` modal for create/edit
7. Build `WorkflowBuilder` component: trigger dropdown, condition rows, action rows with type-specific param inputs
8. Implement Next.js proxy routes for all settings endpoints: `/api/services`, `/api/staff`, `/api/staff/[id]/working-hours`, `/api/clinics/blocks`, `/api/workflows`, `/api/workflows/[id]`, `/api/workflows/[id]/toggle`
9. Write tests: non-admin redirect, service save calls POST/PATCH, workflow toggle calls correct endpoint, working hours save calls PUT

_Requirements: 2.1–2.4, 3.1–3.5, 6.1, 9.5_
_Skills: /build-website-web-app — forms, CRUD UI, conditional rendering; /code-writing-software-development — admin-only guards, multi-step forms_

---

## Acceptance Criteria
- [ ] Non-admin user accessing `/settings/*` is redirected to `/inbox`
- [ ] Service with no assigned staff: slot generation returns empty array (confirmed via calendar)
- [ ] Working hours change immediately reflected in next slot generation call
- [ ] Staff invite sends `POST /api/v1/staff/invite` and pending user appears in staff list
- [ ] Workflow active toggle calls `PATCH /workflows/:id/toggle` and reflects immediately in list
- [ ] Workflow builder saves correct JSON shape matching `WorkflowCondition[]` + `WorkflowAction[]`
- [ ] Holiday/block added via UI appears in calendar as blocked slot
- [ ] All proxy routes correctly forward auth token to `apps/api`
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
