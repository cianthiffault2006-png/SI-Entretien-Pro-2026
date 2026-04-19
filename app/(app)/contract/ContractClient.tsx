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
  // Prefill from URL params (leads page, direct link)
  prefillNom?: string;
  prefillAdresse?: string;
  prefillTel?: string;
  prefillEmail?: string;
}

export default function ContractClient({ profile, userId, booking, nextContractNumber, prefillNom, prefillAdresse, prefillTel, prefillEmail }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);

  // Pre-fill priority: booking > URL params > empty
  const [clientNom,   setClientNom]   = useState(booking?.client_nom       || prefillNom     || '');
  const [clientAddr,  setClientAddr]  = useState(booking?.client_adresse   || prefillAdresse || '');
  const [clientEmail, setClientEmail] = useState(booking?.client_email     || prefillEmail   || '');
  const [clientTel,   setClientTel]   = useState(booking?.client_telephone || prefillTel     || '');
  const [services,    setServices]    = useState<string[]>(booking?.services || []);
  const [prixAvant,   setPrixAvant]   = useState(booking?.prix_avant_rabais?.toString() || '');
  const [prixFinal,   setPrixFinal]   = useState(booking?.prix_final?.toString() || '');
  const [dateService, setDateService] = useState(booking?.date || new Date().toISOString().split('T')[0]);
  const [amPm,        setAmPm]        = useState<'AM' | 'PM'>(booking?.am_pm || 'AM');
  const [autreDetail, setAutreDetail] = useState('');
  const [sigEmpty,    setSigEmpty]    = useState(true);
  const [step,        setStep]        = useState<'form' | 'sign' | 'done'>('form');
  const [saving,      setSaving]      = useState(false);
  const [savedContract, setSavedContract] = useState<any>(null);
  const [err,         setErr]         = useState('');
  const [sendEmail,   setSendEmail]   = useState(false);

  const SERVICE_CATS = [...new Set(SERVICES.map(s => s.cat))];

  useEffect(() => {
    if (step !== 'sign' || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    sigCtxRef.current = ctx;
  }, [step]);

  function getPos(e: any, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDraw(e: any) {
    if (!sigCtxRef.current || !sigCanvasRef.current) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e, sigCanvasRef.current);
    sigCtxRef.current.beginPath();
    sigCtxRef.current.moveTo(pos.x, pos.y);
    setSigEmpty(false);
  }

  function draw(e: any) {
    if (!isDrawing.current || !sigCtxRef.current || !sigCanvasRef.current) return;
    e.preventDefault();
    const pos = getPos(e, sigCanvasRef.current);
    sigCtxRef.current.lineTo(pos.x, pos.y);
    sigCtxRef.current.stroke();
  }

  function endDraw() { isDrawing.current = false; }

  function clearSig() {
    if (!sigCtxRef.current || !sigCanvasRef.current) return;
    sigCtxRef.current.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
    setSigEmpty(true);
  }

  function toggleService(id: string) {
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function validateForm() {
    if (!clientNom) return 'Nom du client requis.';
    if (!clientAddr) return 'Adresse requise.';
    if (!services.length) return 'Sélectionner au moins un service.';
    if (!prixFinal) return 'Prix final requis.';
    return null;
  }

  async function generateAndSave() {
    if (sigEmpty) { setErr('La signature du client est requise.'); return; }
    setSaving(true); setErr('');
    const sigData = sigCanvasRef.current?.toDataURL('image/png') || '';
    const svcsToSave = services.map(s => s === 'ex-autre' && autreDetail ? `ex-autre:${autreDetail}` : s);

    const { data: contract, error } = await supabase.from('contracts').insert({
      contract_number: nextContractNumber,
      booking_id: booking?.id || null,
      rep_id: userId, rep_name: profile.full_name,
      client_nom: clientNom, client_adresse: clientAddr,
      client_telephone: clientTel || null, client_email: clientEmail || null,
      services: svcsToSave,
      prix_avant_rabais: prixAvant ? parseFloat(prixAvant) : null,
      prix_final: parseFloat(prixFinal),
      date_service: dateService, am_pm: amPm,
      client_signature_data: sigData, signed_at: new Date().toISOString(),
    }).select().single();

    if (error) { setErr('Erreur: ' + error.message); setSaving(false); return; }

    if (booking?.id) {
      await supabase.from('bookings').update({ contract_id: contract.id }).eq('id', booking.id);
    }

    if (sendEmail && clientEmail && contract) {
      await fetch('/api/contracts/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contract.id }),
      });
    }

    setSavedContract(contract); setSaving(false); setStep('done');
  }

  if (step === 'done' && savedContract) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">Contrat signé!</h1>
        <p className="text-sm mb-6" style={{ color: '#6B8AA8' }}>{savedContract.contract_number} · {clientNom}</p>
        <div className="rounded-2xl p-5 border mb-6 text-left" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          <div className="space-y-2 text-sm">
            {[['Client', clientNom], ['Prix final', `$${parseFloat(prixFinal).toLocaleString('fr-CA')}`],
              ['Date', `${new Date(dateService + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })} ${amPm}`],
              ['Vendeur', profile.full_name]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span style={{ color: '#6B8AA8' }}>{k}</span>
                <span className="text-white font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <button onClick={() => router.push('/book')} className="w-full py-3 rounded-xl font-bold text-white" style={{ background: '#1B9EF3' }}>Nouveau RDV</button>
          <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl font-semibold border" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>Tableau de bord</button>
        </div>
      </div>
    );
  }

  if (step === 'sign') {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <button onClick={() => setStep('form')} className="flex items-center gap-2 mb-4 text-sm" style={{ color: '#6B8AA8' }}>← Modifier</button>
        <h1 className="text-xl font-bold text-white mb-2">Signature du client</h1>
        <p className="text-sm mb-4" style={{ color: '#6B8AA8' }}>Remettez le téléphone au client pour qu'il signe.</p>

        <div className="rounded-2xl p-4 border mb-4 text-sm" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          <div className="font-bold text-white mb-3">Résumé — {nextContractNumber}</div>
          <div className="space-y-1.5">
            {[['Client', clientNom], ['Adresse', clientAddr],
              ['Date', `${new Date(dateService + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })} ${amPm}`]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span style={{ color: '#6B8AA8' }}>{k}</span>
                <span className="text-white text-right max-w-xs truncate">{v}</span>
              </div>
            ))}
            {prixAvant && prixAvant !== prixFinal && (
              <div className="flex justify-between">
                <span style={{ color: '#6B8AA8' }}>Avant rabais</span>
                <span style={{ color: '#6B8AA8', textDecoration: 'line-through' }}>${parseFloat(prixAvant).toLocaleString('fr-CA')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: '#6B8AA8' }}>Prix final</span>
              <span className="font-bold text-lg" style={{ color: '#22C55E' }}>${parseFloat(prixFinal).toLocaleString('fr-CA')}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: '#132D45' }}>
            <div className="flex flex-wrap gap-1">
              {services.map(id => {
                const svc = SERVICES.find(s => s.id === id.split(':')[0]);
                return <span key={id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#0D2E4A', color: '#1B9EF3' }}>{svc?.label || id}</span>;
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-3 border mb-4 text-xs" style={{ background: '#0A1628', borderColor: '#1E3A5F', color: '#3A6B8A' }}>
          En signant, le client reconnaît avoir lu et accepté toutes les modalités du contrat, incluant la politique d'annulation (50% après 24h) et la garantie de satisfaction (7 jours).<br/><br/>
          TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
        </div>

        <div className="rounded-2xl border mb-4 overflow-hidden" style={{ borderColor: sigEmpty ? '#1E3A5F' : '#22C55E' }}>
          <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#0F1E35' }}>
            <span className="text-xs font-semibold" style={{ color: '#6B8AA8' }}>Signature · {clientNom}</span>
            <button onClick={clearSig} className="text-xs" style={{ color: '#EF4444' }}>Effacer</button>
          </div>
          <canvas ref={sigCanvasRef}
            className="w-full block bg-white"
            style={{ height: 180, touchAction: 'none', background: '#F9FAFB' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        </div>

        {clientEmail && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <input type="checkbox" id="send-email" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ width: 'auto', accentColor: '#1B9EF3' }} />
            <label htmlFor="send-email" className="text-sm cursor-pointer" style={{ color: '#8BAEC8' }}>Envoyer une copie à {clientEmail}</label>
          </div>
        )}

        {err && <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>{err}</div>}

        <button onClick={generateAndSave} disabled={saving || sigEmpty}
                className="w-full py-4 rounded-2xl font-bold text-white text-base mb-8"
                style={{ background: (saving || sigEmpty) ? '#0E7ACC' : '#1B9EF3', opacity: sigEmpty ? 0.5 : 1 }}>
          {saving ? 'Sauvegarde...' : 'Confirmer et sauvegarder le contrat'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-6">Nouveau contrat</h1>
      {err && <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>{err}</div>}

      <div className="rounded-2xl p-4 border mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Informations client</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Nom *</label><input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Jean Tremblay" /></div>
          <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Téléphone</label><input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} placeholder="418-555-0123" /></div>
        </div>
        <div className="mb-3"><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Adresse *</label><input value={clientAddr} onChange={e => setClientAddr(e.target.value)} placeholder="123 Rue Principale, Québec" /></div>
        <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Email</label><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@exemple.com" /></div>
      </div>

      <div className="rounded-2xl p-4 border mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Services</div>
        {SERVICE_CATS.map(cat => (
          <div key={cat} className="mb-3">
            <div className="text-xs font-bold mb-2" style={{ color: '#3A6B8A' }}>{cat}</div>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.filter(s => s.cat === cat).map(svc => {
                const sel = services.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left"
                          style={{ background: sel ? '#0D2E4A' : '#132D45', borderColor: sel ? '#1B9EF3' : '#1E3A5F', color: sel ? '#1B9EF3' : '#8BAEC8' }}>
                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                         style={{ borderColor: sel ? '#1B9EF3' : '#3A5F80', background: sel ? '#1B9EF3' : 'transparent' }}>
                      {sel && <span className="text-white" style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    {svc.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {services.includes('ex-autre') && <input value={autreDetail} onChange={e => setAutreDetail(e.target.value)} placeholder="Préciser..." className="mt-2" />}
      </div>

      <div className="rounded-2xl p-4 border mb-6" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Prix & date</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Avant rabais ($)</label><input type="number" value={prixAvant} onChange={e => setPrixAvant(e.target.value)} placeholder="ex. 350" min="0" /></div>
          <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Prix final ($) *</label><input type="number" value={prixFinal} onChange={e => setPrixFinal(e.target.value)} placeholder="ex. 300" min="0" /></div>
          <div><label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Date du service *</label><input type="date" value={dateService} onChange={e => setDateService(e.target.value)} /></div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>AM / PM</label>
            <div className="flex gap-2">
              {(['AM', 'PM'] as const).map(v => (
                <button key={v} onClick={() => setAmPm(v)} className="flex-1 py-2.5 rounded-lg text-sm font-bold border"
                        style={{ background: amPm === v ? '#0D2E4A' : '#132D45', borderColor: amPm === v ? '#1B9EF3' : '#1E3A5F', color: amPm === v ? '#1B9EF3' : '#6B8AA8' }}>{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#132D45', color: '#3A6B8A' }}>
          Vendeur: <strong style={{ color: '#1B9EF3' }}>{profile.full_name}</strong> · {nextContractNumber}<br/>
          TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
        </div>
      </div>

      <button onClick={() => { const e = validateForm(); if (e) { setErr(e); return; } setErr(''); setStep('sign'); }}
              className="w-full py-4 rounded-2xl font-bold text-white text-base mb-8"
              style={{ background: '#1B9EF3' }}>
        Procéder à la signature →
      </button>
    </div>
  );
}
