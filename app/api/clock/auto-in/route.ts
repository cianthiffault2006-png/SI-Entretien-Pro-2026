import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];

  // Check if already clocked in today
  const { data: existing } = await supabase
    .from('timeclock')
    .select('id, clocked_out')
    .eq('rep_id', user.id)
    .gte('clocked_in', today + 'T00:00:00')
    .order('clocked_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && !existing.clocked_out) {
    // Already clocked in — do nothing
    return NextResponse.json({ status: 'already_clocked_in', id: existing.id });
  }

  if (existing && existing.clocked_out) {
    // Was clocked out — don't re-clock in automatically at this point
    return NextResponse.json({ status: 'was_clocked_out' });
  }

  // Not clocked in at all today — auto clock-in
  const { data: session } = await supabase
    .from('timeclock')
    .insert({ rep_id: user.id, clocked_in: new Date().toISOString(), auto_in: true })
    .select()
    .single();

  return NextResponse.json({ status: 'auto_clocked_in', session });
}
