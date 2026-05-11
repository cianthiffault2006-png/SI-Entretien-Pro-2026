import { NextResponse } from 'next/server';
import { createClient as adminClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

// Try multiple possible env var names for the Jobber key
function getJobberKey(): string {
  return (
    process.env.JOBBER_API_KEY ||
    process.env.JOBBER_ACCESS_TOKEN ||
    process.env.JOBBER_TOKEN ||
    process.env.JOBBER_KEY ||
    ''
  );
}

async function runSync() {
  const JOBBER_KEY = getJobberKey();

  if (!JOBBER_KEY) {
    return { error: 'No Jobber API key found. Check env vars: JOBBER_API_KEY, JOBBER_ACCESS_TOKEN, JOBBER_TOKEN' };
  }

  const sb = adminClient(SB_URL, SB_SVC);
  const syncStart = new Date().toISOString();

  // Pull 2 years of jobs to catch completed ones
  const startDate = '2025-01-01';
  const endDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const query = `query {
    jobs(filter: { updatedAt: { gt: "2025-01-01T00:00:00Z" } }, first: 500) {
      nodes {
        id
        jobNumber
        title
        total
        jobStatus
        startAt
        endAt
        client {
          name
          firstName
          lastName
          primaryPhone { friendly }
          primaryEmail
          billingAddress { street city province postalCode }
        }
        visits(first: 1) {
          nodes {
            id
            startAt
            endAt
          }
        }
      }
    }
  }`;

  let gqlRes: Response;
  try {
    gqlRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JOBBER_KEY}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2024-05-14',
      },
      body: JSON.stringify({ query }),
    });
  } catch (err: any) {
    return { error: 'Network error reaching Jobber API', detail: err.message };
  }

  const rawText = await gqlRes.text();

  if (!gqlRes.ok) {
    return {
      error: `Jobber API returned ${gqlRes.status}`,
      detail: rawText.slice(0, 500),
      hint: gqlRes.status === 401
        ? 'Auth failed — check JOBBER_API_KEY value in Vercel'
        : gqlRes.status === 403
        ? 'Forbidden — key may not have jobs:read scope'
        : undefined,
    };
  }

  let gqlData: any;
  try {
    gqlData = JSON.parse(rawText);
  } catch {
    return { error: 'Jobber returned non-JSON', detail: rawText.slice(0, 300) };
  }

  if (gqlData.errors) {
    return { error: 'GraphQL errors', detail: JSON.stringify(gqlData.errors).slice(0, 500) };
  }

  const jobs = gqlData?.data?.jobs?.nodes || [];

  if (!jobs.length) {
    await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });
    return { success: true, synced: 0, message: 'Jobber returned 0 jobs' };
  }

  const { data: adminProfile } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const { data: timeSlots } = await sb.from('time_slots').select('*').eq('actif', true).order('sort_order');

  function slotLabel(hour: number) {
    const s = timeSlots?.find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; });
    return s?.heure ?? `${String(hour).padStart(2, '0')}:00`;
  }
  function slotIndex(hour: number) {
    return timeSlots?.find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; })?.sort_order ?? 0;
  }

  let synced = 0;
  let errors: string[] = [];

  for (const job of jobs) {
    try {
      const visit = job.visits?.nodes?.[0];
      const startAt = visit?.startAt ? new Date(visit.startAt) : job.startAt ? new Date(job.startAt) : null;
      if (!startAt) continue;

      const endAt = visit?.endAt ? new Date(visit.endAt) : startAt ? new Date(startAt.getTime() + 7200000) : null;
      const durH = endAt ? Math.round((endAt.getTime() - startAt.getTime()) / 3600000) : 2;
      const date = startAt.toISOString().split('T')[0];
      const hour = startAt.getHours();
      const client = job.client || {};
      const addr = client.billingAddress;
      const clientName = client.name || [client.firstName, client.lastName].filter(Boolean).join(' ') || job.title || 'Jobber';
      const addrStr = addr ? [addr.street, addr.city, addr.province].filter(Boolean).join(', ') : '';
      const isCompleted = job.jobStatus === 'COMPLETED';

      const { error: upsertErr } = await sb.from('bookings').upsert({
        jobber_job_id: String(job.id),
        date,
        slot_start: slotLabel(hour),
        slot_start_index: slotIndex(hour),
        duration_hours: Math.min(Math.max(durH, 1), 8),
        client_nom: clientName,
        client_telephone: client.primaryPhone?.friendly || null,
        client_email: client.primaryEmail || null,
        client_adresse: addrStr || null,
        services: [],
        prix_final: job.total ? parseFloat(String(job.total)) : null,
        rep_id: adminProfile?.id || null,
        cleaner_ids: [],
        status: isCompleted ? 'completed' : 'scheduled',
      }, { onConflict: 'jobber_job_id' });

      if (upsertErr) {
        errors.push(`Job ${job.jobNumber}: ${upsertErr.message}`);
      } else {
        synced++;
      }
    } catch (err: any) {
      errors.push(`Job ${job.id}: ${err.message}`);
    }
  }

  await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });

  return {
    success: true,
    synced,
    total: jobs.length,
    errors: errors.length ? errors.slice(0, 5) : undefined,
    lastSync: syncStart,
  };
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth || auth !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runSync();
    if ('error' in result && !('success' in result)) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cronHeader = req.headers.get('x-cron-secret');
  const isCron = cronHeader && cronHeader === CRON_SECRET;

  if (!isCron) {
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
    if ('error' in result && !('success' in result)) return NextResponse.json(result, { status: 500 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
