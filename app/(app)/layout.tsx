import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import Nav from '@/components/Nav';
import type { Profile } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden', background: '#070E1A' }}>
      <Nav profile={profile as Profile} />
      <main
        className="pb-20 sm:pb-0"
        style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </main>
    </div>
  );
}
