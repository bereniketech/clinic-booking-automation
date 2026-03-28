import { describe, it, expect } from 'vitest'
import { evaluateConditions } from './workflow-execution.processor'

describe('evaluateConditions', () => {
  it('returns true when no conditions', () => {
    expect(evaluateConditions([], {})).toBe(true)
  })

  it('evaluates eq operator', () => {
    const conditions = [{ field: 'message.content', operator: 'eq' as const, value: 'hello' }]
    expect(evaluateConditions(conditions, { message: { content: 'hello' } })).toBe(true)
    expect(evaluateConditions(conditions, { message: { content: 'bye' } })).toBe(false)
  })

  it('evaluates neq operator', () => {
    const conditions = [{ field: 'status', operator: 'neq' as const, value: 'cancelled' }]
    expect(evaluateConditions(conditions, { status: 'active' })).toBe(true)
    expect(evaluateConditions(conditions, { status: 'cancelled' })).toBe(false)
  })

  it('evaluates contains operator', () => {
    const conditions = [{ field: 'messageContent', operator: 'contains' as const, value: 'book' }]
    expect(evaluateConditions(conditions, { messageContent: 'I want to book' })).toBe(true)
    expect(evaluateConditions(conditions, { messageContent: 'hello' })).toBe(false)
  })

  it('evaluates not_contains operator', () => {
    const conditions = [{ field: 'messageContent', operator: 'not_contains' as const, value: 'cancel' }]
    expect(evaluateConditions(conditions, { messageContent: 'I want to book' })).toBe(true)
    expect(evaluateConditions(conditions, { messageContent: 'I want to cancel' })).toBe(false)
  })

  it('all conditions must be true (AND logic)', () => {
    const conditions = [
      { field: 'status', operator: 'eq' as const, value: 'active' },
      { field: 'messageContent', operator: 'contains' as const, value: 'book' },
    ]
    expect(evaluateConditions(conditions, { status: 'active', messageContent: 'book now' })).toBe(true)
    expect(evaluateConditions(conditions, { status: 'active', messageContent: 'hello' })).toBe(false)
  })

  it('handles missing nested fields gracefully', () => {
    const conditions = [{ field: 'deep.nested.field', operator: 'eq' as const, value: 'test' }]
    expect(evaluateConditions(conditions, {})).toBe(false)
  })
})
