'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SERVICES, type Profile, type Booking } from '@/lib/types';

interface Props {
  profile: Profile;
  userId: string;
  booking: Booking | null;
  nextContractNumber: string;
  prefillNom?: string;
  prefillAdresse?: string;
  prefillTel?: string;
  prefillEmail?: string;
}

export default function ContractClient({ profile, userId, booking, nextContractNumber, prefillNom, prefillAdresse, prefillTel, prefillEmail }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<HTMLCanvasElement>(null);
  const sigCtx = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);

  const [nom, setNom] = useState(booking?.client_nom || prefillNom || '');
  const [addr, setAddr] = useState(booking?.client_adresse || prefillAdresse || '');
  const [email, setEmail] = useState(booking?.client_email || prefillEmail || '');
  const [tel, setTel] = useState(booking?.client_telephone || prefillTel || '');
  const [services, setServices] = useState<string[]>(booking?.services || []);
  const [prixAvant, setPrixAvant] = useState(booking?.prix_avant_rabais?.toString() || '');
  const [prixFinal, setPrixFinal] = useState(booking?.prix_final?.toString() || '');
  const [dateService, setDateService] = useState(booking?.date || new Date().toISOString().split('T')[0]);
  const [amPm, setAmPm] = useState<'AM'|'PM'>(booking?.am_pm || 'AM');
  const [autreDetail, setAutreDetail] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [step, setStep] = useState<'form'|'sign'|'done'>('form');
  const [saving, setSaving] = useState(false);
  const [savedContract, setSavedContract] = useState<any>(null);
  const [sendEmailOpt, setSendEmailOpt] = useState(false);
  const [err, setErr] = useState('');

  const CATS = [...new Set(SERVICES.map(s => s.cat))];

  useEffect(() => {
    if (step !== 'sign' || !sigRef.current) return;
    const canvas = sigRef.current;
    // CRITICAL: set canvas dimensions based on actual rendered size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || canvas.offsetWidth || 380;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    sigCtx.current = ctx;
  }, [step]);

  function getPos(e: any, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  }

  function startDraw(e: any) { if (!sigCtx.current || !sigRef.current) return; e.preventDefault(); drawing.current = true; const p = getPos(e, sigRef.current); sigCtx.current.beginPath(); sigCtx.current.moveTo(p.x, p.y); setSigEmpty(false); }
  function draw(e: any) { if (!drawing.current || !sigCtx.current || !sigRef.current) return; e.preventDefault(); const p = getPos(e, sigRef.current); sigCtx.current.lineTo(p.x, p.y); sigCtx.current.stroke(); }
  function endDraw() { drawing.current = false; }
  function clearSig() { if (!sigCtx.current || !sigRef.current) return; sigCtx.current.clearRect(0, 0, sigRef.current.width, sigRef.current.height); setSigEmpty(true); }
  function toggleSvc(id: string) { setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]); }

  function validate() {
    if (!nom.trim()) return 'Nom du client requis.';
    if (!addr.trim()) return 'Adresse requise.';
    if (!services.length) return 'Sélectionner au moins un service.';
    if (!prixFinal || parseFloat(prixFinal) <= 0) return 'Prix final requis.';
    return null;
  }

  async function save() {
    if (sigEmpty) { setErr('Signature du client requise.'); return; }
    setSaving(true); setErr('');

    const sigData = sigRef.current?.toDataURL('image/png') || '';
    const svcs = services.map(s => s === 'ex-autre' && autreDetail ? `ex-autre:${autreDetail}` : s);

    // DIRECT INSERT — no relying on booking relationship
    const insertData = {
      contract_number: nextContractNumber,
      booking_id: booking?.id || null,
      rep_id: userId,
      rep_name: profile.full_name,
      client_nom: nom.trim(),
      client_adresse: addr.trim(),
      client_telephone: tel.trim() || null,
      client_email: email.trim() || null,
      services: svcs,
      prix_avant_rabais: prixAvant ? parseFloat(prixAvant) : null,
      prix_final: parseFloat(prixFinal),
      date_service: dateService,
      am_pm: amPm,
      client_signature_data: sigData,
      signed_at: new Date().toISOString(),
    };

    const { data: contract, error } = await supabase
      .from('contracts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Contract save error:', error);
      setErr(`Erreur sauvegarde: ${error.message}`);
      setSaving(false);
      return;
    }

    // Update booking with contract_id
    if (booking?.id && contract) {
      await supabase.from('bookings').update({ contract_id: contract.id }).eq('id', booking.id);
    }

    // Send email if opted in
    if (sendEmailOpt && email.trim() && contract) {
      try {
        const emailRes = await fetch('/api/contracts/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contract_id: contract.id }),
        });
        if (!emailRes.ok) {
          console.warn('Email send failed:', await emailRes.text());
        }
      } catch (e) {
        console.warn('Email send error:', e);
      }
    }

    setSavedContract(contract);
    setSaving(false);
    setStep('done');
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done' && savedContract) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Contrat signé!</h1>
        <p style={{ color: '#6B8AA8', fontSize: 13, marginBottom: 24 }}>{savedContract.contract_number} · {nom}</p>
        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          {[['Client', nom], ['Prix', `$${parseFloat(prixFinal).toLocaleString('fr-CA')}`],
            ['Date', `${new Date(dateService + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })} ${amPm}`],
            ['Vendeur', profile.full_name],
            ['Email', sendEmailOpt && email ? `✉️ Envoyé à ${email}` : '—']
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1E3A5F33', fontSize: 13 }}>
              <span style={{ color: '#6B8AA8' }}>{k}</span>
              <span style={{ color: 'white', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/book')} style={{ padding: '12px', borderRadius: 12, background: '#1B9EF3', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>+ Nouveau RDV</button>
          <button onClick={() => router.push('/dashboard')} style={{ padding: '12px', borderRadius: 12, background: '#132D45', color: '#8BAEC8', fontWeight: 600, border: '1px solid #1E3A5F', cursor: 'pointer', fontSize: 14 }}>Tableau de bord</button>
        </div>
      </div>
    );
  }

  // ── SIGN ──────────────────────────────────────────────────────────────────
  if (step === 'sign') {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>
        <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 14, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>← Modifier</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>Signature du client</h1>
        <p style={{ color: '#6B8AA8', fontSize: 13, marginBottom: 16 }}>Remettez l'appareil au client pour signer.</p>

        {/* Summary */}
        <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: 'white', marginBottom: 10, fontSize: 14 }}>Résumé — {nextContractNumber}</div>
          {[['Client', nom], ['Adresse', addr],
            ['Date', `${new Date(dateService + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })} ${amPm}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1E3A5F33', fontSize: 13 }}>
              <span style={{ color: '#6B8AA8' }}>{k}</span>
              <span style={{ color: 'white', maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
          {prixAvant && prixAvant !== prixFinal && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1E3A5F33', fontSize: 13 }}>
              <span style={{ color: '#6B8AA8' }}>Avant rabais</span>
              <span style={{ color: '#6B8AA8', textDecoration: 'line-through' }}>${parseFloat(prixAvant).toLocaleString('fr-CA')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: 15 }}>
            <span style={{ color: '#6B8AA8' }}>Prix final</span>
            <span style={{ fontWeight: 700, color: '#22C55E', fontSize: 18 }}>${parseFloat(prixFinal).toLocaleString('fr-CA')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {services.map(id => { const s = SERVICES.find(x => x.id === id.split(':')[0]); return s ? <span key={id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#0D2E4A', color: '#1B9EF3' }}>{s.label}</span> : null; })}
          </div>
        </div>

        {/* Legal */}
        <div style={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 11, color: '#4A6A88', lineHeight: 1.6 }}>
          En signant, le client reconnaît avoir lu et accepté les modalités du contrat, incluant la politique d'annulation (50% après 24h) et la garantie de satisfaction (7 jours).<br/>
          TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
        </div>

        {/* Signature pad */}
        <div style={{ border: `2px solid ${sigEmpty ? '#1E3A5F' : '#22C55E'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#0F1E35', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B8AA8' }}>Signature · {nom}</span>
            <button onClick={clearSig} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>Effacer</button>
          </div>
          <canvas
            ref={sigRef}
            style={{ display: 'block', width: '100%', height: 200, background: '#F9FAFB', touchAction: 'none', cursor: 'crosshair' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
        </div>

        {/* Email option */}
        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 14 }}>
            <input type="checkbox" id="send-email" checked={sendEmailOpt} onChange={e => setSendEmailOpt(e.target.checked)} style={{ width: 'auto', accentColor: '#1B9EF3' }} />
            <label htmlFor="send-email" style={{ fontSize: 13, color: '#8BAEC8', cursor: 'pointer' }}>Envoyer copie à {email}</label>
          </div>
        )}

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}

        <button onClick={save} disabled={saving || sigEmpty}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: saving || sigEmpty ? '#0E7ACC' : '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: saving || sigEmpty ? 'default' : 'pointer', opacity: sigEmpty ? 0.5 : 1, marginBottom: 24 }}>
          {saving ? 'Sauvegarde...' : 'Confirmer et sauvegarder ✓'}
        </button>
      </div>
    );
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 16 }}>Nouveau contrat</h1>
      {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515', fontSize: 12, marginBottom: 12 }}>{err}</div>}

      {/* Client */}
      <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>CLIENT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Nom *</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Jean Tremblay" /></div>
          <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Téléphone</label><input type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="418-555-0123" /></div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Adresse *</label><input value={addr} onChange={e => setAddr(e.target.value)} placeholder="123 Rue Principale, Québec" /></div>
        <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@exemple.com" /></div>
      </div>

      {/* Services */}
      <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>SERVICES</div>
        {CATS.map(cat => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3A6B8A', letterSpacing: 0.8, marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SERVICES.filter(s => s.cat === cat).map(svc => {
                const sel = services.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleSvc(svc.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? '#1B9EF3' : '#1E3A5F'}`, background: sel ? '#0D2E4A' : '#132D45', color: sel ? '#1B9EF3' : '#8BAEC8', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sel ? '#1B9EF3' : '#3A5F80'}`, background: sel ? '#1B9EF3' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <span style={{ color: 'white', fontSize: 9, lineHeight: 1 }}>✓</span>}
                    </div>
                    {svc.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {services.includes('ex-autre') && <input value={autreDetail} onChange={e => setAutreDetail(e.target.value)} placeholder="Préciser..." style={{ marginTop: 6 }} />}
      </div>

      {/* Pricing */}
      <div style={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>PRIX & DATE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Avant rabais ($)</label><input type="number" value={prixAvant} onChange={e => setPrixAvant(e.target.value)} placeholder="ex. 350" min="0" /></div>
          <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Prix final ($) *</label><input type="number" value={prixFinal} onChange={e => setPrixFinal(e.target.value)} placeholder="ex. 300" min="0" /></div>
          <div><label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>Date du service</label><input type="date" value={dateService} onChange={e => setDateService(e.target.value)} /></div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 4 }}>AM / PM</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['AM','PM'] as const).map(v => (
                <button key={v} onClick={() => setAmPm(v)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontWeight: 700, fontSize: 13, border: `1px solid ${amPm === v ? '#1B9EF3' : '#1E3A5F'}`, background: amPm === v ? '#0D2E4A' : '#132D45', color: amPm === v ? '#1B9EF3' : '#6B8AA8', cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: '#132D45', fontSize: 11, color: '#3A6B8A' }}>
          Vendeur: <strong style={{ color: '#1B9EF3' }}>{profile.full_name}</strong> · {nextContractNumber}<br/>
          TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
        </div>
      </div>

      <button onClick={() => { const e = validate(); if (e) { setErr(e); return; } setErr(''); setStep('sign'); }}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 24 }}>
        Procéder à la signature →
      </button>
    </div>
  );
}
