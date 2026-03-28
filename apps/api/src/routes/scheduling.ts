import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { getAvailableSlots } from '../lib/scheduling.js'

type DbError = {
  message: string
  code?: string
}

type DbResult = {
  data: unknown
  error: DbError | null
}

type LooseQuery = {
  select: (columns: string) => LooseQuery
  insert: (values: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (values: unknown, options?: unknown) => LooseQuery
  delete: () => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  gte: (column: string, value: unknown) => LooseQuery
  lte: (column: string, value: unknown) => LooseQuery
  order: (column: string, options: { ascending: boolean }) => Promise<DbResult>
  single: () => Promise<DbResult>
}

type LooseDb = {
  from: (table: string) => LooseQuery
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<DbResult>
}

/**
 * Creates the scheduling router
 * - Services CRUD: GET, POST, PATCH
 * - Staff assignment: POST /services/:id/staff
 * - Working hours: GET, PUT
 * - Blocks/holidays: GET, POST, DELETE
 * - Slots query: GET /slots
 * - Appointments: GET, POST, PATCH, DELETE
 */
export function createSchedulingRouter(db: SupabaseClient<Database>): Router {
  const router = Router()
  const looseDb = db as unknown as LooseDb

  // ========================================================================
  // SERVICES CRUD
  // ========================================================================

  /**
   * GET /api/v1/services
   * List all services for the clinic
   */
  router.get('/services', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { data, error } = await db
      .from('services')
      .select('id, name, duration_minutes, buffer_minutes, price, active, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(200).json(data ?? [])
  }) as RequestHandler)

  /**
   * POST /api/v1/services
   * Create a new service
   */
  router.post('/services', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { name, durationMinutes, bufferMinutes, price } = req.body as {
      name?: string
      durationMinutes?: number
      bufferMinutes?: number
      price?: number
    }

    if (!name || durationMinutes == null) {
      res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'name and durationMinutes are required' },
      })
      return
    }

    const { data, error } = await db
      .from('services')
      .insert({
        clinic_id: clinicId,
        name,
        duration_minutes: durationMinutes,
        buffer_minutes: bufferMinutes ?? 0,
        price: price ?? 0,
        active: true,
      })
      .select('id, name, duration_minutes, buffer_minutes, price, active, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(201).json(data)
  }) as RequestHandler)

  /**
   * PATCH /api/v1/services/:id
   * Update a service
   */
  router.patch('/services/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { name, durationMinutes, bufferMinutes, price, active } = req.body as {
      name?: string
      durationMinutes?: number
      bufferMinutes?: number
      price?: number
      active?: boolean
    }

    const updates: Record<string, unknown> = {}
    if (name != null) updates.name = name
    if (durationMinutes != null) updates.duration_minutes = durationMinutes
    if (bufferMinutes != null) updates.buffer_minutes = bufferMinutes
    if (price != null) updates.price = price
    if (active != null) updates.active = active

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields to update' } })
      return
    }

    const { data, error } = await db
      .from('services')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .select('id, name, duration_minutes, buffer_minutes, price, active, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    if (!data) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } })
      return
    }

    res.status(200).json(data)
  }) as RequestHandler)

  /**
   * POST /api/v1/services/:id/staff
   * Assign staff to a service
   */
  router.post('/services/:id/staff', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const serviceId = String(req.params.id)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { userId } = req.body as { userId?: string }
    if (!userId) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'userId is required' } })
      return
    }

    // Check if service exists
    const { data: service, error: serviceError } = await db
      .from('services')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      res.status(404).json({ error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' } })
      return
    }

    // Assign staff to service
    const { data, error } = await db
      .from('staff_services')
      .insert({ clinic_id: clinicId, user_id: userId, service_id: serviceId })
      .select('id, user_id, service_id, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        res.status(409).json({
          error: { code: 'ALREADY_ASSIGNED', message: 'Staff is already assigned to this service' },
        })
        return
      }
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(201).json(data)
  }) as RequestHandler)

  // ========================================================================
  // WORKING HOURS CRUD
  // ========================================================================

  /**
   * GET /api/v1/staff/:userId/working-hours
   * Get working hours for a staff member
   */
  router.get('/staff/:userId/working-hours', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const userId = String(req.params.userId)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { data, error } = await db
      .from('working_hours')
      .select('id, day_of_week, start_time, end_time, created_at')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true })

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(200).json(data ?? [])
  }) as RequestHandler)

  /**
   * PUT /api/v1/staff/:userId/working-hours/:dayOfWeek
   * Set or update working hours for a specific day
   */
  router.put('/staff/:userId/working-hours/:dayOfWeek', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const userId = String(req.params.userId)
    const dayOfWeek = String(req.params.dayOfWeek)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const day = parseInt(dayOfWeek, 10)
    if (Number.isNaN(day) || day < 0 || day > 6) {
      res.status(400).json({
        error: { code: 'INVALID_DAY', message: 'dayOfWeek must be between 0 and 6' },
      })
      return
    }

    const { startTime, endTime } = req.body as { startTime?: string; endTime?: string }
    if (!startTime || !endTime) {
      res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'startTime and endTime are required' },
      })
      return
    }

    // Use upsert: insert or update if exists
    const { data, error } = await db
      .from('working_hours')
      .upsert(
        {
          clinic_id: clinicId,
          user_id: userId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
        },
        { onConflict: 'user_id,day_of_week' },
      )
      .select('id, day_of_week, start_time, end_time, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(200).json(data)
  }) as RequestHandler)

  // ========================================================================
  // BLOCKS / HOLIDAYS CRUD
  // ========================================================================

  /**
   * GET /api/v1/clinics/blocks
   * List blocks for the clinic
   */
  router.get('/clinics/blocks', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { userId, startDate, endDate } = req.query as {
      userId?: string
      startDate?: string
      endDate?: string
    }

    let query = db
      .from('blocks')
      .select('id, user_id, title, starts_at, ends_at, created_at')
      .eq('clinic_id', clinicId)

    if (userId) query = query.eq('user_id', userId)
    if (startDate) query = query.gte('starts_at', startDate)
    if (endDate) query = query.lte('ends_at', endDate)

    const { data, error } = await query.order('starts_at', { ascending: true })

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(200).json(data ?? [])
  }) as RequestHandler)

  /**
   * POST /api/v1/clinics/blocks
   * Create a block/holiday
   */
  router.post('/clinics/blocks', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { userId, title, startsAt, endsAt } = req.body as {
      userId?: string
      title?: string
      startsAt?: string
      endsAt?: string
    }

    if (!userId || !title || !startsAt || !endsAt) {
      res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId, title, startsAt, and endsAt are required',
        },
      })
      return
    }

    const { data, error } = await db
      .from('blocks')
      .insert({
        clinic_id: clinicId,
        user_id: userId,
        title,
        starts_at: startsAt,
        ends_at: endsAt,
      } as any)
      .select('id, user_id, title, starts_at, ends_at, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(201).json(data)
  }) as RequestHandler)

  /**
   * DELETE /api/v1/clinics/blocks/:id
   * Delete a block
   */
  router.delete('/clinics/blocks/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { error } = await db
      .from('blocks')
      .delete()
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(204).send()
  }) as RequestHandler)

  // ========================================================================
  // SLOTS QUERY
  // ========================================================================

  /**
   * GET /api/v1/slots
   * Get available slots for booking
   * Query params: serviceId, staffId, date
   */
  router.get('/slots', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { serviceId, staffId, date } = req.query as {
      serviceId?: string
      staffId?: string
      date?: string
    }

    if (!serviceId || !staffId || !date) {
      res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'serviceId, staffId, and date are required' },
      })
      return
    }

    try {
      const slots = await getAvailableSlots(
        { clinicId, serviceId, staffId, date },
        db,
      )
      res.status(200).json(slots)
    } catch (err) {
      res.status(500).json({
        error: { code: 'SLOT_GENERATION_ERROR', message: (err as Error).message },
      })
    }
  }) as RequestHandler)

  // ========================================================================
  // APPOINTMENTS CRUD
  // ========================================================================

  /**
   * GET /api/v1/appointments
   * List appointments for the clinic
   */
  router.get('/appointments', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { customerId, staffId, status, startDate, endDate } = req.query as {
      customerId?: string
      staffId?: string
      status?: string
      startDate?: string
      endDate?: string
    }

    let query = db
      .from('appointments')
      .select(
        'id, customer_id, service_id, staff_id, starts_at, ends_at, status, notes, created_at',
      )
      .eq('clinic_id', clinicId)

    if (customerId) query = query.eq('customer_id', customerId)
    if (staffId) query = query.eq('staff_id', staffId)
    if (status) query = query.eq('status', status as 'scheduled' | 'completed' | 'cancelled' | 'no_show')
    if (startDate) query = query.gte('starts_at', startDate)
    if (endDate) query = query.lte('ends_at', endDate)

    const { data, error } = await query.order('starts_at', { ascending: true })

    if (error) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(200).json(data ?? [])
  }) as RequestHandler)

  /**
   * POST /api/v1/appointments
   * Create a new appointment with atomic booking
   */
  router.post('/appointments', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { customerId, serviceId, staffId, startsAt, endsAt } = req.body as {
      customerId?: string
      serviceId?: string
      staffId?: string
      startsAt?: string
      endsAt?: string
    }

    if (!customerId || !serviceId || !staffId || !startsAt || !endsAt) {
      res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'customerId, serviceId, staffId, startsAt, and endsAt are required',
        },
      })
      return
    }

    // Call the Postgres function for atomic booking
    const { data, error } = await looseDb.rpc('create_appointment_with_lock', {
      p_clinic_id: clinicId,
      p_customer_id: customerId,
      p_service_id: serviceId,
      p_staff_id: staffId,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    })

    if (error) {
      if (error.message.includes('SLOT_CONFLICT')) {
        res.status(409).json({
          error: { code: 'SLOT_CONFLICT', message: 'This time slot is not available' },
        })
        return
      }
      res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
      return
    }

    res.status(201).json(data)
  }) as RequestHandler)

  /**
   * PATCH /api/v1/appointments/:id
   * Update an appointment (reschedule or change notes)
   */
  router.patch('/appointments/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    const { startsAt, endsAt, notes } = req.body as {
      startsAt?: string
      endsAt?: string
      notes?: string
    }

    // If rescheduling (startsAt provided), we need to do an atomic swap
    if (startsAt && endsAt) {
      // Get the current appointment to extract staffId
      const { data: currentApt, error: fetchError } = await db
        .from('appointments')
        .select('staff_id, customer_id, service_id')
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .single()

      if (fetchError || !currentApt) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Appointment not found' } })
        return
      }

      // Cancel the old appointment
      const { error: cancelError } = await db
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('clinic_id', clinicId)
        .eq('id', id)

      if (cancelError) {
        res.status(500).json({ error: { code: 'DB_ERROR', message: cancelError.message } })
        return
      }

      // Try to book the new slot
      const { data: newApt, error: bookError } = await looseDb.rpc(
        'create_appointment_with_lock',
        {
          p_clinic_id: clinicId,
          p_customer_id: currentApt.customer_id,
          p_service_id: currentApt.service_id,
          p_staff_id: currentApt.staff_id,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        },
      )

      if (bookError) {
        // Restore the old appointment
        await db
          .from('appointments')
          .update({ status: 'scheduled' })
          .eq('clinic_id', clinicId)
          .eq('id', id)

        if (bookError.message.includes('SLOT_CONFLICT')) {
          res.status(409).json({
            error: { code: 'SLOT_CONFLICT', message: 'The new time slot is not available' },
          })
          return
        }
        res.status(500).json({ error: { code: 'DB_ERROR', message: bookError.message } })
        return
      }

      res.status(200).json(newApt)
      return
    }

    // If only updating notes
    if (notes != null) {
      const { data, error } = await db
        .from('appointments')
        .update({ notes })
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .select(
          'id, customer_id, service_id, staff_id, starts_at, ends_at, status, notes, created_at',
        )
        .single()

      if (error) {
        res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } })
        return
      }

      if (!data) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Appointment not found' } })
        return
      }

      res.status(200).json(data)
      return
    }

    res.status(400).json({
      error: { code: 'NO_UPDATES', message: 'No fields to update (startsAt/endsAt or notes)' },
    })
  }) as RequestHandler)

  /**
   * DELETE /api/v1/appointments/:id
   * Cancel an appointment and remove scheduled reminders
   */
  router.delete('/appointments/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'clinic_id not found' } })
      return
    }

    // Cancel the appointment
    const { error: cancelError } = await db
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))

    if (cancelError) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: cancelError.message } })
      return
    }

    // Get all notification schedules for this appointment and cancel them
    const { data: schedules, error: fetchError } = await db
      .from('notification_schedules')
      .select('id, bull_job_id')
      .eq('clinic_id', clinicId)
      .eq('appointment_id', String(req.params.id))

    if (fetchError) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: fetchError.message } })
      return
    }

    // Mark notification schedules as cancelled
    if (schedules && schedules.length > 0) {
      const { error: updateError } = await db
        .from('notification_schedules')
        .update({ status: 'cancelled' })
        .eq('clinic_id', clinicId)
        .eq('appointment_id', String(req.params.id))

      if (updateError) {
        // Log but don't fail the appointment cancellation
        // eslint-disable-next-line no-console
        console.error('Failed to cancel notification schedules:', updateError.message)
      }

      // TODO: Remove BullMQ jobs via queue.remove(bull_job_id)
      // This requires access to the queue instance, which would be passed in
    }

    res.status(204).send()
  }) as RequestHandler)

  return router
}

