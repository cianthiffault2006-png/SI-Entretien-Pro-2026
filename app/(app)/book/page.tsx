import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import BookClient from './BookClient';

export default async function BookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  const { data: slots } = await supabase.from('time_slots').select('*').eq('actif', true).order('sort_order');
  return <BookClient profile={profile} timeSlots={slots || []} userId={user.id} />;
}
