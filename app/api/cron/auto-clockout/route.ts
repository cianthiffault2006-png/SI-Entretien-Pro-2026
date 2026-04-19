import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createClient(SB_URL, SB_SERVICE);
  const now = new Date().toISOString();

  // Find all open timeclock sessions (clocked in, not clocked out)
  const { data: open } = await sb
    .from('timeclock')
    .select('id, rep_id, clocked_in')
    .is('clocked_out', null);

  if (!open?.length) {
    return NextResponse.json({ closed: 0, message: 'Nobody to clock out' });
  }

  // Clock them all out as auto
  const { error } = await sb
    .from('timeclock')
    .update({ clocked_out: now, auto_out: true })
    .is('clocked_out', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ closed: open.length, message: `Auto clocked out ${open.length} reps at 10pm` });
}
