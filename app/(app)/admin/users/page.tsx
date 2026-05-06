import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/dashboard');
  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
  return <AdminUsersClient currentUser={profile} profiles={profiles || []} />;
}
