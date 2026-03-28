import Link from 'next/link'

export default function WorkflowsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Workflows</h1>
      <p style={{ marginBottom: 16 }}>Manage your automation workflows.</p>
      <Link href="/settings/workflows" style={{ color: '#3b82f6' }}>Go to Workflow Builder</Link>
    </div>
  )
}
