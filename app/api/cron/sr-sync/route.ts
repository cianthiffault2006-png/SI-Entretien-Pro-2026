import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SR_KEY = process.env.SR_API_KEY || '1e9d8d74ee5aaddfa669b781dd6193c4829c5d01402af016a247925cb6d9cd31ce3e878bfd84cd8dc8d586b42280fc1e4099d26897e4945e39b1598a1168b661';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bW1xdGtoYWtkZ2lzY2lnd2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE2NTQ0MCwiZXhwIjoyMDkxNzQxNDQwfQ.jkFIxD7svAAn8OqXhB1CHUddnSW8MeR4UMpqw6OMNh0';

const STATUS_MAP: Record<string, string> = {
  'Closer':'close','Close':'close','Sold':'close',
  'Pas Interessé':'no','Pas intéressé':'no','Not Interested':'no','No':'no',
  'Not Home':'not_home','No Answer':'not_home','NH':'not_home',
  'Menace De Mort':'never','Do Not Knock':'never','DNK':'never',
  'follow up':'follow_up','Follow Up':'follow_up','Interested':'follow_up',
  'Recall':'call_back','Callback':'call_back',
  'Other':'other','Autre':'other',
};

function mapStatus(lead: any): string {
  const s = (lead.status || '').trim();
  if (lead.appointment && lead.appointment !== '') {
    const cf = lead.customFields || {};
    if (Object.values(cf).some((v: any) => typeof v === 'string' && v.includes('🟢'))) return 'close';
    if (['Closer','follow up'].includes(s)) return 'close';
  }
  return STATUS_MAP[s] || 'not_home';
}

function extractPrice(cf: any): number | null {
  for (const k of ['prix','prix2','prix3','prix4','prix5','prix6','prix7','prix8','prix9','prix10','prix11']) {
    if (cf[k]) { const p = parseFloat(cf[k]); if (!isNaN(p) && p > 0) return p; }
  }
  return null;
}

function extractServices(cf: any): string[] {
  const map: Record<string, string> = {
    vitresExt:'Vitres ext.',vitresInt:'Vitres int.',frottementDeGouttires:'Frottage gouttières',
    vidageDeGouttires:'Vidage gouttières',vinyle:'Revêtement',pressureWash:'Pressure Wash',
    autoIntrieur:'Auto int.',autoExtrieur:'Auto ext.',poubelles:'Bacs',moustiquaires:'Moustiquaires',
  };
  return Object.entries(map).filter(([k]) => cf[k] && cf[k] !== '').map(([, v]) => v);
}

export async function GET(req: Request) {
  // Allow admin from app or from cron secret
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = secret === 'si-entretien-pro-cron-2026-secret';
  
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createClient(SB_URL, SB_SERVICE);
  const syncStart = new Date().toISOString();

  try {
    const { data: syncState } = await sb.from('sync_state').select('value').eq('key', 'sr_last_sync').single();
    const lastSync = syncState?.value || '2020-01-01T00:00:00Z';
    const isFullSync = lastSync === '2020-01-01T00:00:00Z';

    // Fetch modified leads
    let allLeads: any[] = [];
    let page = 1;
    const modifiedParam = isFullSync ? '' : `&modifiedAfter=${encodeURIComponent(lastSync)}`;
    while (true) {
      const res = await fetch(`https://api.salesrabbit.com/leads?page=${page}&pageSize=200${modifiedParam}`, {
        headers: { Authorization: `Bearer ${SR_KEY}` }
      });
      if (!res.ok) break;
      const data = await res.json();
      const leads = Array.isArray(data) ? data : (data.data || data.leads || []);
      if (!leads.length) break;
      allLeads.push(...leads);
      if (leads.length < 200) break;
      page++;
    }

    if (!allLeads.length) {
      await sb.from('sync_state').upsert({ key: 'sr_last_sync', value: syncStart, updated_at: syncStart });
      return NextResponse.json({ synced: 0, message: 'No changes' });
    }

    // Get profile mapping
    const { data: profiles } = await sb.from('profiles').select('id,full_name').in('role', ['rep','manager','admin']);
    const repMap: Record<string, string> = {};
    profiles?.forEach(p => {
      repMap[p.full_name.toLowerCase().trim()] = p.id;
      repMap[p.full_name.toLowerCase().split(' ')[0]] = p.id; // first name
    });
    function findRep(name: string | null): string | null {
      if (!name) return null;
      const n = name.toLowerCase().trim();
      return repMap[n] || repMap[n.split(' ')[0]] || null;
    }

    const { data: adminProfile } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).single();
    const adminId = adminProfile?.id;

    // Build lead rows
    const leadRows = allLeads.map(l => {
      const cf = l.customFields || {};
      const lat = parseFloat(l.latitude) || null;
      const lng = parseFloat(l.longitude) || null;
      return {
        sr_id: l.id,
        first_name: l.firstName || null, last_name: l.lastName || null,
        phone: l.phonePrimary || null, email: l.email || null,
        address: l.street1?.trim() || null, city: l.city?.trim() || null, state: l.state?.trim() || null,
        lat, lng, has_gps: !!(lat && lng),
        status_sr: (l.status || '').trim() || null,
        ping_type: mapStatus(l),
        notes: l.notes || null,
        appointment_date: l.appointment ? l.appointment.slice(0, 10) : null,
        prix: extractPrice(cf),
        services_sr: extractServices(cf),
        sr_rep_name: l.userName || null,
        sr_user_id: l.userId || null,
        sr_files: l.files?.length ? l.files : null,
        assigned_rep_id: findRep(l.userName),
      };
    });

    // Upsert leads
    let leadsUpserted = 0;
    for (let i = 0; i < leadRows.length; i += 100) {
      const { error } = await sb.from('leads').upsert(leadRows.slice(i, i + 100), { onConflict: 'sr_id' });
      if (!error) leadsUpserted += Math.min(100, leadRows.length - i);
    }

    // Sync pings for GPS leads
    let pingsUpdated = 0;
    for (const l of allLeads.filter(l => parseFloat(l.latitude) && parseFloat(l.longitude))) {
      const pingType = mapStatus(l);
      const addr = [l.street1?.trim(), l.city?.trim(), l.state?.trim()].filter(Boolean).join(', ');
      const name = [l.firstName, l.lastName].filter(Boolean).join(' ');
      const notes = [
        name ? `👤 ${name}` : null,
        l.phonePrimary ? `📞 ${l.phonePrimary}` : null,
        l.appointment ? `📅 RDV: ${l.appointment.slice(0, 10)}` : null,
        l.notes || null,
        `ID SR: ${l.id}`,
      ].filter(Boolean).join(' | ');

      const { data: existing } = await sb.from('pings').select('id').like('notes', `%ID SR: ${l.id}%`).maybeSingle();
      if (existing) {
        await sb.from('pings').update({ ping_type: pingType, address: addr || null, notes }).eq('id', existing.id);
      } else {
        await sb.from('pings').insert({ lat: parseFloat(l.latitude), lng: parseFloat(l.longitude), address: addr || null, ping_type: pingType, notes, rep_id: findRep(l.userName) || adminId });
      }
      pingsUpdated++;
    }

    await sb.from('sync_state').upsert({ key: 'sr_last_sync', value: syncStart, updated_at: syncStart });

    return NextResponse.json({ success: true, leadsUpserted, pingsUpdated, lastSync: syncStart });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
