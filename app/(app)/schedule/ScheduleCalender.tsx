'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile, Booking, TimeSlot } from '@/lib/types';
import Link from 'next/link';

interface Props {
  profile: Profile; userId: string;
  initialBookings: Booking[]; timeSlots: TimeSlot[];
  syncStatus?: { lastSrSync: string; jobberBookings: number };
  allProfiles?: { id: string; full_name: string; role: string }[];
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function getWeekDates(offset: number) {
  const t = new Date(); t.setHours(0,0,0,0);
  const sun = new Date(t); sun.setDate(t.getDate() - t.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return d; });
}

function dk(d: Date) { return d.toISOString().split('T')[0]; }
function isToday(d: Date) { const t = new Date(); return d.toDateString() === t.toDateString(); }

export default function ScheduleCalendar({ profile, userId, initialBookings, timeSlots, syncStatus, allProfiles }: Props) {
  const supabase = createClient();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<'rdv' | 'team'>('rdv');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'scheduled'|'completed'|'cancelled'>('scheduled');
  const [saving, setSaving] = useState(false);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const isManager = profile.role === 'admin' || profile.role === 'manager';

  const weekDates = getWeekDates(weekOffset);
  const [nowMinutes, setNowMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });

  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const start = dk(weekDates[0]); const end = dk(weekDates[6]);
    supabase.from('bookings').select('*').gte('date', start).lte('date', end).neq('status', 'cancelled')
      .then(({ data }) => { if (data) setBookings(prev => [...prev.filter(b => b.date < start || b.date > end), ...data]); });
  }, [weekOffset]);

  const weekBookings = bookings.filter(b => b.date >= dk(weekDates[0]) && b.date <= dk(weekDates[6]));

  function bookingsFor(date: Date, slotOrder: number) {
    return weekBookings.filter(b =>
      b.date === dk(date) && (
        b.slot_start_index === slotOrder ||
        (b.duration_hours === 4 && b.slot_start_index === slotOrder - 1)
      )
    );
  }

  const SLOT_H = 80; // px per 2h slot
  const firstHour = timeSlots[0] ? parseInt(timeSlots[0].heure) : 8;
  const nowY = ((nowMinutes - firstHour * 60) / 120) * SLOT_H;
  const todayCol = weekDates.findIndex(isToday);

  async function deleteBooking(id: string) {
    if (!confirm('Supprimer ce rendez-vous?')) return;
    setSaving(true);
    await supabase.from('payroll_records').delete().eq('booking_id', id);
    await supabase.from('bookings').delete().eq('id', id);
    setBookings(prev => prev.filter(b => b.id !== id));
    setSelected(null); setSaving(false);
  }

  async function saveEdit() {
    if (!selected) return; setSaving(true);
    await supabase.from('bookings').update({ notes: editNotes || null, status: editStatus }).eq('id', selected.id);
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, notes: editNotes || undefined, status: editStatus } : b));
    setEditing(false); setSaving(false);
  }

  const COLORS = ['#1B9EF3','#22C55E','#F59E0B','#A78BFA','#EF4444','#06B6D4','#F97316','#EC4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#070E1A' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '10px 16px', background: '#0A1628', borderBottom: '1px solid #1E3A5F' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>Horaires</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {syncStatus && (
              <div style={{ fontSize: 11, color: '#4A6A88', padding: '3px 8px', borderRadius: 6, background: '#132D45' }}>
                🔄 {syncStatus.lastSrSync === '2020-01-01T00:00:00Z' ? 'Non déployé' : `${new Date(syncStatus.lastSrSync).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`}
                {syncStatus.jobberBookings > 0 && ` · ${syncStatus.jobberBookings} Jobber`}
              </div>
            )}
            <Link href="/book" style={{ padding: '6px 12px', borderRadius: 8, background: '#1B9EF3', color: 'white', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>+ RDV</Link>
          </div>
        </div>

        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '4px 10px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>←</button>
          <button onClick={() => setWeekOffset(0)} style={{ flex: 1, padding: '4px', borderRadius: 8, background: weekOffset === 0 ? '#1B9EF322' : 'transparent', border: `1px solid ${weekOffset === 0 ? '#1B9EF3' : '#1E3A5F'}`, color: weekOffset === 0 ? '#1B9EF3' : '#6B8AA8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {weekOffset === 0 ? 'Cette semaine' : `${weekDates[0].toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} — ${weekDates[6].toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}`}
            <span style={{ marginLeft: 6, color: '#4A6A88', fontWeight: 400 }}>({weekBookings.length} RDV)</span>
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '4px 10px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>→</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['rdv', 'team'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab === t ? '#1B9EF3' : '#132D45', color: tab === t ? 'white' : '#6B8AA8' }}>
              {t === 'rdv' ? 'RDV' : 'Équipe'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {tab === 'rdv' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Day headers — sticky */}
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', position: 'sticky', top: 0, background: '#0A1628', borderBottom: '1px solid #1E3A5F', zIndex: 10 }}>
            <div />
            {weekDates.map((d, i) => (
              <div key={i} style={{ padding: '6px 4px', textAlign: 'center', borderLeft: '1px solid #1E3A5F22' }}>
                <div style={{ fontSize: 11, color: '#6B8AA8' }}>{DAYS_FR[d.getDay()]}</div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '2px auto 0', lineHeight: '28px', textAlign: 'center', fontSize: 14, fontWeight: isToday(d) ? 700 : 400, background: isToday(d) ? '#1B9EF3' : 'transparent', color: isToday(d) ? 'white' : '#E2EEF8' }}>
                  {d.getDate()}
                </div>
                {/* Job count for this day */}
                {weekBookings.filter(b => b.date === dk(d)).length > 0 && (
                  <div style={{ fontSize: 10, color: '#4A6A88', marginTop: 2 }}>
                    {weekBookings.filter(b => b.date === dk(d)).length} jobs
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div style={{ position: 'relative' }}>
            {timeSlots.map((slot, si) => (
              <div key={slot.id} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #1E3A5F22', minHeight: SLOT_H }}>
                <div style={{ padding: '8px 4px', fontSize: 11, color: '#4A6A88', textAlign: 'right', paddingRight: 6, paddingTop: 10 }}>
                  {slot.heure}
                </div>
                {weekDates.map((d, di) => {
                  const bkgs = bookingsFor(d, slot.sort_order);
                  const isCurrentSlot = isToday(d) && nowY >= si * SLOT_H && nowY < (si + 1) * SLOT_H;
                  return (
                    <div key={di} style={{ borderLeft: '1px solid #1E3A5F22', padding: 3, minHeight: SLOT_H, background: isToday(d) ? '#0A1F35' : 'transparent', position: 'relative' }}>
                      {bkgs.map((b, bi) => {
                        const canEdit = isManager || b.rep_id === userId;
                        const color = COLORS[bi % COLORS.length];
                        const hasContract = !!(b as any).contract_id;
                        const isJobber = !!(b as any).jobber_job_id;
                        const h = b.duration_hours === 4 ? SLOT_H * 2 - 6 : SLOT_H - 6;
                        return (
                          <div key={b.id} onClick={() => canEdit && (setSelected(b), setEditNotes(b.notes || ''), setEditStatus(b.status as any))}
                               style={{ background: color + '22', border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: '4px 6px', marginBottom: 3, cursor: canEdit ? 'pointer' : 'default', height: bkgs.length === 1 ? `${h}px` : 'auto', overflow: 'hidden', transition: 'opacity .15s' }}
                               className="hover:opacity-80">
                            {/* Client name */}
                            <div style={{ fontWeight: 700, fontSize: 11, color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {b.client_nom}
                            </div>
                            {/* Time */}
                            <div style={{ fontSize: 10, color: '#8BAEC8', marginTop: 1 }}>{b.slot_start} · {b.duration_hours}h</div>
                            {/* Address */}
                            {b.client_adresse && (
                              <div style={{ fontSize: 10, color: '#5A8AA8', marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{b.client_adresse}</div>
                            )}
                            {/* Status badges */}
                            <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                              {!hasContract && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#F59E0B22', color: '#F59E0B' }}>⚠ contrat</span>}
                              {hasContract && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#22C55E22', color: '#22C55E' }}>✓</span>}
                              {isJobber && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#1B9EF322', color: '#1B9EF3' }}>J</span>}
                              {!(b.cleaner_ids as string[])?.length && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#EF444422', color: '#EF4444' }}>!</span>}
                              {b.prix_final && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: '#A78BFA22', color: '#A78BFA' }}>${b.prix_final}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current time red line */}
            {todayCol >= 0 && nowY > 0 && nowY < timeSlots.length * SLOT_H && (
              <div ref={nowLineRef} style={{ position: 'absolute', top: nowY, left: 0, right: 0, pointerEvents: 'none', zIndex: 5, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 48, display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                </div>
                {weekDates.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 2, background: i === todayCol ? '#EF4444' : 'transparent' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team tab — list view */}
      {tab === 'team' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {allProfiles?.filter(p => p.role === 'cleaner').map(cleaner => {
            const cleanerJobs = weekBookings.filter(b => (b.cleaner_ids as string[])?.includes(cleaner.id));
            return (
              <div key={cleaner.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F97316', marginBottom: 6 }}>🔧 {cleaner.full_name} ({cleanerJobs.length} jobs)</div>
                {cleanerJobs.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#4A6A88', paddingLeft: 12 }}>Aucun job cette semaine</div>
                ) : cleanerJobs.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 4, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'white' }}>{b.client_nom}</div>
                      <div style={{ color: '#5A8AA8' }}>{b.date} · {b.slot_start} · {b.duration_hours}h</div>
                    </div>
                    <div style={{ color: '#22C55E', fontWeight: 700 }}>{b.prix_final ? `$${b.prix_final}` : ''}</div>
                  </div>
                ))}
              </div>
            );
          })}
          {!allProfiles?.find(p => p.role === 'cleaner') && (
            <div style={{ textAlign: 'center', color: '#4A6A88', padding: 40 }}>Aucun technicien assigné</div>
          )}
        </div>
      )}

      {/* Booking detail modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
             onClick={() => { setSelected(null); setEditing(false); }}>
          <div onClick={e => e.stopPropagation()}
               style={{ background: '#0A1628', borderTop: '1px solid #1E3A5F', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 17, color: 'white', margin: 0 }}>{selected.client_nom}</h2>
                <div style={{ fontSize: 12, color: '#5A8AA8', marginTop: 2 }}>{selected.date} · {selected.slot_start} · {selected.duration_hours}h</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#132D45', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              {[
                ['📍', selected.client_adresse],
                ['📞', selected.client_telephone],
                ['✉️', selected.client_email],
                ['💰', selected.prix_final ? `$${selected.prix_final}` : null],
                ['📋', (selected as any).contract_id ? '✅ Contrat signé' : '⚠️ Sans contrat'],
                ['📝', selected.notes],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #1E3A5F22' }}>
                  <span style={{ color: '#5A8AA8', width: 20 }}>{k}</span>
                  <span style={{ color: '#E2EEF8' }}>{v}</span>
                </div>
              ))}
            </div>

            {selected.services?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                {selected.services.map((s: string) => <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#0D2E4A', color: '#1B9EF3' }}>{s}</span>)}
              </div>
            )}

            {editing ? (
              <div style={{ marginBottom: 14 }}>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Notes..."
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: 'white', fontSize: 13, boxSizing: 'border-box', resize: 'none', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {(['scheduled','completed','cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setEditStatus(s)}
                            style={{ flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                              background: editStatus === s ? (s === 'completed' ? '#22C55E' : s === 'cancelled' ? '#EF4444' : '#1B9EF3') : '#132D45',
                              color: editStatus === s ? 'white' : '#6B8AA8' }}>
                      {s === 'scheduled' ? 'Planifié' : s === 'completed' ? 'Complété' : 'Annulé'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#1B9EF3', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>{saving ? '...' : 'Sauvegarder'}</button>
                  <button onClick={() => setEditing(false)} style={{ padding: '10px 14px', borderRadius: 10, background: '#132D45', color: '#6B8AA8', border: '1px solid #1E3A5F', cursor: 'pointer' }}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!(selected as any).contract_id && (
                  <Link href={`/contract?booking_id=${selected.id}`} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#22C55E', color: 'white', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>📄 Signer contrat</Link>
                )}
                <button onClick={() => setEditing(true)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#1B9EF322', color: '#1B9EF3', border: '1px solid #1B9EF344', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✏️ Modifier</button>
                {(isManager || selected.rep_id === userId) && (
                  <button onClick={() => deleteBooking(selected.id)} disabled={saving} style={{ padding: '10px 14px', borderRadius: 10, background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
