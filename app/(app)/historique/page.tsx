import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import HistoriqueClient from './HistoriqueClient';

export default async function HistoriquePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';

  // For managers: all closes. For reps: only their own.
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, address, city, appointment_date, prix, services_sr, sr_rep_name, assigned_rep_id, status_sr, created_at')
    .eq('ping_type', 'close')
    .order('appointment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (!isManager) {
    query = query.eq('assigned_rep_id', user.id);
  }

  const { data: closes } = await query;

  // Get all reps for filter dropdown
  const { data: reps } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['rep', 'manager'])
    .eq('is_active', true)
    .order('full_name');

  return (
    <HistoriqueClient
      profile={profile}
      closes={closes || []}
      reps={reps || []}
      isManager={isManager}
    />
  );
}
