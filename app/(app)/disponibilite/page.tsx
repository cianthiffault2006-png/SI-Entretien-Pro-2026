import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DisponibiliteClient from './DisponibiliteClient';

function weekKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

export default async function DisponibilitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const currentWeek = weekKey();
  // Get 4 weeks of availability (past week + current + 2 future)
  const weeks = [-1, 0, 1, 2, 3].map(o => weekKey(o));

  const { data: allAvail } = await supabase
    .from('weekly_availability')
    .select('*, profiles(full_name, role)')
    .in('semaine', weeks);

  // Bookings for next 45 days
  const today = new Date().toISOString().split('T')[0];
  const end = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('date, slot_start_index, duration_hours, client_nom, client_adresse, client_adresse_lat, client_adresse_lng')
    .gte('date', today)
    .lte('date', end)
    .neq('status', 'cancelled')
    .order('date');

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['rep', 'manager', 'cleaner'])
    .eq('is_active', true)
    .order('full_name');

  return (
    <DisponibiliteClient
      profile={profile}
      userId={user.id}
      allAvail={allAvail || []}
      bookings={bookings || []}
      staff={staff || []}
      currentWeek={currentWeek}
    />
  );
}
