import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  // Get this rep's SR stats
  const { data: myStatsRow } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .eq('rep_id', user.id)
    .single();

  // Get full leaderboard to calculate rank
  const { data: allStats } = await supabase
    .from('leaderboard_stats')
    .select('rep_id, sr_closes')
    .order('sr_closes', { ascending: false });

  const myRank = (allStats || []).findIndex(s => s.rep_id === user.id) + 1;

  // Today's Jobber bookings
  const today = new Date().toISOString().split('T')[0];
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, client_nom, slot_start, cleaner_ids')
    .eq('date', today)
    .neq('status', 'cancelled');

  const unassigned = (todayBookings || []).filter(b => !b.cleaner_ids?.length).length;

  // Current pay period
  const { data: currentPeriod } = await supabase
    .from('pay_periods')
    .select('label, start_date, end_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .single();

  // Stats for current period
  let periodStats = null;
  if (currentPeriod) {
    const { data: periodCloses } = await supabase
      .from('leads')
      .select('prix')
      .eq('ping_type', 'close')
      .eq('assigned_rep_id', user.id)
      .gte('appointment_date', currentPeriod.start_date)
      .lte('appointment_date', currentPeriod.end_date);

    periodStats = {
      closes: (periodCloses || []).length,
      revenue: (periodCloses || []).reduce((s, c) => s + (c.prix || 0), 0),
    };
  }

  return (
    <DashboardClient
      profile={profile}
      userId={user.id}
      myStats={myStatsRow || null}
      myRank={myRank || 0}
      todayBookings={todayBookings || []}
      unassignedCount={unassigned}
      currentPeriod={currentPeriod || null}
      periodStats={periodStats}
    />
  );
}
