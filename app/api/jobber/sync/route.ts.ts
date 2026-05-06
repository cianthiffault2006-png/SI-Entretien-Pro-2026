import { NextResponse } from 'next/server';
import { createClient as adminClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JOBBER_KEY = process.env.JOBBER_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

async function runSync() {
  const sb = adminClient(SB_URL, SB_SVC);
  const syncStart = new Date().toISOString();

  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const gqlRes = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JOBBER_KEY}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2024-05-14',
    },
    body: JSON.stringify({
      query: `query {
        visits(filter: { startAt: { gt: "${startDate}T00:00:00Z", lt: "${endDate}T23:59:59Z" } }, first: 500) {
          nodes {
            id startAt endAt title
            job {
              id jobNumber total jobStatus
              client {
                name
                primaryPhone { friendly }
                primaryEmail
                billingAddress { street city province }
              }
            }
          }
        }
      }`
    })
  });

  if (!gqlRes.ok) {
    const t = await gqlRes.text();
    return { error: `Jobber API ${gqlRes.status}`, detail: t.slice(0, 200) };
  }

  const gqlData = await gqlRes.json();
  const visits = gqlData?.data?.visits?.nodes || [];

  if (!visits.length) {
    await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart, updated_at: syncStart });
    return { success: true, synced: 0, message: 'No upcoming visits from Jobber' };
  }

  const { data: admin } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const { data: timeSlots } = await sb.from('time_slots').select('*').eq('actif', true).order('sort_order');

  function slotLabel(hour: number) {
    const s = timeSlots?.find(s => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; });
    return s?.heure ?? `${String(hour).padStart(2,'0')}:00`;
  }
  function slotIndex(hour: number) {
    return timeSlots?.find(s => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; })?.sort_order ?? 0;
  }

  let synced = 0;
  for (const visit of visits) {
    const startAt = new Date(visit.startAt);
    const endAt = visit.endAt ? new Date(visit.endAt) : new Date(startAt.getTime() + 7200000);
    const durH = Math.round((endAt.getTime() - startAt.getTime()) / 3600000);
    const date = startAt.toISOString().split('T')[0];
    const hour = startAt.getHours();
    const job = visit.job || {};
    const client = job.client || {};
    const addr = client.billingAddress;
    const addrStr = addr ? [addr.street, addr.city, addr.province].filter(Boolean).join(', ') : '';
    const isCompleted = job.jobStatus === 'COMPLETED';

    await sb.from('bookings').upsert({
      jobber_job_id: visit.id,
      date, slot_start: slotLabel(hour), slot_start_index: slotIndex(hour),
      duration_hours: durH >= 4 ? 4 : 2,
      client_nom: client.name || visit.title || 'Jobber',
      client_telephone: client.primaryPhone?.friendly || null,
      client_email: client.primaryEmail || null,
      client_adresse: addrStr || null,
      services: [],
      prix_final: job.total ? parseFloat(job.total) : null,
      rep_id: admin?.id,
      cleaner_ids: [],
      status: isCompleted ? 'completed' : 'scheduled',
    }, { onConflict: 'jobber_job_id' });
    synced++;
  }

  await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart, updated_at: syncStart });
  return { success: true, synced, total: visits.length, lastSync: syncStart };
}

// GET — called by GitHub Actions cron
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth || auth !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runSync();
    if ('error' in result) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — called by the Sync button in the UI
export async function POST(req: Request) {
  // Accept both session auth and cron secret
  const cronHeader = req.headers.get('x-cron-secret');
  const isCron = cronHeader && cronHeader === CRON_SECRET;

  if (!isCron) {
    // Session auth check
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!['admin', 'manager'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  try {
    const result = await runSync();
    if ('error' in result) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
