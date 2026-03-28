import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import { logger } from '../lib/logger.js'
import { Queue } from 'bullmq'

export interface AppointmentCreatedEvent {
  appointmentId: string
  clinicId: string
  customerId: string
  startsAt: string
}

export async function processAppointmentCreated(
  job: Job<AppointmentCreatedEvent>,
  deps: { db: DbClient; reminderQueue: Queue }
): Promise<void> {
  const { appointmentId, clinicId, startsAt } = job.data
  const { db, reminderQueue } = deps

  // Get clinic config for reminder offset
  const { data: clinic, error } = await db
    .from('clinics')
    .select('reminder_offset_hours')
    .eq('id', clinicId)
    .single()

  if (error || !clinic) {
    logger.error({ clinicId, error }, 'Failed to get clinic config')
    return
  }

  const reminderOffsetHours = clinic.reminder_offset_hours ?? 24
  const reminderAt = new Date(startsAt)
  reminderAt.setHours(reminderAt.getHours() - reminderOffsetHours)
  const delayMs = reminderAt.getTime() - Date.now()

  if (delayMs <= 0) {
    logger.info({ appointmentId }, 'Appointment too soon for reminder, skipping')
    return
  }

  const bullJob = await reminderQueue.add(
    'ReminderJob',
    { appointmentId, clinicId },
    { delay: delayMs, jobId: `reminder:${appointmentId}` }
  )

  await db.from('notification_schedules').insert({
    clinic_id: clinicId,
    appointment_id: appointmentId,
    bull_job_id: bullJob.id ?? `reminder:${appointmentId}`,
    status: 'pending',
    scheduled_at: reminderAt.toISOString(),
    type: 'reminder',
  })

  logger.info({ appointmentId, reminderAt: reminderAt.toISOString() }, 'Reminder scheduled')
}
