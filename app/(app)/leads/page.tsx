import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import LeadsClient from './LeadsClient';

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  // Load initial set — most recent 100
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('appointment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  return (
    <LeadsClient
      profile={profile}
      userId={user.id}
      initialLeads={leads || []}
      totalCount={count || 0}
    />
  );
}
