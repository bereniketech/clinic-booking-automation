import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'

export type UserRole = 'admin' | 'provider' | 'receptionist'

export interface AuthenticatedRequest extends Request {
  clinicId: string
  userId: string
  role: UserRole
}

/**
 * Factory that creates the auth middleware with an injectable Supabase client.
 * Validates the bearer JWT, then injects clinicId, userId, and role into the
 * request — sourced exclusively from app_metadata (never from the request body).
 */
export function createAuthMiddleware(supabaseClient: SupabaseClient<Database>): RequestHandler {
  return async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

    if (!token) {
      res.status(401).json({ error: { code: 'MISSING_TOKEN' } })
      return
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN' } })
      return
    }

    const clinicId = user.app_metadata?.clinic_id as string | undefined
    if (!clinicId) {
      res.status(401).json({ error: { code: 'NO_CLINIC' } })
      return
    }

    const authReq = req as AuthenticatedRequest
    authReq.clinicId = clinicId
    authReq.userId = user.id
    authReq.role = user.app_metadata?.role as UserRole

    next()
  }
}

/**
 * Factory that creates a role-guard middleware. On denial it writes to audit_logs
 * (fire-and-forget) before returning 403.
 */
export function createRequireRole(adminClient: SupabaseClient<Database>) {
  return (...roles: UserRole[]): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authReq = req as AuthenticatedRequest

      if (!roles.includes(authReq.role)) {
        // Write denial to audit_logs — non-blocking, best-effort
        if (authReq.clinicId) {
          void adminClient
            .from('audit_logs')
            .insert({
              clinic_id: authReq.clinicId,
              actor_id: authReq.userId ?? null,
              actor_type: 'user',
              action: 'access.denied',
              resource_type: 'route',
              resource_id: req.path,
              metadata: { required_roles: roles, actual_role: authReq.role },
            })
        }

        res.status(403).json({ error: { code: 'FORBIDDEN' } })
        return
      }

      next()
    }
}
