const SR_KEY = '1e9d8d74ee5aaddfa669b781dd6193c4829c5d01402af016a247925cb6d9cd31ce3e878bfd84cd8dc8d586b42280fc1e4099d26897e4945e39b1598a1168b661';
const SB_URL = 'https://jzmmqtkhakdgiscigwdw.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bW1xdGtoYWtkZ2lzY2lnd2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE2NTQ0MCwiZXhwIjoyMDkxNzQxNDQwfQ.jkFIxD7svAAn8OqXhB1CHUddnSW8MeR4UMpqw6OMNh0';

const STATUS_MAP = {
  'Closer': 'close', 'Close': 'close', 'Sold': 'close', 'Sale': 'close',
  'Pas Interessé': 'no', 'Pas intéressé': 'no', 'Pas Intéressé': 'no', 'Not Interested': 'no', 'No': 'no',
  'Not Home': 'not_home', 'No Answer': 'not_home', 'NH': 'not_home',
  'Menace De Mort': 'never', 'Do Not Knock': 'never', 'DNK': 'never',
  'follow up': 'follow_up', 'Follow Up': 'follow_up', 'Interested': 'follow_up',
  'Recall': 'call_back', 'Callback': 'call_back', 'Call Back': 'call_back',
  'Other': 'other', 'Autre': 'other',
};

function mapStatus(lead) {
  const s = (lead.status || '').trim();
  const mapped = STATUS_MAP[s];
  if (lead.appointment && lead.appointment !== '') {
    const cf = lead.customFields || {};
    if (Object.values(cf).some(v => typeof v === 'string' && v.includes('🟢'))) return 'close';
    if (['Closer', 'follow up'].includes(s)) return 'close';
  }
  return mapped || 'not_home';
}

function extractPrice(cf) {
  // Prix fields: prix, prix2-10
  for (const k of ['prix', 'prix2', 'prix3', 'prix4', 'prix5', 'prix6', 'prix7', 'prix8', 'prix9', 'prix10']) {
    if (cf[k] && cf[k] !== '') {
      const p = parseFloat(cf[k]);
      if (!isNaN(p) && p > 0) return p;
    }
  }
  return null;
}

function extractServices(cf) {
  // Service fields with 🟢 emoji = service included
  const serviceMap = {
    vitresExt: 'Vitres Ext.', vitresInt: 'Vitres Int.',
    vinyle: 'Revêtement', frottementDeGouttires: 'Frottage',
    vidageDeGouttires: 'Gouttières', pressureWash: 'Pression',
    autoIntrieur: 'Auto Int.', autoExtrieur: 'Auto Ext+Int',
    poubelles: 'Bacs à ordures', moustiquaires: 'Moustiquaires',
  };
  const services = [];
  for (const [k, label] of Object.entries(serviceMap)) {
    if (cf[k] && cf[k] !== '') services.push(label);
  }
  return services;
}

async function sb(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : undefined,
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok && method !== 'DELETE') {
    const err = await res.text();
    throw new Error(`${method} ${path}: ${res.status} ${err.slice(0, 200)}`);
  }
  return res;
}

async function fetchAllLeads() {
  let all = [];
  let page = 1;
  while (true) {
    process.stdout.write(`\r  Fetching page ${page}... (${all.length} leads so far)`);
    const res = await fetch(`https://api.salesrabbit.com/leads?page=${page}&pageSize=200`, {
      headers: { Authorization: `Bearer ${SR_KEY}` }
    });
    if (!res.ok) { console.error(`\nSR error ${res.status}`); break; }
    const data = await res.json();
    const leads = Array.isArray(data) ? data : (data.data || data.leads || []);
    if (!leads.length) break;
    all.push(...leads);
    if (leads.length < 200) break;
    page++;
  }
  console.log(`\n  Total: ${all.length} leads`);
  return all;
}

async function getAdminId() {
  const res = await fetch(`${SB_URL}/rest/v1/profiles?role=eq.admin&limit=1&select=id,full_name`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const data = await res.json();
  console.log(`  Admin: ${data[0]?.full_name}`);
  return data[0]?.id;
}

async function upsertBatch(table, rows, onConflict) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=sr_id`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: `resolution=merge-duplicates,return=minimal`,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`\nBatch error on ${table}: ${err.slice(0, 300)}`);
  }
  return res.ok;
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  SI Entretien Pro — Import SR COMPLET      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('1. Admin...');
  const adminId = await getAdminId();
  if (!adminId) { console.error('❌ No admin'); process.exit(1); }

  console.log('\n2. Clearing old SR data...');
  // Clear old pings from SR
  await fetch(`${SB_URL}/rest/v1/pings?notes=like.*ID SR:*`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  // Clear old leads from SR (will re-upsert)
  console.log('  Cleared old SR pings');

  console.log('\n3. Fetching all SR leads...');
  const leads = await fetchAllLeads();

  const withGPS = leads.filter(l => parseFloat(l.latitude) && parseFloat(l.longitude));
  const withoutGPS = leads.filter(l => !parseFloat(l.latitude) || !parseFloat(l.longitude));
  console.log(`  With GPS: ${withGPS.length}`);
  console.log(`  Without GPS: ${withoutGPS.length} (will be in leads DB only, not on map)`);

  // ─── Build leads rows (ALL leads) ──────────────────────────────────────────
  console.log('\n4. Building lead records...');
  const leadRows = leads.map(l => {
    const cf = l.customFields || {};
    const lat = parseFloat(l.latitude) || null;
    const lng = parseFloat(l.longitude) || null;
    const apptDate = l.appointment ? l.appointment.slice(0, 10) : null;
    const pingType = mapStatus(l);
    const services = extractServices(cf);

    return {
      sr_id: l.id,
      first_name: l.firstName || null,
      last_name: l.lastName || null,
      phone: l.phonePrimary || null,
      email: l.email || null,
      address: l.street1?.trim() || null,
      city: l.city?.trim() || null,
      state: l.state?.trim() || null,
      lat,
      lng,
      has_gps: !!(lat && lng),
      status_sr: (l.status || '').trim() || null,
      ping_type: pingType,
      notes: l.notes || null,
      appointment_date: apptDate,
      prix: extractPrice(cf),
      services_sr: services.length ? services : null,
      sr_rep_name: l.userName || null,
    };
  });

  // Upsert leads in batches of 200
  console.log(`  Upserting ${leadRows.length} leads...`);
  let leadsInserted = 0;
  const batchSize = 200;
  for (let i = 0; i < leadRows.length; i += batchSize) {
    const batch = leadRows.slice(i, i + batchSize);
    const ok = await upsertBatch('leads', batch);
    if (ok) {
      leadsInserted += batch.length;
      process.stdout.write(`\r  ✓ ${leadsInserted}/${leadRows.length} leads`);
    }
  }

  // ─── Build pings (GPS leads only) ─────────────────────────────────────────
  console.log(`\n\n5. Creating map pings for GPS leads...`);
  const pingRows = withGPS.map(l => {
    const cf = l.customFields || {};
    const name = [l.firstName, l.lastName].filter(Boolean).join(' ');
    const addr = [l.street1?.trim(), l.city?.trim(), l.state?.trim()].filter(Boolean).join(', ');
    const noteParts = [
      name ? `👤 ${name}` : null,
      l.phonePrimary ? `📞 ${l.phonePrimary}` : null,
      l.appointment ? `📅 RDV: ${l.appointment.slice(0, 10)}` : null,
      l.notes ? l.notes : null,
      `ID SR: ${l.id}`,
    ].filter(Boolean);

    return {
      lat: parseFloat(l.latitude),
      lng: parseFloat(l.longitude),
      address: addr || null,
      ping_type: mapStatus(l),
      notes: noteParts.join(' | '),
      rep_id: adminId,
    };
  });

  let pingsInserted = 0;
  for (let i = 0; i < pingRows.length; i += batchSize) {
    const batch = pingRows.slice(i, i + batchSize);
    const ok = await upsertBatch('pings', batch);
    if (ok) {
      pingsInserted += batch.length;
      process.stdout.write(`\r  ✓ ${pingsInserted}/${pingRows.length} pings`);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const typeCount = {};
  const colors = { close: '🟢', not_home: '⬜', no: '🔴', follow_up: '🔵', call_back: '🟡', never: '⚫', other: '🟣' };
  leads.forEach(l => {
    const t = mapStatus(l);
    typeCount[t] = (typeCount[t] || 0) + 1;
  });

  console.log(`\n\n✅ Import terminé!`);
  console.log(`   ${leadsInserted} leads dans la base de données`);
  console.log(`   ${pingsInserted} pings sur la carte`);
  console.log(`   ${withoutGPS.length} leads sans GPS (visibles dans /leads seulement)\n`);
  console.log('   Breakdown:');
  for (const [t, c] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${colors[t] || '⬜'} ${t}: ${c}`);
  }
}

main().catch(console.error);
