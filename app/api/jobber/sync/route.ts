import { NextResponse } from 'next/server';
import { createClient as adminClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID!;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro.vercel.app';

async function refreshAndGetToken(sb: any): Promise<{ token: string | null; error?: string; needsAuth?: boolean }> {
  const { data: row } = await sb.from('oauth_tokens').select('*').eq('id', 'jobber').single();
  if (!row) return { token: null, error: 'Non connecté.', needsAuth: true };
  if (!row.refresh_token) {
    await sb.from('oauth_tokens').delete().eq('id', 'jobber');
    return { token: null, error: 'Token expiré. Reconnecter Jobber.', needsAuth: true };
  }
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
  if (!res.ok || !data.access_token) {
    await sb.from('oauth_tokens').delete().eq('id', 'jobber');
    return { token: null, error: 'Refresh token invalide. Reconnecter Jobber.', needsAuth: true };
  }
  await sb.from('oauth_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || row.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', 'jobber');
  return { token: data.access_token };
}

async function jobberQuery(token: string, query: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
      },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (res.status === 429 || text.includes('THROTTLED')) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
      continue;
    }
    if (!res.ok) return { httpError: res.status, detail: text.slice(0, 400) };
    try {
      const parsed = JSON.parse(text);
      if (parsed.errors?.some((e: any) => e.extensions?.code === 'THROTTLED')) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }
      return parsed;
    } catch { return { parseError: text.slice(0, 200) }; }
  }
  return { error: 'Throttled after retries' };
}

function mapStatus(jobberStatus: string): 'completed' | 'scheduled' | 'cancelled' {
  switch ((jobberStatus || '').toUpperCase()) {
    case 'COMPLETED':
    case 'REQUIRES_INVOICING':
      return 'completed';
    case 'ARCHIVED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

async function runSync() {
  const sb = adminClient(SB_URL, SB_SVC);
  const { token, error: tokenError, needsAuth } = await refreshAndGetToken(sb);
  if (!token) return { error: tokenError, needsAuth: needsAuth ?? true };

  const syncStart = new Date().toISOString();
  let allJobs: any[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (page < 10) {
    const paginationArg = cursor ? `, after: "${cursor}"` : '';
    const query = `query {
      jobs(first: 50${paginationArg}) {
        nodes {
          id jobNumber title total jobStatus
          client {
            name
            billingAddress { street city province }
          }
          visits(first: 1) {
            nodes { startAt endAt }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const data = await jobberQuery(token, query);
    if (data.error || data.httpError || data.parseError) {
      return { error: data.error || 'HTTP ' + data.httpError, detail: data.detail || data.parseError };
    }
    if (data.errors) return { error: 'GraphQL errors', detail: JSON.stringify(data.errors).slice(0, 400) };

    const jobsPage = data?.data?.jobs;
    if (!jobsPage) break;
    allJobs = allJobs.concat(jobsPage.nodes || []);
    if (!jobsPage.pageInfo?.hasNextPage) break;
    cursor = jobsPage.pageInfo.endCursor;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  if (!allJobs.length) {
    await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });
    return { success: true, synced: 0, message: 'Aucun job dans Jobber' };
  }

  // Collect raw statuses for debugging
  const statusCounts: Record<string, number> = {};
  allJobs.forEach(j => {
    const s = j.jobStatus || 'null';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const { data: adminProfile } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const { data: timeSlots } = await sb.from('time_slots').select('*').eq('actif', true).order('sort_order');

  function slotLabel(hour: number) {
    const s = (timeSlots || []).find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; });
    return s?.heure ?? String(hour).padStart(2, '0') + ':00';
  }
  function slotIndex(hour: number) {
    return (timeSlots || []).find((s: any) => { const h = parseInt(s.heure); return hour >= h && hour < h + 2; })?.sort_order ?? 0;
  }

  let synced = 0, completedCount = 0, cancelledCount = 0;
  const errors: string[] = [];

  for (const job of allJobs) {
    try {
      const visit = job.visits?.nodes?.[0];
      if (!visit?.startAt) continue;

      const startAt = new Date(visit.startAt);
      const endAt = visit.endAt ? new Date(visit.endAt) : new Date(startAt.getTime() + 7200000);
      const durH = Math.min(Math.max(Math.round((endAt.getTime() - startAt.getTime()) / 3600000), 1), 8);
      const date = startAt.toISOString().split('T')[0];
      const hour = startAt.getHours();
      const client = job.client || {};
      const addr = client.billingAddress;
      const addrStr = addr ? [addr.street, addr.city, addr.province].filter(Boolean).join(', ') : '';
      const internalStatus = mapStatus(job.jobStatus);

      const { error: upsertErr } = await sb.from('bookings').upsert({
        jobber_job_id: String(job.id),
        date,
        slot_start: slotLabel(hour),
        slot_start_index: slotIndex(hour),
        duration_hours: durH,
        client_nom: client.name || job.title || 'Client Jobber',
        client_adresse: addrStr || null,
        client_telephone: null,
        client_email: null,
        services: [],
        prix_final: job.total ? parseFloat(String(job.total)) : null,
        rep_id: adminProfile?.id || null,
        cleaner_ids: [],
        status: internalStatus,
        jobber_status: job.jobStatus || null,
      }, { onConflict: 'jobber_job_id' });

      if (upsertErr) errors.push('Job ' + job.jobNumber + ': ' + upsertErr.message);
      else {
        synced++;
        if (internalStatus === 'completed') completedCount++;
        if (internalStatus === 'cancelled') cancelledCount++;
      }
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  await sb.from('sync_state').upsert({ key: 'jobber_last_sync', value: syncStart });

  return {
    success: true,
    synced,
    total: allJobs.length,
    completed: completedCount,
    scheduled: synced - completedCount - cancelledCount,
    cancelled: cancelledCount,
    jobberStatuses: statusCounts,
    errors: errors.length ? errors.slice(0, 5) : undefined,
    lastSync: syncStart,
  };
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth || auth !== CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const result = await runSync();
    return NextResponse.json(result);
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
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
