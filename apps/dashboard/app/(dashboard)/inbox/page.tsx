'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase-browser'

interface Conversation {
  id: string
  customer: { id: string; name: string | null; phone: string } | null
  wa_phone: string | null
  assigned_to: string | null
  unread_count: number
  last_message_at: string | null
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  type: 'text' | 'audio'
  content: string
  transcribed: boolean
  status: string
  created_at: string
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string>('')

  const supabase = createSupabaseBrowserClient()

  const fetchConversations = useCallback(async (accessToken: string) => {
    const res = await fetch('http://localhost:3001/api/v1/conversations', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
    setLoading(false)
  }, [])

  const fetchMessages = useCallback(async (conversationId: string, accessToken: string) => {
    const res = await fetch(`http://localhost:3001/api/v1/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setMessages(data)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setToken(session.access_token)
        await fetchConversations(session.access_token)
      }
    }
    init()
  }, [supabase, fetchConversations])

  useEffect(() => {
    if (selectedId && token) {
      fetchMessages(selectedId, token)
    }
  }, [selectedId, token, fetchMessages])

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message & { conversation_id: string }
          // Update conversation list
          setConversations(prev =>
            prev.map(c =>
              c.id === newMsg.conversation_id
                ? { ...c, last_message_at: newMsg.created_at, unread_count: c.unread_count + (newMsg.direction === 'inbound' ? 1 : 0) }
                : c
            ).sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())
          )
          // Add to current thread if viewing
          if (selectedId === newMsg.conversation_id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, selectedId])

  const handleReply = async () => {
    if (!reply.trim() || !selectedId || !token) return
    await fetch(`http://localhost:3001/api/v1/conversations/${selectedId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: reply }),
    })
    setReply('')
    // Message will appear via realtime or refetch
    await fetchMessages(selectedId, token)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', gap: 0 }}>
      {/* Conversation list */}
      <div style={{ width: 320, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#fff' }}>
        <h2 style={{ padding: '16px', fontSize: 18, fontWeight: 600, borderBottom: '1px solid #e5e7eb', margin: 0 }}>Inbox</h2>
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => setSelectedId(conv.id)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: selectedId === conv.id ? '#eff6ff' : '#fff',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>{conv.customer?.name ?? conv.customer?.phone ?? 'Unknown'}</strong>
              {conv.unread_count > 0 && (
                <span style={{ background: '#3b82f6', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                  {conv.unread_count}
                </span>
              )}
            </div>
            {conv.last_message_at && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {new Date(conv.last_message_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        {conversations.length === 0 && (
          <div style={{ padding: 16, color: '#9ca3af', fontSize: 14 }}>No conversations yet</div>
        )}
      </div>

      {/* Thread view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {selectedId ? (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: msg.direction === 'outbound' ? '#3b82f6' : '#f3f4f6',
                      color: msg.direction === 'outbound' ? '#fff' : '#111',
                      fontSize: 14,
                    }}
                  >
                    {msg.content}
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReply()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
              <button
                onClick={handleReply}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Select a conversation
          </div>
        )}
      </div>
    </div>
  )
}
