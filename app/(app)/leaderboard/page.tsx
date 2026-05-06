import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import LeaderboardClient from './LeaderboardClient';

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: stats } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .order('sr_closes', { ascending: false });

  const { data: payPeriods } = await supabase
    .from('pay_periods')
    .select('id, label, start_date, end_date')
    .order('start_date', { ascending: false })
    .limit(20);

  // Find current period
  const today = new Date().toISOString().split('T')[0];
  const currentPeriod = (payPeriods || []).find(p => p.start_date <= today && p.end_date >= today);

  return (
    <LeaderboardClient
      profile={profile}
      userId={user.id}
      stats={stats || []}
      payPeriods={payPeriods || []}
      currentPeriodId={currentPeriod?.id || null}
    />
  );
}
