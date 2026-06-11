import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImportDashboard from './ImportDashboard'

export default async function ImportacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (role?.role !== 'admin') redirect('/dashboard')

  const { data: batches } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return <ImportDashboard batches={batches ?? []} />
}
