import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const today = new Date().toISOString().split('T')[0];
  const year  = new Date().getFullYear();

  // Wrap all queries in try/catch — tables may not exist yet
  let todayBookings: any[] = [];
  let unassignedCount = 0;
  let payrollRecords: any[] = [];
  let recentLogs: any[] = [];

  try {
    const { data } = await supabase
      .from('bookings')
      .select('id, client_nom, slot_start, client_adresse, duration_hours, status')
      .eq('date', today)
      .neq('status', 'cancelled');
    todayBookings = data || [];
  } catch {}

  try {
    const { data } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'scheduled')
      .filter('cleaner_ids', 'eq', '{}');
    unassignedCount = data?.length || 0;
  } catch {}

  try {
    const { data } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('rep_id', user.id)
      .eq('year_of_close', year);
    payrollRecords = data || [];
  } catch {}

  try {
    const logsQuery = supabase
      .from('sales_logs')
      .select('*, profiles(full_name)')
      .eq('is_deleted', false)
      .order('log_date', { ascending: false })
      .limit(20);

    if (profile.role === 'rep') {
      logsQuery.eq('rep_id', user.id);
    }

    const { data } = await logsQuery;
    recentLogs = data || [];
  } catch {}

  return (
    <DashboardClient
      profile={profile}
      todayBookings={todayBookings}
      unassignedCount={unassignedCount}
      payrollRecords={payrollRecords}
      recentLogs={recentLogs}
    />
  );
}