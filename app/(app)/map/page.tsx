import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import MapClient from './MapClient';

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: pings } = await supabase
    .from('pings')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(3000); // load up to 3000 pings for the map

  const { data: territories } = await supabase
    .from('territories')
    .select('*')
    .eq('status', 'active');

  return (
    // CRITICAL: flex-1 + min-h-0 so the map fills the remaining vertical space
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <MapClient
        profile={profile}
        initialPings={pings || []}
        territories={territories || []}
        userId={user.id}
      />
    </div>
  );
}
