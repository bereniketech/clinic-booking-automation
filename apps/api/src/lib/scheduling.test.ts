import { describe, it, expect, vi } from 'vitest'
import { getAvailableSlots, getStaffForService } from './scheduling'

// Helper to create a chainable mock that returns data at the terminal call
function chainMock(terminalFn: string, result: unknown) {
  const handler: Record<string, unknown> = {}
  const proxy = new Proxy(handler, {
    get(_target, prop: string) {
      if (prop === terminalFn) {
        return vi.fn(async () => result)
      }
      // All other methods return a new proxy that continues the chain
      return vi.fn(() => proxy)
    },
  })
  return proxy
}

function createMockDb(options: {
  service?: { id: string; duration_minutes: number } | null
  workingHours?: { id: string; start_time: string; end_time: string } | null
  appointments?: Array<{ id: string; starts_at: string; ends_at: string }>
  blocks?: Array<{ id: string; starts_at: string; ends_at: string }>
  staffRows?: Array<{ user_id: string }>
}) {
  const from = vi.fn((table: string) => {
    if (table === 'services') {
      return chainMock('single', {
        data: options.service ?? { id: 'svc-1', duration_minutes: 30 },
        error: options.service === null ? { message: 'not found' } : null,
      })
    }
    if (table === 'working_hours') {
      return chainMock('single', {
        data: options.workingHours ?? { id: 'wh-1', start_time: '09:00', end_time: '17:00' },
        error: options.workingHours === null ? { message: 'not found' } : null,
      })
    }
    if (table === 'appointments') {
      // Terminal for appointments is the last .lte() call (not single)
      return chainMock('lte', {
        data: options.appointments ?? [],
        error: null,
      })
    }
    if (table === 'blocks') {
      return chainMock('lte', {
        data: options.blocks ?? [],
        error: null,
      })
    }
    if (table === 'staff_services') {
      // staff_services chain ends with the second .eq()
      // We need the last eq to resolve
      let eqCount = 0
      const proxy: Record<string, unknown> = {}
      const p = new Proxy(proxy, {
        get(_target, prop: string) {
          if (prop === 'eq') {
            return vi.fn(() => {
              eqCount++
              if (eqCount >= 2) {
                return Promise.resolve({
                  data: options.staffRows ?? [],
                  error: null,
                })
              }
              return p
            })
          }
          return vi.fn(() => p)
        },
      })
      return p
    }
    return chainMock('single', { data: null, error: null })
  })

  return { from } as unknown as Parameters<typeof getAvailableSlots>[1]
}

describe('Scheduling - Slot Generation', () => {
  it('returns empty array if service not found', async () => {
    const db = createMockDb({ service: null })
    const slots = await getAvailableSlots(
      { clinicId: 'c1', serviceId: 's1', staffId: 'st1', date: '2024-03-25' },
      db,
    )
    expect(slots).toEqual([])
  })

  it('returns empty array if no working hours defined', async () => {
    const db = createMockDb({ workingHours: null })
    const slots = await getAvailableSlots(
      { clinicId: 'c1', serviceId: 's1', staffId: 'st1', date: '2024-03-25' },
      db,
    )
    expect(slots).toEqual([])
  })

  it('generates slots during working hours', async () => {
    const db = createMockDb({})
    const slots = await getAvailableSlots(
      { clinicId: 'c1', serviceId: 's1', staffId: 'st1', date: '2024-03-25' },
      db,
    )
    // 30-min service, 0 buffer, 09:00-17:00 = 480 min / 30 = 16 slots
    expect(slots.length).toBe(16)
    expect(slots[0].startsAt).toBe('2024-03-25T09:00:00Z')
    expect(slots[0].endsAt).toBe('2024-03-25T09:30:00Z')
  })

  it('excludes slots with conflicting appointments', async () => {
    const db = createMockDb({
      appointments: [
        { id: 'apt1', starts_at: '2024-03-25T10:00:00Z', ends_at: '2024-03-25T10:30:00Z' },
      ],
    })
    const slots = await getAvailableSlots(
      { clinicId: 'c1', serviceId: 's1', staffId: 'st1', date: '2024-03-25' },
      db,
    )
    const conflict = slots.some((s) => s.startsAt === '2024-03-25T10:00:00Z')
    expect(conflict).toBe(false)
    expect(slots.length).toBe(15) // one slot removed
  })

  it('excludes slots during blocks', async () => {
    const db = createMockDb({
      blocks: [
        { id: 'b1', starts_at: '2024-03-25T12:00:00Z', ends_at: '2024-03-25T13:00:00Z' },
      ],
    })
    const slots = await getAvailableSlots(
      { clinicId: 'c1', serviceId: 's1', staffId: 'st1', date: '2024-03-25' },
      db,
    )
    const blocked = slots.filter((s) => {
      const hour = parseInt(s.startsAt.split('T')[1].split(':')[0], 10)
      const min = parseInt(s.startsAt.split('T')[1].split(':')[1], 10)
      const startMin = hour * 60 + min
      return startMin >= 720 && startMin < 780
    })
    expect(blocked).toHaveLength(0)
  })
})

describe('Scheduling - Staff for Service', () => {
  it('returns staff assigned to service', async () => {
    const db = createMockDb({
      staffRows: [{ user_id: 'st1' }, { user_id: 'st2' }],
    })
    const staff = await getStaffForService('s1', 'c1', db)
    expect(staff).toHaveLength(2)
    expect(staff).toContain('st1')
  })

  it('returns empty array when no staff assigned', async () => {
    const db = createMockDb({ staffRows: [] })
    const staff = await getStaffForService('s1', 'c1', db)
    expect(staff).toEqual([])
  })
})
