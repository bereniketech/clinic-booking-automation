import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import { Queue } from 'bullmq'
import { logger } from '../lib/logger.js'

export interface ReminderJobData {
  appointmentId: string
  clinicId: string
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export async function processReminder(
  job: Job<ReminderJobData>,
  deps: { db: DbClient; messagingQueue: Queue }
): Promise<void> {
  const { appointmentId, clinicId } = job.data
  const { db, messagingQueue } = deps

  // Idempotency check
  const { data: schedule } = await db
    .from('notification_schedules')
    .select('status')
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
    .single()

  if (!schedule || schedule.status !== 'pending') {
    logger.info({ appointmentId }, 'Reminder already processed or cancelled, skipping')
    return
  }

  // Check appointment status
  const { data: appointment } = await db
    .from('appointments')
    .select('id, starts_at, status, customer_id')
    .eq('id', appointmentId)
    .eq('clinic_id', clinicId)
    .single()

  if (!appointment || appointment.status === 'cancelled') {
    logger.info({ appointmentId }, 'Appointment cancelled, skipping reminder')
    return
  }

  // Get customer info
  const { data: customer } = await db
    .from('customers')
    .select('phone, name')
    .eq('id', appointment.customer_id)
    .eq('clinic_id', clinicId)
    .single()

  if (!customer) {
    logger.error({ appointmentId }, 'Customer not found for reminder')
    return
  }

  // Enqueue outbound message
  await messagingQueue.add('OutboundMessageJob', {
    clinicId,
    to: customer.phone,
    type: 'template',
    template: 'appointment_reminder',
    params: [customer.name ?? 'Customer', formatDateTime(appointment.starts_at)],
  })

  // Update notification schedule status
  await db
    .from('notification_schedules')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)

  logger.info({ appointmentId }, 'Reminder sent successfully')
}

export async function cancelReminder(
  appointmentId: string,
  clinicId: string,
  deps: { db: DbClient; reminderQueue: Queue }
): Promise<void> {
  const { db, reminderQueue } = deps

  const { data: schedule } = await db
    .from('notification_schedules')
    .select('bull_job_id, status')
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
    .single()

  if (!schedule || schedule.status !== 'pending') return

  if (schedule.bull_job_id) {
    try {
      const bullJob = await reminderQueue.getJob(schedule.bull_job_id)
      if (bullJob) await bullJob.remove()
    } catch (err) {
      logger.warn({ err, appointmentId }, 'Failed to remove BullMQ reminder job')
    }
  }

  await db
    .from('notification_schedules')
    .update({ status: 'cancelled' })
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)

  logger.info({ appointmentId }, 'Reminder cancelled')
}
