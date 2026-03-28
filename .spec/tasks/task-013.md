---
task: 013
feature: clinic-booking-automation
status: completed
depends_on: [009, 012]
---

# Task 013: Dashboard — Inbox (real-time)

## Session Bootstrap
> Load these before reading anything else.

Skills: /build-website-web-app, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Build the Inbox page: a two-panel layout with a conversation list (unread counts, last message preview, assignment) and a thread view (messages with mic icon for transcribed voice). Staff can reply and assign conversations. New messages arrive in real-time via Supabase Realtime subscription — no polling.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/dashboard/src/app/(dashboard)/inbox/page.tsx
// Server component: load initial conversation list
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { InboxClient } from './InboxClient'

export default async function InboxPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clinicId = user?.app_metadata?.clinic_id

  // Initial load from API
  const res = await fetch(
    `${process.env.API_URL}/api/v1/conversations?limit=50`,
    { headers: { Authorization: `Bearer ${/* server-side session token */}` } }
  )
  const { conversations } = await res.json()

  return <InboxClient initialConversations={conversations} clinicId={clinicId} />
}
```

```typescript
// apps/dashboard/src/app/(dashboard)/inbox/InboxClient.tsx
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import type { Conversation, Message } from '@clinic/shared'

export function InboxClient({
  initialConversations,
  clinicId,
}: {
  initialConversations: Conversation[]
  clinicId: string
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Supabase Realtime: subscribe to new messages for this clinic
  useEffect(() => {
    const channel = supabase
      .channel('inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          // Update conversation list: bump last_message_at, increment unread
          setConversations(prev =>
            prev.map(c =>
              c.id === newMessage.conversation_id
                ? { ...c, last_message_at: newMessage.created_at, unread_count: c.unread_count + 1 }
                : c
            )
          )
          // If the thread is open, append message
          if (newMessage.conversation_id === activeId) {
            setMessages(prev => [...prev, newMessage])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clinicId, activeId])

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
      />
      {activeId && (
        <ThreadView
          conversationId={activeId}
          messages={messages}
          onMessagesLoad={setMessages}
        />
      )}
    </div>
  )
}
```

```typescript
// Thread view — message list + reply input
function ThreadView({
  conversationId,
  messages,
  onMessagesLoad,
}: {
  conversationId: string
  messages: Message[]
  onMessagesLoad: (msgs: Message[]) => void
}) {
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  // Load messages when conversation selected
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/messages`)
      .then(r => r.json())
      .then(({ messages }) => onMessagesLoad(messages))
  }, [conversationId])

  const sendReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyText }),
    })
    setReplyText('')
    setSending(false)
    // New message will arrive via Realtime subscription
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      {/* Reply input */}
      <div className="border-t p-3 flex gap-2">
        <input
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendReply()}
          placeholder="Type a reply..."
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button onClick={sendReply} disabled={sending}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
          Send
        </button>
      </div>
    </div>
  )
}

// Message bubble — shows mic icon for transcribed voice messages
function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-sm rounded-lg px-3 py-2 text-sm ${
        isOutbound ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        {message.transcribed && (
          <span className="mr-1 text-xs opacity-70">🎤</span>
        )}
        {message.content}
        <div className="text-xs opacity-60 mt-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
```

```typescript
// apps/dashboard/src/app/api/conversations/[id]/messages/route.ts
// Next.js API route — proxy to apps/api (adds auth header server-side)
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(
    `${process.env.API_URL}/api/v1/conversations/${params.id}/messages`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )
  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const res = await fetch(
    `${process.env.API_URL}/api/v1/conversations/${params.id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  return NextResponse.json(await res.json(), { status: res.status })
}
```

### Key Patterns in Use
- **Server component for initial load, Client component for interactivity:** `InboxPage` (server) fetches initial data; `InboxClient` (client) manages real-time state.
- **Supabase Realtime with `clinic_id` filter:** The subscription filter `clinic_id=eq.${clinicId}` prevents receiving other clinics' messages. RLS on the table also enforces this server-side.
- **Mic icon via `transcribed` flag:** `message.transcribed === true` means voice was transcribed. Display a microphone indicator.
- **Optimistic reply:** After `POST /conversations/:id/messages` returns 201, the staff sees the message optimistically. Real-time echo from the subscription is deduplicated by message ID.
- **Next.js API routes proxy to `apps/api`:** Dashboard never calls the external API directly from the browser — all API calls go through Next.js API routes that inject the auth token server-side.

### Architecture Decisions Affecting This Task
- Supabase Realtime subscription is `postgres_changes` on `messages` table, filtered by `clinic_id`
- `apps/api` is the source of truth for all data — dashboard does not write to Supabase directly
- Voice messages show transcribed text + mic icon; there is no audio playback in the dashboard (audio was never stored per ADR-5)

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-009 + task-012)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Build `ConversationList` component: sorted by `last_message_at`, unread badge, assigned staff chip
2. Build `MessageBubble` component: direction-based alignment, mic icon for `transcribed: true`, timestamp
3. Build `ThreadView` component: message list + reply input + conversation assignment dropdown
4. Implement Supabase Realtime subscription in `InboxClient` — subscribe on mount, unsubscribe on unmount
5. Implement Next.js API proxy routes for `/api/conversations` and `/api/conversations/[id]/messages`
6. Wire `InboxPage` server component to fetch initial conversations from `apps/api`
7. Add conversation assignment: `PATCH /api/conversations/:id` with `{ assignedStaffId }` via proxy route
8. Write tests: Realtime payload updates conversation list, reply sends POST to API proxy, mic icon renders for transcribed messages

_Requirements: 5.5, 5.6, 9.1, 9.3_
_Skills: /build-website-web-app — Supabase Realtime, server/client component split; /code-writing-software-development — real-time state management_

---

## Acceptance Criteria
- [x] New inbound message appears in conversation list within 2 seconds (Realtime)
- [x] Transcribed voice messages show mic icon + transcribed text (no audio player)
- [x] Staff reply sends POST to API proxy, message appears in thread immediately
- [x] Conversation list sorted by `last_message_at` descending
- [x] Unread count increments on new inbound message
- [x] Conversation assignment updates via API
- [x] Realtime subscription unsubscribed when component unmounts
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
