import type { DbClient } from '@clinic/db'

export interface Slot {
  startsAt: string  // ISO 8601 datetime
  endsAt: string    // ISO 8601 datetime
}

export interface WorkingHours {
  id: string
  startMinutes: number   // Minutes from midnight (0-1440)
  endMinutes: number     // Minutes from midnight (0-1440)
}

export interface Service {
  id: string
  durationMinutes: number
  bufferMinutes: number
}

export interface Appointment {
  id: string
  startMinutes: number
  endMinutes: number
}

export interface Block {
  id: string
  startMinutes: number
  endMinutes: number
}

/**
 * Converts minutes from midnight to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/**
 * Converts HH:MM to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

/**
 * Converts ISO date and minutes from midnight to ISO datetime
 */
function minutesToDatetime(date: string, minutes: number): string {
  const time = minutesToTime(minutes)
  return `${date}T${time}:00Z`
}

/**
 * Gets the day of week (0-6) for an ISO date string
 */
function getDayOfWeek(date: string): number {
  const d = new Date(date)
  return d.getUTCDay()
}

/**
 * Gets working hours for a staff member on a specific date
 */
async function getWorkingHoursForDate(
  staffId: string,
  clinicId: string,
  date: string,
  db: DbClient,
): Promise<WorkingHours | null> {
  const dayOfWeek = getDayOfWeek(date)

  const { data, error } = await db
    .from('working_hours')
    .select('id, start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('user_id', staffId)
    .eq('day_of_week', dayOfWeek)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    startMinutes: timeToMinutes(data.start_time),
    endMinutes: timeToMinutes(data.end_time),
  }
}

/**
 * Gets service details
 */
async function getService(
  serviceId: string,
  clinicId: string,
  db: DbClient,
): Promise<Service | null> {
  const { data, error } = await db
    .from('services')
    .select('id, duration_minutes')
    .eq('clinic_id', clinicId)
    .eq('id', serviceId)
    .single()

  if (error || !data) return null

  const serviceRow = data as { id: string; duration_minutes: number }

  return {
    id: serviceRow.id,
    durationMinutes: serviceRow.duration_minutes,
    bufferMinutes: 0,
  }
}

/**
 * Gets appointments for a staff member on a specific date
 */
async function getAppointmentsForStaff(
  staffId: string,
  clinicId: string,
  date: string,
  db: DbClient,
): Promise<Appointment[]> {
  const dayStart = new Date(`${date}T00:00:00Z`)
  const dayEnd = new Date(`${date}T23:59:59Z`)

  const { data, error } = await db
    .from('appointments')
    .select('id, starts_at, ends_at')
    .eq('clinic_id', clinicId)
    .eq('staff_id', staffId)
    .eq('status', 'scheduled')
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  if (error || !data) return []

  return data.map((apt) => {
    const start = new Date(apt.starts_at)
    const end = new Date(apt.ends_at)
    const startOfDay = new Date(`${date}T00:00:00Z`)

    const startMinutes = Math.floor((start.getTime() - startOfDay.getTime()) / (1000 * 60))
    const endMinutes = Math.floor((end.getTime() - startOfDay.getTime()) / (1000 * 60))

    return {
      id: apt.id,
      startMinutes,
      endMinutes,
    }
  })
}

/**
 * Gets blocks for a staff member on a specific date
 */
async function getBlocksForStaff(
  staffId: string,
  clinicId: string,
  date: string,
  db: DbClient,
): Promise<Block[]> {
  const dayStart = new Date(`${date}T00:00:00Z`)
  const dayEnd = new Date(`${date}T23:59:59Z`)

  const { data, error } = await db
    .from('blocks')
    .select('id, starts_at, ends_at')
    .eq('clinic_id', clinicId)
    .eq('user_id', staffId)
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  if (error || !data) return []

  const blockRows = data as Array<{ id: string; starts_at: string; ends_at: string }>

  return blockRows.map((block) => {
    const start = new Date(block.starts_at)
    const end = new Date(block.ends_at)
    const startOfDay = new Date(`${date}T00:00:00Z`)

    const startMinutes = Math.floor((start.getTime() - startOfDay.getTime()) / (1000 * 60))
    const endMinutes = Math.floor((end.getTime() - startOfDay.getTime()) / (1000 * 60))

    return {
      id: block.id,
      startMinutes,
      endMinutes,
    }
  })
}

/**
 * Generates available slots for booking
 * 
 * Algorithm:
 * 1. Get working hours for the staff member on the date
 * 2. If no working hours, return empty list
 * 3. Get existing appointments for the staff member on the date
 * 4. Get blocks/holidays for the staff member on the date
 * 5. Walk through the working hours, checking each potential slot
 * 6. Skip slots that overlap with appointments or blocks
 * 7. Return available slots
 */
export async function getAvailableSlots(
  params: {
    clinicId: string
    serviceId: string
    staffId: string
    date: string  // YYYY-MM-DD
  },
  db: DbClient,
): Promise<Slot[]> {
  const { clinicId, serviceId, staffId, date } = params

  // Get service details
  const service = await getService(serviceId, clinicId, db)
  if (!service) return []

  // Get working hours for the staff member on this date
  const workingHours = await getWorkingHoursForDate(staffId, clinicId, date, db)
  if (!workingHours) return []

  // Get existing appointments and blocks
  const existingAppointments = await getAppointmentsForStaff(staffId, clinicId, date, db)
  const blocks = await getBlocksForStaff(staffId, clinicId, date, db)

  const slotDuration = service.durationMinutes + service.bufferMinutes
  const slots: Slot[] = []
  let cursor = workingHours.startMinutes

  while (cursor + service.durationMinutes <= workingHours.endMinutes) {
    const slotStart = cursor
    const slotEnd = cursor + slotDuration

    // Check for conflicts with appointments
    const hasAppointmentConflict = existingAppointments.some(
      (a) => a.startMinutes < slotEnd && a.endMinutes > slotStart,
    )

    // Check for conflicts with blocks
    const hasBlockConflict = blocks.some((b) => b.startMinutes < slotEnd && b.endMinutes > slotStart)

    // If no conflicts, add the slot
    if (!hasAppointmentConflict && !hasBlockConflict) {
      slots.push({
        startsAt: minutesToDatetime(date, cursor),
        endsAt: minutesToDatetime(date, cursor + service.durationMinutes),
      })
    }

    cursor += slotDuration
  }

  return slots
}

/**
 * Gets staff members who can provide a specific service
 */
export async function getStaffForService(
  serviceId: string,
  clinicId: string,
  db: DbClient,
): Promise<string[]> {
  const { data, error } = await db
    .from('staff_services')
    .select('user_id')
    .eq('clinic_id', clinicId)
    .eq('service_id', serviceId)

  if (error || !data) return []

  return data.map((row) => row.user_id)
}
