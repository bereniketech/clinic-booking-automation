import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createAuthMiddleware, createRequireRole } from './auth.js'
import type { AuthenticatedRequest } from './auth.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    path: '/test',
    ...overrides,
  } as unknown as Request
}

// ---------------------------------------------------------------------------
// authMiddleware tests
// ---------------------------------------------------------------------------

describe('authMiddleware', () => {
  it('returns 401 MISSING_TOKEN when no Authorization header', async () => {
    const supabaseMock = { auth: { getUser: vi.fn() } } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: {} })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'MISSING_TOKEN' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 MISSING_TOKEN when Authorization header is not Bearer', async () => {
    const supabaseMock = { auth: { getUser: vi.fn() } } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'MISSING_TOKEN' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 INVALID_TOKEN when supabase returns an error', async () => {
    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('invalid') }),
      },
    } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INVALID_TOKEN' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 INVALID_TOKEN when supabase returns null user', async () => {
    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: { authorization: 'Bearer some-token' } })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INVALID_TOKEN' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 NO_CLINIC when user has no clinic_id in app_metadata', async () => {
    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', app_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
    } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NO_CLINIC' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() and injects clinicId, userId, role for a valid token', async () => {
    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-abc',
              app_metadata: { clinic_id: 'clinic-xyz', role: 'admin' },
            },
          },
          error: null,
        }),
      },
    } as any
    const middleware = createAuthMiddleware(supabaseMock)

    const req = mockReq({ headers: { authorization: 'Bearer good-token' } })
    const res = mockRes()
    const next = mockNext()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()

    const authReq = req as unknown as AuthenticatedRequest
    expect(authReq.clinicId).toBe('clinic-xyz')
    expect(authReq.userId).toBe('user-abc')
    expect(authReq.role).toBe('admin')
  })
})

// ---------------------------------------------------------------------------
// requireRole tests
// ---------------------------------------------------------------------------

describe('requireRole', () => {
  let insertMock: ReturnType<typeof vi.fn>
  let adminMock: any

  beforeEach(() => {
    insertMock = vi.fn().mockReturnValue({
      then: vi.fn().mockReturnValue({ catch: vi.fn() }),
    })
    adminMock = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    }
  })

  function makeAuthReq(role: string, clinicId = 'clinic-1', userId = 'user-1'): Request {
    return {
      headers: {},
      path: '/admin/settings',
      clinicId,
      userId,
      role,
    } as unknown as Request
  }

  it('calls next() when the role is allowed', async () => {
    const requireRole = createRequireRole(adminMock)
    const guard = requireRole('admin')

    const req = makeAuthReq('admin')
    const res = mockRes()
    const next = mockNext()

    await guard(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 FORBIDDEN when role is not in allowed list', async () => {
    const requireRole = createRequireRole(adminMock)
    const guard = requireRole('admin')

    const req = makeAuthReq('receptionist')
    const res = mockRes()
    const next = mockNext()

    await guard(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN' } })
    expect(next).not.toHaveBeenCalled()
  })

  it('writes an audit log entry on role denial', async () => {
    const requireRole = createRequireRole(adminMock)
    const guard = requireRole('admin')

    const req = makeAuthReq('receptionist', 'clinic-1', 'user-99')
    const res = mockRes()
    const next = mockNext()

    await guard(req, res, next)

    expect(adminMock.from).toHaveBeenCalledWith('audit_logs')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: 'clinic-1',
        actor_id: 'user-99',
        actor_type: 'user',
        action: 'access.denied',
        resource_type: 'route',
      }),
    )
  })

  it('allows access when any of multiple roles matches', async () => {
    const requireRole = createRequireRole(adminMock)
    const guard = requireRole('admin', 'provider')

    const req = makeAuthReq('provider')
    const res = mockRes()
    const next = mockNext()

    await guard(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
