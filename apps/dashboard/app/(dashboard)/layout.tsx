import { createSupabaseServerClient } from '../lib/supabase-server'
import { redirect } from 'next/navigation'
import { Sidebar } from '../components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role ?? 'provider') as string

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar role={role} />
      <main style={{ flex: 1, padding: 24, background: '#f9fafb' }}>
        {children}
      </main>
    </div>
  )
}
