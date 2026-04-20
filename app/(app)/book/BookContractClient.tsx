'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SERVICES, is4HourJob, checkLowball, type Profile, type TimeSlot } from '@/lib/types';

interface Props {
  profile: Profile;
  userId: string;
  timeSlots: TimeSlot[];
  nextContractNumber: string;
  prefillName?: string;
  prefillPhone?: string;
  prefillEmail?: string;
  prefillAddress?: string;
  prefillLat?: number;
  prefillLng?: number;
  fromPingId?: string;
  fromLeadId?: string;
}

type Step = 'info' | 'services' | 'slot' | 'sign' | 'done';

interface Slot { date: string; dateLabel: string; slot: TimeSlot; currentJobs: number; distanceKm: number | null; }

const CATS = [...new Set(SERVICES.map(s => s.cat))];

function dk(d: Date) { return d.toISOString().split('T')[0]; }
function fmtDate(d: Date) { return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }); }

export default function BookContractClient({ profile, userId, timeSlots, nextContractNumber, prefillName, prefillPhone, prefillEmail, prefillAddress, prefillLat, prefillLng, fromPingId, fromLeadId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<HTMLCanvasElement>(null);
  const sigCtx = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);

  // Step
  const [step, setStep] = useState<Step>('info');

  // Client info
  const [nom, setNom] = useState(prefillName || '');
  const [tel, setTel] = useState(prefillPhone || '');
  const [email, setEmail] = useState(prefillEmail || '');
  const [addr, setAddr] = useState(prefillAddress || '');
  const [lat, setLat] = useState<number | null>(prefillLat || null);
  const [lng, setLng] = useState<number | null>(prefillLng || null);
  const [addrSuggs, setAddrSuggs] = useState<any[]>([]);
  const [addrTimer, setAddrTimer] = useState<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Services + pricing
  const [services, setServices] = useState<string[]>([]);
  const [autreDetail, setAutreDetail] = useState('');
  const [prixAvant, setPrixAvant] = useState('');
  const [prixFinal, setPrixFinal] = useState('');
  const [amPm, setAmPm] = useState<'AM'|'PM'>('AM');
  const [notes, setNotes] = useState('');
  const [saleType, setSaleType] = useState<'d2d'|'recall'>('d2d'); // ← RECALL / D2D TOGGLE
  const [sendEmail, setSendEmail] = useState(false);

  // Slot
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Signature
  const [sigEmpty, setSigEmpty] = useState(true);

  // Saving
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedData, setSavedData] = useState<any>(null);

  const duration = is4HourJob(services) ? 4 : 2;
  const lowball = prixFinal ? checkLowball(services, parseFloat(prixFinal)) : [];

  // Address autocomplete
  function onAddrChange(v: string) {
    setAddr(v); clearTimeout(addrTimer);
    if (v.length < 3) { setAddrSuggs([]); return; }
    setAddrTimer(setTimeout(async () => {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v + ', Québec, Canada')}&format=json&limit=5&addressdetails=1`);
      setAddrSuggs(await r.json());
    }, 400));
  }
  function pickAddr(s: any) {
    const a = s.address || {};
    setAddr(`${a.house_number ? a.house_number + ' ' : ''}${a.road || ''}${(a.city||a.town) ? ', ' + (a.city||a.town) : ''}`);
    setLat(parseFloat(s.lat)); setLng(parseFloat(s.lon)); setAddrSuggs([]);
  }
  async function doGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      setLat(pos.coords.latitude); setLng(pos.coords.longitude);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
      const d = await r.json(); const a = d.address || {};
      setAddr(`${a.house_number ? a.house_number + ' ' : ''}${a.road || ''}${(a.city||a.town) ? ', '+(a.city||a.town) : ''}`);
      setGpsLoading(false);
    }, () => setGpsLoading(false), { enableHighAccuracy: true, timeout: 8000 });
  }

  // Slot finder — one best per day
  async function findSlots() {
    if (!services.length) { setErr('Choisir au moins un service.'); return; }
    setLoadingSlots(true); setErr('');
    const results: Slot[] = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let d = 0; d <= 45 && results.length < 6; d++) {
      const date = new Date(today); date.setDate(today.getDate() + d);
      const dateStr = dk(date);
      const { data: booked } = await supabase.from('bookings').select('slot_start_index,duration_hours,client_adresse_lat,client_adresse_lng').eq('date', dateStr).neq('status', 'cancelled');
      const bk = booked || [];
      let best: Slot | null = null; let bestScore = Infinity;
      for (const slot of timeSlots) {
        const occ = bk.filter(b => (b.duration_hours===2 && b.slot_start_index===slot.sort_order) || (b.duration_hours===4 && (b.slot_start_index===slot.sort_order || b.slot_start_index===slot.sort_order-1))).length;
        if (occ >= 4) continue;
        if (duration === 4) { const nx = timeSlots.find(s => s.sort_order === slot.sort_order+1); if (!nx) continue; const no = bk.filter(b => (b.duration_hours===2&&b.slot_start_index===nx.sort_order)||(b.duration_hours===4&&(b.slot_start_index===nx.sort_order||b.slot_start_index===nx.sort_order-1))).length; if (no>=4) continue; }
        let distanceKm: number | null = null; let score = 500 + slot.sort_order;
        if (lat && lng) {
          const near = bk.filter(b => b.slot_start_index===slot.sort_order && b.client_adresse_lat && b.client_adresse_lng);
          if (near.length) { const dists = near.map((b:any) => Math.sqrt(Math.pow(lat-b.client_adresse_lat,2)+Math.pow(lng-b.client_adresse_lng,2))*111); distanceKm = dists.reduce((a:number,b:number)=>a+b,0)/dists.length; score = distanceKm; }
        }
        if (score < bestScore) { bestScore = score; best = { date: dateStr, dateLabel: fmtDate(date), slot, currentJobs: occ, distanceKm }; }
      }
      if (best) results.push(best);
    }
    setSlots(results); setLoadingSlots(false);
  }

  // Signature canvas
  useEffect(() => {
    if (step !== 'sign' || !sigRef.current) return;
    const canvas = sigRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || canvas.offsetWidth || 380;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    sigCtx.current = ctx;
  }, [step]);

  function getPos(e: any, c: HTMLCanvasElement) {
    const r = c.getBoundingClientRect();
    return { x: ((e.touches?e.touches[0].clientX:e.clientX)-r.left)*(c.width/r.width), y: ((e.touches?e.touches[0].clientY:e.clientY)-r.top)*(c.height/r.height) };
  }
  function startDraw(e:any){if(!sigCtx.current||!sigRef.current)return;e.preventDefault();drawing.current=true;const p=getPos(e,sigRef.current);sigCtx.current.beginPath();sigCtx.current.moveTo(p.x,p.y);setSigEmpty(false);}
  function draw(e:any){if(!drawing.current||!sigCtx.current||!sigRef.current)return;e.preventDefault();const p=getPos(e,sigRef.current);sigCtx.current.lineTo(p.x,p.y);sigCtx.current.stroke();}
  function endDraw(){drawing.current=false;}
  function clearSig(){if(!sigCtx.current||!sigRef.current)return;sigCtx.current.clearRect(0,0,sigRef.current.width,sigRef.current.height);setSigEmpty(true);}

  // Save everything
  async function saveAll() {
    if (sigEmpty) { setErr('Signature du client requise.'); return; }
    setSaving(true); setErr('');
    const sigData = sigRef.current?.toDataURL('image/png') || '';
    const svcs = services.map(s => s==='ex-autre'&&autreDetail?`ex-autre:${autreDetail}`:s);

    try {
      // 1. Save booking
      const { data: booking, error: bErr } = await supabase.from('bookings').insert({
        date: selectedSlot!.date, slot_start: selectedSlot!.slot.heure,
        slot_start_index: selectedSlot!.slot.sort_order, duration_hours: duration,
        client_nom: nom, client_telephone: tel||null, client_email: email||null,
        client_adresse: addr, client_adresse_lat: lat, client_adresse_lng: lng,
        services: svcs, prix_avant_rabais: prixAvant?parseFloat(prixAvant):null,
        prix_final: parseFloat(prixFinal), am_pm: amPm, notes: notes||null,
        rep_id: userId, cleaner_ids: [], status: 'scheduled',
      }).select().single();
      if (bErr) throw bErr;

      // 2. Save contract
      const { data: contract, error: cErr } = await supabase.from('contracts').insert({
        contract_number: nextContractNumber, booking_id: booking.id,
        rep_id: userId, rep_name: profile.full_name,
        client_nom: nom, client_adresse: addr,
        client_telephone: tel||null, client_email: email||null,
        services: svcs, prix_avant_rabais: prixAvant?parseFloat(prixAvant):null,
        prix_final: parseFloat(prixFinal), date_service: selectedSlot!.date,
        am_pm: amPm, client_signature_data: sigData, signed_at: new Date().toISOString(),
      }).select().single();
      if (cErr) throw cErr;

      // 3. Link contract to booking
      await supabase.from('bookings').update({ contract_id: contract.id }).eq('id', booking.id);

      // 4. Update lead sale_type if came from lead
      if (fromLeadId) {
        await supabase.from('leads').update({ booking_id: booking.id, sale_type: saleType }).eq('id', fromLeadId);
      }
      if (fromPingId && !fromLeadId) {
        // Try to find matching lead by ping sr_id
        const { data: ping } = await supabase.from('pings').select('sr_id').eq('id', fromPingId).single();
        if (ping?.sr_id) {
          await supabase.from('leads').update({ booking_id: booking.id, sale_type: saleType }).eq('sr_id', ping.sr_id);
        }
      }

      // 5. Payroll record
      const { data: prev } = await supabase.from('payroll_records').select('id').eq('rep_id', userId).eq('year_of_close', new Date().getFullYear()).eq('status', 'confirmed');
      const confirmedCount = prev?.length || 0;
      const rate = confirmedCount>=450?0.25:confirmedCount>=300?0.20:confirmedCount>=150?0.175:0.15;
      await supabase.from('payroll_records').insert({ rep_id: userId, booking_id: booking.id, commission_rate: rate, commission_amount: parseFloat(prixFinal)*rate, status: 'pending', year_of_close: new Date().getFullYear() });

      // 6. Send email
      if (sendEmail && email) {
        fetch('/api/contracts/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contract_id: contract.id }) }).catch(console.warn);
      }

      setSavedData({ booking, contract });
      setStep('done');
    } catch (e: any) {
      setErr('Erreur: ' + e.message);
      console.error(e);
    }
    setSaving(false);
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done' && savedData) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>RDV + Contrat sauvegardés!</h1>
        <p style={{ color: '#6B8AA8', fontSize: 13, marginBottom: 20 }}>{nextContractNumber} · {nom} · {saleType === 'recall' ? '📞 Rappel' : '🚪 D2D'}</p>
        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          {[
            ['Client', nom],
            ['RDV', `${selectedSlot?.dateLabel} · ${selectedSlot?.slot.heure}`],
            ['Prix', `$${parseFloat(prixFinal).toLocaleString('fr-CA')}`],
            ['Contrat', nextContractNumber],
            ['Type de vente', saleType === 'recall' ? '📞 Rappel (5% comm.)' : '🚪 Porte-à-porte'],
            ['Email', sendEmail && email ? `✉️ Envoyé à ${email}` : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1E3A5F33', fontSize: 13 }}>
              <span style={{ color: '#6B8AA8' }}>{k}</span>
              <span style={{ color: 'white', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/book')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#1B9EF3', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>+ Nouveau</button>
          <button onClick={() => router.push('/dashboard')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#132D45', color: '#8BAEC8', fontWeight: 600, border: '1px solid #1E3A5F', cursor: 'pointer', fontSize: 14 }}>Dashboard</button>
        </div>
      </div>
    );
  }

  // ── SIGN ──────────────────────────────────────────────────────────────────
  if (step === 'sign') {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>
        <button onClick={() => setStep('slot')} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 14, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>← Retour</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>Signature du client</h1>
        <p style={{ color: '#6B8AA8', fontSize: 13, marginBottom: 16 }}>Remettez l'appareil au client.</p>

        {/* Summary */}
        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: 'white', marginBottom: 8 }}>{nextContractNumber}</div>
          {[
            [nom, addr],
            [`${selectedSlot?.dateLabel} ${amPm}`, selectedSlot?.slot.heure],
          ].map(([a, b], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
              <span style={{ color: '#6B8AA8' }}>{a}</span><span style={{ color: 'white' }}>{b}</span>
            </div>
          ))}
          {prixAvant && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}><span style={{ color: '#6B8AA8' }}>Avant rabais</span><span style={{ color: '#6B8AA8', textDecoration: 'line-through' }}>${parseFloat(prixAvant).toLocaleString('fr-CA')}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 3px', fontSize: 16, borderTop: '1px solid #1E3A5F33', marginTop: 4 }}>
            <span style={{ color: '#6B8AA8' }}>Prix final</span><span style={{ fontWeight: 700, color: '#22C55E', fontSize: 20 }}>${parseFloat(prixFinal).toLocaleString('fr-CA')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {services.map(id => { const s = SERVICES.find(x=>x.id===id.split(':')[0]); return s?<span key={id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#0D2E4A', color: '#1B9EF3' }}>{s.label}</span>:null; })}
          </div>
          <div style={{ marginTop: 8, padding: '5px 8px', borderRadius: 6, background: saleType==='recall'?'#1E1040':'#0F2A10', border: `1px solid ${saleType==='recall'?'#A78BFA33':'#22C55E33'}`, fontSize: 11, color: saleType==='recall'?'#A78BFA':'#22C55E' }}>
            {saleType==='recall'?'📞 Rappel — 5% commission':'🚪 Porte-à-porte'}
          </div>
        </div>

        <div style={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#4A6A88', lineHeight: 1.6 }}>
          En signant, le client reconnaît les modalités du contrat, la politique d'annulation (50% après 24h) et la garantie (7 jours).<br/>TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
        </div>

        {/* Signature pad */}
        <div style={{ border: `2px solid ${sigEmpty?'#1E3A5F':'#22C55E'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#0F1E35', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B8AA8' }}>Signature · {nom}</span>
            <button onClick={clearSig} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>Effacer</button>
          </div>
          <canvas ref={sigRef} style={{ display: 'block', width: '100%', height: 200, background: '#F9FAFB', touchAction: 'none', cursor: 'crosshair' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        </div>

        {email && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 12 }}>
          <input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} style={{ width:'auto', accentColor:'#1B9EF3' }} />
          <span style={{ fontSize: 13, color: '#8BAEC8' }}>Envoyer copie à {email}</span>
        </div>}

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={saveAll} disabled={saving||sigEmpty} style={{ width: '100%', padding: '14px', borderRadius: 12, background: saving||sigEmpty?'#0E7ACC':'#1B9EF3', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: saving||sigEmpty?'default':'pointer', opacity: sigEmpty?0.5:1, marginBottom: 24 }}>
          {saving?'Sauvegarde...':'Confirmer — Sauvegarder RDV + Contrat ✓'}
        </button>
      </div>
    );
  }

  // ── STEPS 1–3 (shared layout) ─────────────────────────────────────────────
  const stepLabels: Step[] = ['info', 'services', 'slot'];
  const stepIdx = stepLabels.indexOf(step);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['info','services','slot'] as const).map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIdx ? '#1B9EF3' : '#1E3A5F', transition: 'background .2s' }} />
        ))}
      </div>

      {/* STEP 1: Client info */}
      {step === 'info' && (<>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 16px' }}>
          {fromPingId ? '📍 Close — Nouveau RDV' : '+ Nouveau RDV'}
        </h1>

        {/* D2D / Recall toggle */}
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 8 }}>TYPE DE VENTE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['d2d','🚪 Porte-à-porte','D2D — paliers de commission (15-25%)'],['recall','📞 Rappel','5% commission (7.5% Cian)']] as const).map(([v,l,sub]) => (
              <button key={v} onClick={() => setSaleType(v)}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${saleType===v?(v==='d2d'?'#22C55E':'#A78BFA'):'#1E3A5F'}`, background: saleType===v?(v==='d2d'?'#0F2A10':'#1E1040'):'#132D45', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: saleType===v?(v==='d2d'?'#22C55E':'#A78BFA'):'#8BAEC8' }}>{l}</div>
                <div style={{ fontSize: 10, color: '#4A6A88', marginTop: 2 }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>CLIENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Nom *</label><input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Jean Tremblay" /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Téléphone</label><input type="tel" value={tel} onChange={e=>setTel(e.target.value)} placeholder="418-555-0123" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@exemple.com" /></div>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Adresse</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={addr} onChange={e=>onAddrChange(e.target.value)} placeholder="Commencer à taper..." style={{ flex: 1 }} />
              <button onClick={doGPS} disabled={gpsLoading} style={{ padding: '8px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#1B9EF3', fontSize: 16, cursor: 'pointer' }}>{gpsLoading?'…':'📍'}</button>
            </div>
            {addrSuggs.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0F1E35', border: '1px solid #1B9EF3', borderTop: 'none', borderRadius: '0 0 10px 10px', zIndex: 50, maxHeight: 160, overflowY: 'auto' }}>
              {addrSuggs.map((s,i)=><button key={i} onClick={()=>pickAddr(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #132D45', color: '#8BAEC8', fontSize: 12, cursor: 'pointer' }}>{s.display_name}</button>)}
            </div>}
          </div>
        </div>

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={() => { if (!nom.trim()) { setErr('Nom requis'); return; } setErr(''); setStep('services'); }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 24 }}>
          Continuer — Services →
        </button>
      </>)}

      {/* STEP 2: Services + pricing */}
      {step === 'services' && (<>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setStep('info')} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 14, cursor: 'pointer' }}>← Retour</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>Services & Prix</h1>
          <div style={{ width: 60 }} />
        </div>

        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1 }}>SERVICES</div>
            {services.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: duration===4?'#2E1E0A':'#0D2E4A', color: duration===4?'#F59E0B':'#1B9EF3' }}>{duration}h · {services.length} service{services.length>1?'s':''}</span>}
          </div>
          {CATS.map(cat => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3A6B8A', letterSpacing: 0.8, marginBottom: 6 }}>{cat}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {SERVICES.filter(s=>s.cat===cat).map(svc => {
                  const sel = services.includes(svc.id);
                  return <button key={svc.id} onClick={()=>setServices(prev=>prev.includes(svc.id)?prev.filter(s=>s!==svc.id):[...prev,svc.id])}
                    style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:8,border:`1px solid ${sel?'#1B9EF3':'#1E3A5F'}`,background:sel?'#0D2E4A':'#132D45',color:sel?'#1B9EF3':'#8BAEC8',fontSize:12,cursor:'pointer',textAlign:'left' }}>
                    <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${sel?'#1B9EF3':'#3A5F80'}`,background:sel?'#1B9EF3':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>{sel&&<span style={{color:'white',fontSize:9}}>✓</span>}</div>
                    <span style={{flex:1}}>{svc.label}</span>
                    {svc.min_price&&<span style={{fontSize:9,color:'#3A6B8A'}}>${svc.min_price}</span>}
                  </button>;
                })}
              </div>
            </div>
          ))}
          {services.includes('ex-autre')&&<input value={autreDetail} onChange={e=>setAutreDetail(e.target.value)} placeholder="Préciser..." style={{marginTop:6}}/>}
        </div>

        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>PRIX & DÉTAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{display:'block',fontSize:11,color:'#6B8AA8',marginBottom:4}}>Avant rabais ($)</label><input type="number" value={prixAvant} onChange={e=>setPrixAvant(e.target.value)} placeholder="ex. 350" min="0"/></div>
            <div><label style={{display:'block',fontSize:11,color:'#6B8AA8',marginBottom:4}}>Prix final ($) *</label><input type="number" value={prixFinal} onChange={e=>setPrixFinal(e.target.value)} placeholder="ex. 300" min="0" style={{borderColor:lowball.length>0?'#F59E0B':undefined}}/></div>
          </div>
          {lowball.length>0&&prixFinal&&<div style={{padding:'8px 10px',borderRadius:8,background:'#2E1A0A',border:'1px solid #F59E0B55',color:'#F59E0B',fontSize:11,marginBottom:10}}>⚠️ Prix sous le minimum — {lowball.map(w=>`${w.service} (min $${w.minimum})`).join(' · ')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={{display:'block',fontSize:11,color:'#6B8AA8',marginBottom:4}}>AM / PM</label>
              <div style={{display:'flex',gap:6}}>{(['AM','PM'] as const).map(v=><button key={v} onClick={()=>setAmPm(v)} style={{flex:1,padding:'8px',borderRadius:8,fontWeight:700,fontSize:13,border:`1px solid ${amPm===v?'#1B9EF3':'#1E3A5F'}`,background:amPm===v?'#0D2E4A':'#132D45',color:amPm===v?'#1B9EF3':'#6B8AA8',cursor:'pointer'}}>{v}</button>)}</div>
            </div>
            <div><label style={{display:'block',fontSize:11,color:'#6B8AA8',marginBottom:4}}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="2e étage, chien..."/></div>
          </div>
        </div>

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={() => { if(!services.length){setErr('Choisir au moins un service');return;} if(!prixFinal||parseFloat(prixFinal)<=0){setErr('Prix final requis');return;} setErr(''); setStep('slot'); }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 24 }}>
          Continuer — Choisir créneau →
        </button>
      </>)}

      {/* STEP 3: Slot */}
      {step === 'slot' && (<>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setStep('services')} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 14, cursor: 'pointer' }}>← Retour</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>Choisir un créneau</h1>
          <div style={{ width: 60 }} />
        </div>

        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1 }}>CRÉNEAUX DISPONIBLES</div>
              <div style={{ fontSize: 11, color: '#3A6B8A', marginTop: 2 }}>Meilleur créneau par jour · {duration}h{lat?' · Trié par distance':''}</div>
            </div>
            <button onClick={findSlots} disabled={loadingSlots} style={{ padding: '7px 14px', borderRadius: 8, background: '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
              {loadingSlots ? '...' : 'Trouver'}
            </button>
          </div>
          {slots.map((s, i) => (
            <button key={i} onClick={() => setSelectedSlot(s)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${selectedSlot===s?'#1B9EF3':'#1E3A5F'}`, background: selectedSlot===s?'#0D2E4A':'#132D45', marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{s.dateLabel}</div><div style={{ fontSize: 11, color: '#6B8AA8' }}>{s.slot.heure}</div></div>
              <div style={{ textAlign: 'right' }}>
                {s.distanceKm!==null&&<div style={{ fontSize: 12, fontWeight: 600, color: '#22C55E' }}>~{s.distanceKm.toFixed(1)} km</div>}
                <div style={{ fontSize: 11, color: '#6B8AA8' }}>{4-s.currentJobs} place{4-s.currentJobs>1?'s':''}</div>
              </div>
            </button>
          ))}
          {selectedSlot && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#0F3A2A', color: '#22C55E', border: '1px solid #22C55E44', fontSize: 13, fontWeight: 600 }}>✓ {selectedSlot.dateLabel} — {selectedSlot.slot.heure}</div>}
        </div>

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={() => { if(!selectedSlot){setErr('Choisir un créneau');return;} setErr(''); setStep('sign'); }}
                disabled={!selectedSlot}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: selectedSlot?'#1B9EF3':'#132D45', color: selectedSlot?'white':'#4A6A88', fontWeight: 700, fontSize: 15, border: `1px solid ${selectedSlot?'#1B9EF3':'#1E3A5F'}`, cursor: selectedSlot?'pointer':'default', marginBottom: 24 }}>
          Continuer — Signature →
        </button>
      </>)}
    </div>
  );
}
