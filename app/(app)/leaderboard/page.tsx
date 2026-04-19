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

  const { data: syncState } = await supabase.from('sync_state').select('value').eq('key', 'sr_last_sync').single();

  return (
    <LeaderboardClient
      profile={profile}
      userId={user.id}
      stats={stats || []}
      lastSync={syncState?.value || null}
    />
  );
}
