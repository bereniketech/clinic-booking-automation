import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest, UserRole } from '../middleware/auth.js'

type RequireRole = (...roles: UserRole[]) => RequestHandler

/**
 * Creates the auth router.
 * - POST /register — public, no auth required
 * - POST /invite   — admin only
 * - PATCH /users/:id/deactivate — admin only (mounted at app level)
 */
export function createAuthRouter(
  adminClient: SupabaseClient<Database>,
  requireRole: RequireRole,
): Router {
  const router = Router()

  // -----------------------------------------------------------------
  // POST /api/v1/auth/register
  // Creates a clinic row + Supabase user and stamps app_metadata.
  // This route is exempt from authMiddleware.
  // -----------------------------------------------------------------
  router.post('/register', (async (req, res) => {
    const { name, email, password, timezone, plan_id } = req.body as {
      name?: string
      email?: string
      password?: string
      timezone?: string
      plan_id?: string
    }

    if (!name || !email || !password || !plan_id) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name, email, password, plan_id are required' } })
      return
    }

    // 1. Create clinic row (service role bypasses RLS)
    const { data: clinic, error: clinicError } = await adminClient
      .from('clinics')
      .insert({ name, plan_id, timezone: timezone ?? 'UTC' })
      .select('id')
      .single()

    if (clinicError || !clinic) {
      res.status(500).json({ error: { code: 'CLINIC_CREATE_FAILED', message: clinicError?.message } })
      return
    }

    // 2. Create Supabase auth user
    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (signUpError || !authData.user) {
      // Roll back clinic row
      await adminClient.from('clinics').delete().eq('id', clinic.id)
      res.status(500).json({ error: { code: 'USER_CREATE_FAILED', message: signUpError?.message } })
      return
    }

    const userId = authData.user.id

    // 3. Stamp clinic_id and role into app_metadata
    const { error: metaError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { clinic_id: clinic.id, role: 'admin' },
    })

    if (metaError) {
      await adminClient.auth.admin.deleteUser(userId)
      await adminClient.from('clinics').delete().eq('id', clinic.id)
      res.status(500).json({ error: { code: 'METADATA_UPDATE_FAILED', message: metaError.message } })
      return
    }

    // 4. Create users row in public.users
    const { error: userRowError } = await adminClient
      .from('users')
      .insert({ id: userId, clinic_id: clinic.id, email, role: 'admin', active: true })

    if (userRowError) {
      await adminClient.auth.admin.deleteUser(userId)
      await adminClient.from('clinics').delete().eq('id', clinic.id)
      res.status(500).json({ error: { code: 'USER_ROW_FAILED', message: userRowError.message } })
      return
    }

    res.status(201).json({ clinic_id: clinic.id, user_id: userId })
  }) as RequestHandler)

  // -----------------------------------------------------------------
  // POST /api/v1/auth/invite  (admin only)
  // Sends an invite email and creates a pending user with the clinic's
  // clinic_id in app_metadata.
  // -----------------------------------------------------------------
  router.post('/invite', requireRole('admin'), (async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const { email, role } = req.body as { email?: string; role?: UserRole }

    if (!email || !role) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'email and role are required' } })
      return
    }

    if (!['provider', 'receptionist'].includes(role)) {
      res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'role must be provider or receptionist' } })
      return
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { clinic_id: authReq.clinicId, role },
    })

    if (inviteError || !inviteData.user) {
      res.status(500).json({ error: { code: 'INVITE_FAILED', message: inviteError?.message } })
      return
    }

    // Create users row (inactive until the invite is accepted)
    const { error: userRowError } = await adminClient
      .from('users')
      .insert({ id: inviteData.user.id, clinic_id: authReq.clinicId, email, role, active: false })

    if (userRowError) {
      res.status(500).json({ error: { code: 'USER_ROW_FAILED', message: userRowError.message } })
      return
    }

    res.status(201).json({ user_id: inviteData.user.id })
  }) as RequestHandler)

  return router
}

/**
 * Builds the user-management sub-router (deactivate endpoint).
 * Mounted at /api/v1/users by the app.
 */
export function createUsersRouter(
  adminClient: SupabaseClient<Database>,
  requireRole: RequireRole,
): Router {
  const router = Router()

  // PATCH /api/v1/users/:id/deactivate  (admin only)
  router.patch('/:id/deactivate', requireRole('admin'), (async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const targetUserId = req.params['id'] as string

    // Verify the target user belongs to the same clinic
    const { data: targetUser, error: fetchError } = await adminClient
      .from('users')
      .select('id, clinic_id, active')
      .eq('id', targetUserId)
      .eq('clinic_id', authReq.clinicId)
      .single()

    if (fetchError || !targetUser) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND' } })
      return
    }

    // Set active = false in public.users
    const { error: updateError } = await adminClient
      .from('users')
      .update({ active: false })
      .eq('id', targetUserId)
      .eq('clinic_id', authReq.clinicId)

    if (updateError) {
      res.status(500).json({ error: { code: 'DEACTIVATE_FAILED', message: updateError.message } })
      return
    }

    // Revoke all active sessions for the user
    await adminClient.auth.admin.signOut(targetUserId, 'others')

    res.status(200).json({ success: true })
  }) as RequestHandler)

  return router
}
