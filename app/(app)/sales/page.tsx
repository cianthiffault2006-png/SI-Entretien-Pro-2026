import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SalesClient from './SalesClient';

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';
  const logsQ = supabase.from('sales_logs').select('*, profiles(full_name)').eq('is_deleted', false).order('log_date', { ascending: false });
  if (!isManager) logsQ.eq('rep_id', user.id);
  const { data: logs } = await logsQ;

  const { data: profiles } = isManager
    ? await supabase.from('profiles').select('id, full_name').in('role', ['rep', 'admin'])
    : { data: [] };

  return <SalesClient profile={profile} initialLogs={logs || []} repList={profiles || []} userId={user.id} />;
}
