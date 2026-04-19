import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const JOBBER_KEY = process.env.JOBBER_API_KEY!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const JOBBER_GQL = 'https://api.getjobber.com/api/graphql';

async function jobberQuery(query: string, variables: any = {}) {
  const res = await fetch(JOBBER_GQL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JOBBER_KEY}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2024-05-14',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Jobber API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createClient(SB_URL, SB_SERVICE);

  try {
    // Fetch jobs for next 60 days from Jobber
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const query = `
      query GetJobs($filter: JobFilterInput) {
        jobs(filter: $filter, first: 200) {
          nodes {
            id
            title
            jobNumber
            client {
              name
              primaryPhone { friendly }
              primaryEmail
              billingAddress {
                street
                city
                province
              }
            }
            visits(first: 1) {
              nodes {
                id
                startAt
                endAt
                title
                duration
              }
            }
            total
            jobStatus
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const data = await jobberQuery(query, {
      filter: {
        startDate, endDate,
        jobStatus: ['ACTIVE', 'SCHEDULED'],
      }
    });

    const jobs = data?.data?.jobs?.nodes || [];
    console.log(`[Jobber Sync] Fetched ${jobs.length} jobs`);

    // Get admin ID as fallback rep
    const { data: admin } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
    const adminId = admin?.id;

    // Get all time slots for mapping
    const { data: timeSlots } = await sb.from('time_slots').select('*').eq('actif', true).order('sort_order');

    function findSlotIndex(hour: number): number {
      // Map hour to slot: 8=slot1, 10=slot2, 12=slot3, 14=slot4, 16=slot5, 18=slot6
      if (!timeSlots) return 0;
      // Find the slot that starts at or before this hour
      const slotForHour = timeSlots.find(s => {
        const slotHour = parseInt(s.heure.split(':')[0]);
        return slotHour === hour || (slotHour <= hour && hour < slotHour + 2);
      });
      return slotForHour?.sort_order ?? 0;
    }

    let synced = 0;
    for (const job of jobs) {
      const visit = job.visits?.nodes?.[0];
      if (!visit?.startAt) continue;

      const startAt = new Date(visit.startAt);
      const endAt = visit.endAt ? new Date(visit.endAt) : new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
      const durationHours = Math.round((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60));
      const date = startAt.toISOString().split('T')[0];
      const hour = startAt.getHours();
      const slotIndex = findSlotIndex(hour);
      const slotLabel = timeSlots?.find(s => s.sort_order === slotIndex)?.heure || `${hour}:00`;

      const client = job.client || {};
      const addr = client.billingAddress;
      const addrStr = addr ? [addr.street, addr.city, addr.province].filter(Boolean).join(', ') : '';

      // Upsert by jobber_job_id
      await sb.from('bookings').upsert({
        jobber_job_id: String(job.id),
        date,
        slot_start: slotLabel,
        slot_start_index: slotIndex,
        duration_hours: durationHours >= 4 ? 4 : 2,
        client_nom: client.name || job.title || 'Jobber Client',
        client_telephone: client.primaryPhone?.friendly || null,
        client_email: client.primaryEmail || null,
        client_adresse: addrStr || null,
        services: [],
        prix_final: job.total ? parseFloat(job.total) : null,
        rep_id: adminId,
        cleaner_ids: [],
        status: 'scheduled',
      }, { onConflict: 'jobber_job_id' });

      synced++;
    }

    console.log(`[Jobber Sync] Done: ${synced} jobs synced`);
    return NextResponse.json({ success: true, jobsSynced: synced });

  } catch (err: any) {
    console.error('[Jobber Sync] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
