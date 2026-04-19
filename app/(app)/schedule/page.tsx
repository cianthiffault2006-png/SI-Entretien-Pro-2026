import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ScheduleCalendar from './ScheduleCalender';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: timeSlots } = await supabase.from('time_slots').select('*').eq('actif', true).order('sort_order');

  // This week's bookings
  const today = new Date();
  const dow = today.getDay();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - dow);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - dow + 6);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .gte('date', fmt(weekStart))
    .lte('date', fmt(weekEnd))
    .neq('status', 'cancelled')
    .order('date')
    .order('slot_start_index');

  // Sync status
  const { data: syncState } = await supabase.from('sync_state').select('value').eq('key', 'sr_last_sync').single();
  const { count: jobberCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).not('jobber_job_id', 'is', null);

  return (
    <ScheduleCalendar
      profile={profile}
      userId={user.id}
      initialBookings={bookings || []}
      timeSlots={timeSlots || []}
      syncStatus={{
        lastSrSync: syncState?.value || '2020-01-01T00:00:00Z',
        jobberBookings: jobberCount || 0,
      }}
    />
  );
}
