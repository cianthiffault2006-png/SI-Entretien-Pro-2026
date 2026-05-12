import { NextResponse } from 'next/server';
import { createClient as adminClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID!;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro-2026.vercel.app';

async function getValidToken(sb: any): Promise<{ token: string | null; error?: string }> {
  const { data: row } = await sb.from('oauth_tokens').select('*').eq('id', 'jobber').single();

  if (!row) {
    return { token: null, error: `NOT_CONNECTED:${APP_URL}/api/jobber/authorize` };
  }

  // Check expiry (refresh 5 min before expiry)
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const needsRefresh = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (needsRefresh && row.refresh_token) {
    const res = await fetch('https://api.getjobber.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: JOBBER_CLIENT_ID,
        client_secret: JOBBER_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      await sb.from('oauth_tokens').update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || row.refresh_token,
        expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', 'jobber');
      return { token: data.access_token };
    }
  }

  return { token: row.access_token };
}

async function runSync() {
  const sb = adminClient(SB_URL, SB_SVC);
  const { token, error: tokenError } = await getValidToken(sb);

  if (!token) {
    return { error: tokenError || 'No Jobber token. Connect Jobber first.', needsAuth: true };
  }

  const syncStart = new Date().toISOString();

  const query = `query {
    jobs(filter: { updatedAt: { gt: "2025-01-01T00:00:00Z" } }, first: 500) {
      nodes {
        id jobNumber title total jobStatus createdAt
        client {
          name firstName lastName
          primaryPhone { friendly }
          primaryEmail
          billingAddress { street city province postalCode }
        }
        visits(first: 1) {
          nodes { id startAt endAt }
        }
      }
    }
  }`;

  const gqlRes = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2024-05-14',
    },
    body: JSON.stringify({ query }),
  });

  const rawText = await gqlRes.text();

  if (!gqlRes.ok) {
    // If 401, token may be stale — clear it
    if (gqlRes.status === 401) {
      await sb.from('oauth_tokens').delete().eq('id', 'jobber');
    }
    return {
      error: `Jobber API ${gqlRes.status}`,
      detail: rawText.slice(0, 300),
      needsAuth: gqlRes.status === 401,
    };
  }

  const gqlData = JSON.parse(rawText);
  if (gqlData.errors) {
    return { error: 'GraphQL error', detail: JSON.stringify(gqlData.errors).slice(0, 300) };
  }

  const jobs = gqlData?.data?.jobs?.nodes || [];
  if (!jobs.length) {
    await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });
    return { success: true, synced: 0, message: 'No jobs returned from Jobber' };
  }

  const { data: adminProfile } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const { data: timeSlots } = await sb.from('time_slots').select('*').eq('actif', true).order('sort_order');

  function slotLabel(hour: number) {
    const s = (timeSlots || []).find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; });
    return s?.heure ?? `${String(hour).padStart(2, '0')}:00`;
  }
  function slotIndex(hour: number) {
    return (timeSlots || []).find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; })?.sort_order ?? 0;
  }

  let synced = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      const visit = job.visits?.nodes?.[0];
      const startAt = visit?.startAt ? new Date(visit.startAt) : job.createdAt ? new Date(job.createdAt) : null;
      if (!startAt) continue;

      const endAt = visit?.endAt ? new Date(visit.endAt) : new Date(startAt.getTime() + 7200000);
      const durH = Math.min(Math.max(Math.round((endAt.getTime() - startAt.getTime()) / 3600000), 1), 8);
      const date = startAt.toISOString().split('T')[0];
      const hour = startAt.getHours();
      const client = job.client || {};
      const addr = client.billingAddress;
      const clientName = client.name || [client.firstName, client.lastName].filter(Boolean).join(' ') || job.title || 'Client Jobber';
      const addrStr = addr ? [addr.street, addr.city, addr.province].filter(Boolean).join(', ') : '';
      const isCompleted = job.jobStatus === 'COMPLETED';

      const { error: upsertErr } = await sb.from('bookings').upsert({
        jobber_job_id: String(job.id),
        date,
        slot_start: slotLabel(hour),
        slot_start_index: slotIndex(hour),
        duration_hours: durH,
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

      if (upsertErr) errors.push(`Job ${job.jobNumber}: ${upsertErr.message}`);
      else synced++;
    } catch (err: any) {
      errors.push(`Job ${job.id}: ${err.message}`);
    }
  }

  await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });
  return { success: true, synced, total: jobs.length, errors: errors.slice(0, 5), lastSync: syncStart };
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth || auth !== CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const result = await runSync();
    return NextResponse.json(result, { status: 'error' in result && !('success' in result) ? 500 : 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cronHeader = req.headers.get('x-cron-secret');
  if (!cronHeader || cronHeader !== CRON_SECRET) {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!['admin', 'manager'].includes(profile?.role || '')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const result = await runSync();
    return NextResponse.json(result, { status: 'error' in result && !('success' in result) ? 500 : 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
