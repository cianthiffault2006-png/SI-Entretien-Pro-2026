const SR_KEY = '1e9d8d74ee5aaddfa669b781dd6193c4829c5d01402af016a247925cb6d9cd31ce3e878bfd84cd8dc8d586b42280fc1e4099d26897e4945e39b1598a1168b661';
const SB_URL = 'https://jzmmqtkhakdgiscigwdw.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bW1xdGtoYWtkZ2lzY2lnd2R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE2NTQ0MCwiZXhwIjoyMDkxNzQxNDQwfQ.jkFIxD7svAAn8OqXhB1CHUddnSW8MeR4UMpqw6OMNh0';

// Reps who do recall sales
const RECALL_REPS = ['cian', 'charlo', 'fred', 'charles plam', 'charles plamondon'];
function isRecallRep(name) { if (!name) return false; const n = name.toLowerCase(); return RECALL_REPS.some(r => n.includes(r)); }

const STATUS_MAP = {
  'Closer':'close','Close':'close','Sold':'close','Sale':'close',
  'Pas Interessé':'no','Pas intéressé':'no','Not Interested':'no','No':'no',
  'Not Home':'not_home','No Answer':'not_home','NH':'not_home',
  'Menace De Mort':'never','Do Not Knock':'never','DNK':'never',
  'follow up':'follow_up','Follow Up':'follow_up','Interested':'follow_up',
  'Recall':'call_back','Callback':'call_back','Call Back':'call_back',
  'Other':'other','Autre':'other',
};

function mapStatus(lead) {
  const s = (lead.status || '').trim();
  const mapped = STATUS_MAP[s];
  if (lead.appointment && lead.appointment !== '') {
    const cf = lead.customFields || {};
    if (Object.values(cf).some(v => typeof v === 'string' && v.includes('🟢'))) return 'close';
    if (['Closer','follow up'].includes(s)) return 'close';
  }
  return mapped || 'not_home';
}

// Check BOTH notes fields for "recall" keyword
function isRecall(lead) {
  if (!isRecallRep(lead.userName)) return false;
  const cf = lead.customFields || {};
  const mainNotes = (lead.notes || '').toLowerCase();
  const cfNotes = (cf.notes || '').toLowerCase(); // customFields.notes
  return mainNotes.includes('recall') || cfNotes.includes('recall');
}

function extractPrice(cf) {
  for (const k of ['prix','prix2','prix3','prix4','prix5','prix6','prix7','prix8','prix9','prix10','prix11']) {
    if (cf[k] && cf[k] !== '') { const p = parseFloat(cf[k]); if (!isNaN(p) && p > 0) return p; }
  }
  return null;
}

function extractServices(cf) {
  const m = { vitresExt:'Vitres Ext.',vitresInt:'Vitres Int.',vinyle:'Revêtement',frottementDeGouttires:'Frottage',vidageDeGouttires:'Gouttières',pressureWash:'Pression',autoIntrieur:'Auto Int.',autoExtrieur:'Auto Ext+Int',poubelles:'Bacs à ordures',moustiquaires:'Moustiquaires' };
  return Object.entries(m).filter(([k]) => (cf[k] || '') !== '').map(([,v]) => v);
}

async function fetchAllLeads() {
  let all = []; let page = 1;
  while (true) {
    process.stdout.write(`\r  Fetching page ${page}... (${all.length} so far)`);
    const res = await fetch(`https://api.salesrabbit.com/leads?page=${page}&pageSize=200`, { headers: { Authorization: `Bearer ${SR_KEY}` } });
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
  const res = await fetch(`${SB_URL}/rest/v1/profiles?role=eq.admin&limit=1&select=id,full_name`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  const data = await res.json();
  console.log(`  Admin: ${data[0]?.full_name}`);
  return data[0]?.id;
}

async function upsertBatch(table, rows, conflictCol) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) { const err = await res.text(); console.error(`\nBatch error on ${table}: ${err.slice(0,300)}`); }
  return res.ok;
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  SI Entretien Pro — Import SR COMPLET v3   ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log('  Changes: now captures customFields.notes for recall detection\n');

  console.log('1. Admin...');
  const adminId = await getAdminId();
  if (!adminId) { console.error('❌ No admin'); process.exit(1); }

  console.log('\n2. Fetching all SR leads...');
  const leads = await fetchAllLeads();
  const withGPS = leads.filter(l => parseFloat(l.latitude) && parseFloat(l.longitude));
  const withoutGPS = leads.filter(l => !parseFloat(l.latitude) || !parseFloat(l.longitude));
  console.log(`  With GPS: ${withGPS.length} | Without GPS: ${withoutGPS.length}`);

  // Count recalls
  const recallCount = leads.filter(l => mapStatus(l) === 'close' && isRecall(l)).length;
  console.log(`  Recall closes found: ${recallCount}`);

  console.log('\n3. Upserting leads...');
  const leadRows = leads.map(l => {
    const cf = l.customFields || {};
    const lat = parseFloat(l.latitude) || null;
    const lng = parseFloat(l.longitude) || null;
    const services = extractServices(cf);
    const pingType = mapStatus(l);
    const saleType = (pingType === 'close' && isRecall(l)) ? 'recall' : 'd2d';

    return {
      sr_id: l.id,
      first_name: l.firstName||null, last_name: l.lastName||null,
      phone: l.phonePrimary||null, email: l.email||null,
      address: l.street1?.trim()||null, city: l.city?.trim()||null, state: l.state?.trim()||null,
      lat, lng, has_gps: !!(lat && lng),
      status_sr: (l.status||'').trim()||null,
      ping_type: pingType,
      notes: l.notes||null,          // top-level notes
      cf_notes: cf.notes||null,       // customFields.notes (2nd notes box in SR)
      appointment_date: l.appointment ? l.appointment.slice(0,10) : null,
      prix: extractPrice(cf),
      services_sr: services.length ? services : null,
      sr_rep_name: l.userName||null,
      sr_user_id: l.userId||null,
      sr_files: l.files?.length ? l.files : null,
      sale_type: saleType,
    };
  });

  let leadsOk = 0;
  for (let i = 0; i < leadRows.length; i += 200) {
    const ok = await upsertBatch('leads', leadRows.slice(i,i+200), 'sr_id');
    if (ok) leadsOk += Math.min(200, leadRows.length - i);
    process.stdout.write(`\r  ✓ ${leadsOk}/${leadRows.length} leads`);
  }

  console.log(`\n\n4. Upserting pings...`);
  const pingRows = withGPS.map(l => {
    const name = [l.firstName, l.lastName].filter(Boolean).join(' ');
    const addr = [l.street1?.trim(), l.city?.trim(), l.state?.trim()].filter(Boolean).join(', ');
    const cf = l.customFields || {};
    const allNotes = [l.notes, cf.notes].filter(Boolean).join(' | ');
    const notes = [
      name ? `👤 ${name}` : null,
      l.phonePrimary ? `📞 ${l.phonePrimary}` : null,
      l.appointment ? `📅 RDV: ${l.appointment.slice(0,10)}` : null,
      allNotes || null,
      `ID SR: ${l.id}`,
    ].filter(Boolean).join(' | ');
    return {
      sr_id: l.id,
      lat: parseFloat(l.latitude), lng: parseFloat(l.longitude),
      address: addr||null, ping_type: mapStatus(l), notes, rep_id: adminId,
    };
  });

  let pingsOk = 0;
  for (let i = 0; i < pingRows.length; i += 200) {
    const ok = await upsertBatch('pings', pingRows.slice(i,i+200), 'sr_id');
    if (ok) pingsOk += Math.min(200, pingRows.length - i);
    process.stdout.write(`\r  ✓ ${pingsOk}/${pingRows.length} pings`);
  }

  const typeCount = {};
  const colors = { close:'🟢',not_home:'⬜',no:'🔴',follow_up:'🔵',call_back:'🟡',never:'⚫',other:'🟣' };
  leads.forEach(l => { const t = mapStatus(l); typeCount[t] = (typeCount[t]||0)+1; });

  console.log(`\n\n✅ Import terminé!`);
  console.log(`   ${leadsOk} leads · ${pingsOk} pings · ${recallCount} recalls détectés\n`);
  for (const [t,c] of Object.entries(typeCount).sort((a,b)=>b[1]-a[1])) {
    console.log(`   ${colors[t]||'⬜'} ${t}: ${c}`);
  }
}

main().catch(console.error);
