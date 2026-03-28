'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../../lib/supabase-browser'

interface Workflow {
  id: string
  name: string
  trigger: string
  conditions: Array<{ field: string; operator: string; value: string }>
  actions: Array<{ type: string; params: Record<string, string> }>
  active: boolean
  created_at: string
}

const TRIGGERS = [
  'appointment.created',
  'appointment.completed',
  'message.received',
  'no_response',
  'time_based',
]

const CONDITION_FIELDS = ['message.content', 'customer.tag', 'appointment.service', 'appointment.status']
const CONDITION_OPERATORS = ['eq', 'neq', 'contains', 'not_contains']
const ACTION_TYPES = ['send_whatsapp', 'add_tag', 'assign_staff', 'trigger_workflow']

export default function WorkflowBuilderPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [token, setToken] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    trigger: 'message.received',
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
    actions: [] as Array<{ type: string; params: Record<string, string> }>,
  })

  const supabase = createSupabaseBrowserClient()

  const fetchWorkflows = useCallback(async (t: string) => {
    const res = await fetch('http://localhost:3001/api/v1/workflows', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setWorkflows(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token)
        fetchWorkflows(session.access_token)
      }
    })
  }, [supabase, fetchWorkflows])

  const handleToggle = async (id: string) => {
    await fetch(`http://localhost:3001/api/v1/workflows/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchWorkflows(token)
  }

  const addCondition = () => {
    setForm({ ...form, conditions: [...form.conditions, { field: 'message.content', operator: 'contains', value: '' }] })
  }

  const addAction = () => {
    setForm({ ...form, actions: [...form.actions, { type: 'send_whatsapp', params: {} }] })
  }

  const handleCreate = async () => {
    await fetch('http://localhost:3001/api/v1/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ name: '', trigger: 'message.received', conditions: [], actions: [] })
    await fetchWorkflows(token)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Workflows</h1>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Create Workflow</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {workflows.map(wf => (
          <div key={wf.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{wf.name}</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Trigger: {wf.trigger}</p>
              </div>
              <button
                onClick={() => handleToggle(wf.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: wf.active ? '#22c55e' : '#9ca3af',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {wf.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              {(wf.conditions as unknown[]).length} conditions, {(wf.actions as unknown[]).length} actions
            </div>
          </div>
        ))}
        {workflows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No workflows yet</div>}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Create Workflow</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Trigger</label>
              <select value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} style={inp}>
                {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={lbl}>Conditions</label>
                <button onClick={addCondition} style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: 'pointer' }}>+ Add</button>
              </div>
              {form.conditions.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    value={c.field}
                    onChange={e => { const cs = [...form.conditions]; cs[i] = { ...cs[i], field: e.target.value }; setForm({ ...form, conditions: cs }) }}
                    style={{ ...inp, flex: 1 }}
                  >
                    {CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={c.operator}
                    onChange={e => { const cs = [...form.conditions]; cs[i] = { ...cs[i], operator: e.target.value }; setForm({ ...form, conditions: cs }) }}
                    style={{ ...inp, width: 120 }}
                  >
                    {CONDITION_OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input
                    value={c.value}
                    onChange={e => { const cs = [...form.conditions]; cs[i] = { ...cs[i], value: e.target.value }; setForm({ ...form, conditions: cs }) }}
                    style={{ ...inp, flex: 1 }}
                    placeholder="Value"
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={lbl}>Actions</label>
                <button onClick={addAction} style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: 'pointer' }}>+ Add</button>
              </div>
              {form.actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    value={a.type}
                    onChange={e => { const as2 = [...form.actions]; as2[i] = { ...as2[i], type: e.target.value }; setForm({ ...form, actions: as2 }) }}
                    style={{ ...inp, width: 160 }}
                  >
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    value={a.params.message ?? a.params.tag ?? a.params.staffId ?? a.params.workflowId ?? ''}
                    onChange={e => {
                      const as2 = [...form.actions]
                      const paramKey = a.type === 'send_whatsapp' ? 'message' : a.type === 'add_tag' ? 'tag' : a.type === 'assign_staff' ? 'staffId' : 'workflowId'
                      as2[i] = { ...as2[i], params: { [paramKey]: e.target.value } }
                      setForm({ ...form, actions: as2 })
                    }}
                    style={{ ...inp, flex: 1 }}
                    placeholder="Value"
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 } as const
const inp = { padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const, width: '100%' }
