'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SERVICES, is4HourJob, checkLowball, type Profile, type TimeSlot } from '@/lib/types';

interface Props {
  profile: Profile;
  timeSlots: TimeSlot[];
  userId: string;
  prefillAddress?: string;
  prefillLat?: number;
  prefillLng?: number;
  prefillName?: string;
  prefillPhone?: string;
  prefillEmail?: string;
  fromPingId?: string;
}

interface SlotSuggestion {
  date: string;
  dateLabel: string;
  slot: TimeSlot;
  currentJobs: number;
  distanceKm: number | null;
}

const SERVICE_CATS = [...new Set(SERVICES.map(s => s.cat))];

function dateKey(d: Date) { return d.toISOString().split('T')[0]; }
function fmtDate(d: Date) {
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function BookClient({ profile, timeSlots, userId, prefillAddress, prefillLat, prefillLng, prefillName, prefillPhone, prefillEmail, fromPingId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [clientNom, setClientNom] = useState(prefillName || '');
  const [clientTel, setClientTel] = useState(prefillPhone || '');
  const [clientEmail, setClientEmail] = useState(prefillEmail || '');
  const [clientAddr, setClientAddr] = useState(prefillAddress || '');
  const [clientLat, setClientLat] = useState<number | null>(prefillLat || null);
  const [clientLng, setClientLng] = useState<number | null>(prefillLng || null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [autreDetail, setAutreDetail] = useState('');
  const [prixAvant, setPrixAvant] = useState('');
  const [prixFinal, setPrixFinal] = useState('');
  const [notes, setNotes] = useState('');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addrSuggestions, setAddrSuggestions] = useState<any[]>([]);
  const [acTimer, setAcTimer] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const duration = is4HourJob(selectedServices) ? 4 : 2;
  const lowball = prixFinal ? checkLowball(selectedServices, parseFloat(prixFinal)) : [];
  const minimumTotal = selectedServices.reduce((sum, id) => {
    const svc = SERVICES.find(s => s.id === id.split(':')[0]);
    return sum + (svc?.min_price || 0);
  }, 0);

  function toggleService(id: string) {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function onAddrChange(val: string) {
    setClientAddr(val);
    clearTimeout(acTimer);
    if (val.length < 3) { setAddrSuggestions([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ', Québec, Canada')}&format=json&limit=5&addressdetails=1`);
      const data = await res.json();
      setAddrSuggestions(data);
    }, 400);
    setAcTimer(t);
  }

  function selectAddr(item: any) {
    const a = item.address || {};
    const num = a.house_number ? a.house_number + ' ' : '';
    const street = a.road || a.pedestrian || '';
    const city = a.city || a.town || a.village || '';
    setClientAddr(`${num}${street}${city ? ', ' + city : ''}`);
    setClientLat(parseFloat(item.lat));
    setClientLng(parseFloat(item.lon));
    setAddrSuggestions([]);
  }

  async function doGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setClientLat(lat); setClientLng(lng);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const d = await r.json();
        const a = d.address || {};
        const num = a.house_number ? a.house_number + ' ' : '';
        const street = a.road || '';
        const city = a.city || a.town || a.village || '';
        setClientAddr(`${num}${street}${city ? ', ' + city : ''}`);
      } catch {}
      setGpsLoading(false);
    }, () => setGpsLoading(false), { enableHighAccuracy: true, timeout: 10000 });
  }

  // FIXED: one best slot per day, sorted by distance to current GPS
  async function findSlots() {
    if (!selectedServices.length) { setError('Choisir au moins un service.'); return; }
    setLoadingSlots(true);
    setError('');
    const results: SlotSuggestion[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset <= 45 && results.length < 6; dayOffset++) {
      const d = new Date(today); d.setDate(today.getDate() + dayOffset);
      const dk = dateKey(d);

      const { data: dayBookings } = await supabase
        .from('bookings')
        .select('slot_start_index, duration_hours, client_adresse_lat, client_adresse_lng')
        .eq('date', dk)
        .neq('status', 'cancelled');

      const booked = dayBookings || [];

      // Find the SINGLE best slot for this day
      let bestSlot: SlotSuggestion | null = null;
      let bestScore = Infinity;

      for (const slot of timeSlots) {
        // How many jobs already in this slot?
        const occupying = booked.filter(b =>
          (b.duration_hours === 2 && b.slot_start_index === slot.sort_order) ||
          (b.duration_hours === 4 && (b.slot_start_index === slot.sort_order || b.slot_start_index === slot.sort_order - 1))
        ).length;

        if (occupying >= 4) continue; // full

        // For 4h: check next slot too
        if (duration === 4) {
          const next = timeSlots.find(s => s.sort_order === slot.sort_order + 1);
          if (!next) continue;
          const nextOcc = booked.filter(b =>
            (b.duration_hours === 2 && b.slot_start_index === next.sort_order) ||
            (b.duration_hours === 4 && (b.slot_start_index === next.sort_order || b.slot_start_index === next.sort_order - 1))
          ).length;
          if (nextOcc >= 4) continue;
        }

        // Distance score — lower is better
        let distanceKm: number | null = null;
        let score = 1000 + slot.sort_order; // default: prefer earlier slots

        if (clientLat && clientLng) {
          const nearBookings = booked.filter(b =>
            b.slot_start_index === slot.sort_order &&
            b.client_adresse_lat && b.client_adresse_lng
          );
          if (nearBookings.length > 0) {
            const dists = nearBookings.map((b: any) => {
              const dlat = clientLat - b.client_adresse_lat;
              const dlng = clientLng - b.client_adresse_lng;
              return Math.sqrt(dlat * dlat + dlng * dlng) * 111;
            });
            distanceKm = dists.reduce((a: number, b: number) => a + b, 0) / dists.length;
            score = distanceKm; // closer = better score
          } else {
            // Empty slot on this day — score it as "far" but prefer earlier
            score = 500 + slot.sort_order;
          }
        }

        if (score < bestScore) {
          bestScore = score;
          bestSlot = { date: dk, dateLabel: fmtDate(d), slot, currentJobs: occupying, distanceKm };
        }
      }

      if (bestSlot) results.push(bestSlot);
    }

    setSuggestions(results);
    setLoadingSlots(false);
  }

  async function saveBooking() {
    if (!clientNom || !selectedSlot || !selectedServices.length || !prixFinal) {
      setError('Remplir: nom client, créneau, services et prix final.');
      return;
    }
    setSaving(true); setError('');

    const svcs = selectedServices.map(s => s === 'ex-autre' && autreDetail ? `ex-autre:${autreDetail}` : s);

    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      date: selectedSlot.date, slot_start: selectedSlot.slot.heure,
      slot_start_index: selectedSlot.slot.sort_order, duration_hours: duration,
      client_nom: clientNom, client_telephone: clientTel || null,
      client_email: clientEmail || null, client_adresse: clientAddr,
      client_adresse_lat: clientLat, client_adresse_lng: clientLng,
      services: svcs, prix_avant_rabais: prixAvant ? parseFloat(prixAvant) : null,
      prix_final: parseFloat(prixFinal), am_pm: amPm, notes: notes || null,
      rep_id: userId, cleaner_ids: [], status: 'scheduled',
    }).select().single();

    if (bErr) { setError('Erreur: ' + bErr.message); setSaving(false); return; }

    // Create payroll record
    if (booking) {
      const year = new Date().getFullYear();
      const { data: prev } = await supabase.from('payroll_records')
        .select('id').eq('rep_id', userId).eq('year_of_close', year).eq('status', 'confirmed');
      const count = prev?.length || 0;
      const rate = count >= 450 ? 0.25 : count >= 300 ? 0.20 : count >= 150 ? 0.175 : 0.15;
      await supabase.from('payroll_records').insert({
        rep_id: userId, booking_id: booking.id,
        amount_pre_tax: parseFloat(prixFinal),
        commission_rate: rate, commission_amount: parseFloat(prixFinal) * rate,
        status: 'pending', year_of_close: year,
      });
    }

    setSaving(false);
    // Redirect to contract page with booking info pre-filled
    router.push(`/contract?booking_id=${booking.id}`);
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Nouveau rendez-vous</h1>
        {fromPingId && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#22C55E22', color: '#22C55E' }}>
            Depuis un close 📍
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left */}
        <div className="space-y-4">
          {/* Client */}
          <div className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Client</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Nom *</label>
                <input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Jean Tremblay" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Téléphone</label>
                <input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} placeholder="418-555-0123" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Email</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@exemple.com" />
            </div>
            <div className="relative">
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Adresse</label>
              <div className="flex gap-2">
                <input value={clientAddr} onChange={e => onAddrChange(e.target.value)} placeholder="Commencer à taper..." className="flex-1" />
                <button onClick={doGPS} disabled={gpsLoading}
                        className="px-3 py-2 rounded-lg text-sm font-bold shrink-0"
                        style={{ background: '#132D45', border: '1px solid #1E3A5F', color: '#1B9EF3' }}>
                  {gpsLoading ? '...' : '📍'}
                </button>
              </div>
              {addrSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 rounded-b-lg border border-t-0 z-50 max-h-40 overflow-y-auto"
                     style={{ background: '#0F1E35', borderColor: '#1B9EF3' }}>
                  {addrSuggestions.map((s, i) => (
                    <button key={i} onClick={() => selectAddr(s)}
                            className="w-full text-left px-3 py-2 text-xs border-b"
                            style={{ borderColor: '#132D45', color: '#8BAEC8' }}>
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prix */}
          <div className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Prix & détails</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Avant rabais ($)</label>
                <input type="number" value={prixAvant} onChange={e => setPrixAvant(e.target.value)} placeholder="ex. 350" min="0" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Prix final ($) *</label>
                <input type="number" value={prixFinal} onChange={e => setPrixFinal(e.target.value)} placeholder="ex. 300" min="0"
                       style={{ borderColor: lowball.length > 0 ? '#F59E0B' : undefined }} />
              </div>
            </div>

            {/* Lowball warning */}
            {lowball.length > 0 && prixFinal && (
              <div className="mb-3 px-3 py-2 rounded-xl text-xs" style={{ background: '#2E1A0A', border: '1px solid #F59E0B55', color: '#F59E0B' }}>
                ⚠️ Prix sous le minimum — Total services: <strong>${minimumTotal}</strong>
                <div className="mt-1" style={{ color: '#D97706' }}>
                  {lowball.map(w => `${w.service} (min. $${w.minimum})`).join(' · ')}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>AM / PM</label>
                <div className="flex gap-2">
                  {(['AM', 'PM'] as const).map(v => (
                    <button key={v} onClick={() => setAmPm(v)}
                            className="flex-1 py-2 rounded-lg text-sm font-bold border transition-all"
                            style={{
                              background: amPm === v ? '#0D2E4A' : '#132D45',
                              borderColor: amPm === v ? '#1B9EF3' : '#1E3A5F',
                              color: amPm === v ? '#1B9EF3' : '#6B8AA8',
                            }}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex. 2e étage, chien..." />
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Services */}
          <div className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6B8AA8' }}>Services</div>
              {selectedServices.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: duration === 4 ? '#2E1E0A' : '#0D2E4A', color: duration === 4 ? '#F59E0B' : '#1B9EF3' }}>
                  {duration}h · {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {SERVICE_CATS.map(cat => (
              <div key={cat} className="mb-3">
                <div className="text-xs font-bold mb-2" style={{ color: '#3A6B8A', letterSpacing: '0.8px' }}>{cat}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SERVICES.filter(s => s.cat === cat).map(svc => {
                    const sel = selectedServices.includes(svc.id);
                    return (
                      <button key={svc.id} onClick={() => toggleService(svc.id)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left"
                              style={{
                                background: sel ? '#0D2E4A' : '#132D45',
                                borderColor: sel ? '#1B9EF3' : '#1E3A5F',
                                color: sel ? '#1B9EF3' : '#8BAEC8',
                              }}>
                        <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0"
                             style={{ borderColor: sel ? '#1B9EF3' : '#3A5F80', background: sel ? '#1B9EF3' : 'transparent' }}>
                          {sel && <span className="text-white" style={{ fontSize: 9 }}>✓</span>}
                        </div>
                        <span className="truncate">{svc.label}</span>
                        {svc.min_price && <span className="ml-auto shrink-0" style={{ color: '#3A6B8A', fontSize: 10 }}>${svc.min_price}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {selectedServices.includes('ex-autre') && (
              <input value={autreDetail} onChange={e => setAutreDetail(e.target.value)} placeholder="Préciser..." className="mt-2" />
            )}
          </div>

          {/* Slot finder */}
          <div className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6B8AA8' }}>Créneaux disponibles</div>
                <div className="text-xs mt-0.5" style={{ color: '#3A6B8A' }}>
                  Meilleur créneau par journée · {duration}h
                  {clientLat ? ' · Trié par distance' : ''}
                </div>
              </div>
              <button onClick={findSlots} disabled={loadingSlots}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                      style={{ background: loadingSlots ? '#0E7ACC' : '#1B9EF3' }}>
                {loadingSlots ? '...' : 'Trouver'}
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setSelectedSlot(s)}
                          className="w-full flex items-center justify-between px-3 py-3 rounded-xl border text-left"
                          style={{
                            background: selectedSlot === s ? '#0D2E4A' : '#132D45',
                            borderColor: selectedSlot === s ? '#1B9EF3' : '#1E3A5F',
                          }}>
                    <div>
                      <div className="text-sm font-semibold text-white">{s.dateLabel}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#6B8AA8' }}>{s.slot.heure}</div>
                    </div>
                    <div className="text-right">
                      {s.distanceKm !== null ? (
                        <div className="text-xs font-semibold" style={{ color: '#22C55E' }}>~{s.distanceKm.toFixed(1)} km</div>
                      ) : (
                        <div className="text-xs" style={{ color: '#4A6A88' }}>Journée libre</div>
                      )}
                      <div className="text-xs" style={{ color: '#6B8AA8' }}>{4 - s.currentJobs} place{4 - s.currentJobs > 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedSlot && (
              <div className="mt-3 px-3 py-2 rounded-xl text-sm font-semibold"
                   style={{ background: '#0F3A2A', color: '#22C55E', border: '1px solid #22C55E44' }}>
                ✓ {selectedSlot.dateLabel} — {selectedSlot.slot.heure}
              </div>
            )}
          </div>
        </div>
      </div>

      <button onClick={saveBooking} disabled={saving}
              className="w-full mt-4 py-4 rounded-2xl font-bold text-white text-base mb-8"
              style={{ background: saving ? '#0E7ACC' : '#1B9EF3' }}>
        {saving ? 'Sauvegarde...' : 'Confirmer → Aller au contrat'}
      </button>
    </div>
  );
}
