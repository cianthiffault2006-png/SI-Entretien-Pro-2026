'use client';
import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

type Shift = 'J' | 'S' | 'JS' | null;

interface WeekAvail {
  id?: string;
  user_id: string;
  semaine: string; // 'YYYY-WW'
  jours: Record<string, Shift>;
  notes: string;
}

interface StaffAvail {
  user_id: string;
  semaine: string;
  jours: Record<string, Shift>;
  notes: string;
  profiles?: { full_name: string; role: string };
}

interface Booking {
  date: string; slot_start_index: number; duration_hours: number;
  client_nom: string; client_adresse: string;
  client_adresse_lat: number | null; client_adresse_lng: number | null;
}

interface Props {
  profile: any; userId: string;
  allAvail: StaffAvail[];
  bookings: Booking[];
  staff: { id: string; full_name: string; role: string }[];
  currentWeek: string;
}

// Get ISO week key YYYY-WW
function weekKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  // Get Monday of the week
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

// Get Monday of a week from YYYY-WW
function weekMonday(wk: string): Date {
  const [year, week] = wk.split('-').map(Number);
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() - dow + 1);
  return d;
}

function dayDate(wk: string, dayIdx: number): Date {
  const monday = weekMonday(wk);
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayIdx);
  return d;
}

function dk(d: Date): string { return d.toISOString().split('T')[0]; }

// Quebec/Montreal city areas for geo grouping
const ZONES: Record<string, { label: string; keywords: string[] }> = {
  levis:    { label: 'Lévis',       keywords: ['lévis', 'levis', 'saint-romuald', 'saint-jean-chrysostome', 'charny', 'pintendre', 'saint-nicolas'] },
  qc_haute: { label: 'Haute-Ville', keywords: ['haute-ville', 'saint-jean-baptiste', 'montcalm', 'saint-sacrement', 'saint-roch'] },
  qc_ouest: { label: 'Québec O.',   keywords: ['sainte-foy', 'beauport', 'charlesbourg', 'québec', 'saint-augustin'] },
  val_bel:  { label: 'Val-Bélair',  keywords: ['val-bélair', 'val belair', 'neufchâtel', 'loretteville'] },
  gatineau: { label: 'Gatineau',    keywords: ['gatineau', 'hull', 'aylmer', 'buckingham'] },
  montreal: { label: 'Montréal',    keywords: ['montréal', 'montreal', 'laval', 'longueuil', 'brossard'] },
};

function getZone(addr: string): string {
  if (!addr) return 'other';
  const a = addr.toLowerCase();
  for (const [key, z] of Object.entries(ZONES)) {
    if (z.keywords.some(k => a.includes(k))) return key;
  }
  return 'other';
}

export default function DisponibiliteClient({ profile, userId, allAvail, bookings, staff, currentWeek }: Props) {
  const supabase = createClient();
  const isManager = profile.role === 'admin' || profile.role === 'manager';

  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<'my' | 'team' | 'slots'>('my');
  const [saving, setSaving] = useState(false);

  const wk = useMemo(() => weekKey(weekOffset), [weekOffset]);
  const monday = useMemo(() => weekMonday(wk), [wk]);

  // My availability for current displayed week
  const myAvailRow = allAvail.find(a => a.user_id === userId && a.semaine === wk);
  const [myJours, setMyJours] = useState<Record<string, Shift>>(myAvailRow?.jours || {});
  const [myNotes, setMyNotes] = useState(myAvailRow?.notes || '');
  const [savedWeek, setSavedWeek] = useState(wk);

  // Reset local state when week changes
  const effectiveRow = allAvail.find(a => a.user_id === userId && a.semaine === wk);
  if (savedWeek !== wk) {
    setMyJours(effectiveRow?.jours || {});
    setMyNotes(effectiveRow?.notes || '');
    setSavedWeek(wk);
  }

  function cycleShift(current: Shift): Shift {
    if (!current) return 'J';
    if (current === 'J') return 'S';
    if (current === 'S') return 'JS';
    return null; // JS → null
  }

  async function toggleDay(dayKey: string) {
    const newShift = cycleShift(myJours[dayKey] ?? null);
    const newJours = { ...myJours, [dayKey]: newShift };
    if (newShift === null) delete newJours[dayKey];
    setMyJours(newJours);
  }

  async function saveAvailability() {
    setSaving(true);
    await supabase.from('weekly_availability').upsert({
      user_id: userId, semaine: wk,
      jours: myJours, notes: myNotes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,semaine' });
    setSaving(false);
  }

  // Booking lookup by date
  const bookingsByDate = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    bookings.forEach(b => { if (!m[b.date]) m[b.date] = []; m[b.date].push(b); });
    return m;
  }, [bookings]);

  // Slot suggestion: next 30 days with available slots
  // Groups by zone - suggests days where existing jobs are in same zone
  const slotSuggestions = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const suggestions: { date: Date; dateStr: string; zone: string; zoneLabel: string; usedSlots: number; freeSlots: number; workingStaff: string[]; sameZoneJobs: Booking[] }[] = [];

    for (let d = 0; d <= 45 && suggestions.length < 15; d++) {
      const date = new Date(today); date.setDate(today.getDate() + d);
      const dateStr = dk(date);
      const dayJobs = bookingsByDate[dateStr] || [];

      // Count slots used (each 2h slot holds up to 4 jobs, 4h = 2 slots)
      const usedSlots = dayJobs.reduce((s, b) => s + (b.duration_hours === 4 ? 2 : 1), 0);
      const freeSlots = Math.max(0, 20 - usedSlots); // 10 slots × 2 per hour = 20 max (Jobber may reduce)
      if (freeSlots <= 0) continue;

      // Which zone is this day in? (majority of jobs)
      const zoneCount: Record<string, number> = {};
      dayJobs.forEach(j => {
        const z = getZone(j.client_adresse || '');
        zoneCount[z] = (zoneCount[z] || 0) + 1;
      });
      const dominantZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
      const sameZoneJobs = dayJobs.filter(j => getZone(j.client_adresse || '') === dominantZone);

      // Who's working? Check weekly_availability for this date
      const dayOfWeek = date.getDay(); // 0=Sun
      const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0
      const dayKey = DAY_KEYS[dayIdx];
      const workingStaff = allAvail
        .filter(a => a.semaine === wk && a.jours[dayKey])
        .map(a => a.profiles?.full_name || a.user_id);

      suggestions.push({
        date, dateStr,
        zone: dominantZone,
        zoneLabel: ZONES[dominantZone]?.label || 'Autre zone',
        usedSlots,
        freeSlots: Math.min(freeSlots, 8), // cap display
        workingStaff,
        sameZoneJobs,
      });
    }

    // Sort: days with same-zone jobs first (closest area match)
    return suggestions.sort((a, b) => {
      const aHasJobs = a.sameZoneJobs.length > 0 ? 0 : 1;
      const bHasJobs = b.sameZoneJobs.length > 0 ? 0 : 1;
      if (aHasJobs !== bHasJobs) return aHasJobs - bHasJobs;
      return a.date.getTime() - b.date.getTime();
    });
  }, [bookingsByDate, allAvail, wk]);

  const MONTHS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  function fmtDate(d: Date) {
    return `${DAYS[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  }

  function shiftColor(s: Shift) {
    if (!s) return '#1E3A5F';
    if (s === 'J') return '#1B9EF3';
    if (s === 'S') return '#A78BFA';
    return '#22C55E'; // JS = both
  }
  function shiftBg(s: Shift) {
    if (!s) return '#0F1E35';
    if (s === 'J') return '#0D2E4A';
    if (s === 'S') return '#1E1040';
    return '#0F2E1A';
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Disponibilités</h1>
        <p style={{ fontSize: 12, color: '#5A8AA8', marginTop: 3 }}>
          J = Jour · S = Soir · JS = Tout la journée
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['my','📅 Mon horaire'],['team','👥 Équipe'],['slots','✅ Créneaux dispo']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab===t?'#1B9EF3':'#132D45', color: tab===t?'white':'#6B8AA8' }}>{l}</button>
        ))}
      </div>

      {/* ── MY SCHEDULE ─────────────────────────────────────────── */}
      {tab === 'my' && (
        <div>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setWeekOffset(w => w-1)} disabled={weekOffset <= 0}
                    style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: weekOffset<=0?'#3A5F80':'#8BAEC8', cursor: weekOffset<=0?'default':'pointer', fontSize: 14 }}>←</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#E2EEF8' }}>
              Semaine du {monday.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}
              {weekOffset === 0 && <span style={{ color: '#1B9EF3', marginLeft: 6 }}>(cette semaine)</span>}
            </div>
            <button onClick={() => setWeekOffset(w => w+1)}
                    style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>→</button>
          </div>

          {/* Day grid — tap to cycle: vide → J → S → JS → vide */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 14 }}>
            {DAY_KEYS.map((dayKey, idx) => {
              const shift = myJours[dayKey] ?? null;
              const date = dayDate(wk, idx);
              const dateStr = dk(date);
              const bkCount = bookingsByDate[dateStr]?.length || 0;
              const isPast = dateStr < dk(new Date());
              return (
                <button key={dayKey} onClick={() => !isPast && toggleDay(dayKey)} disabled={isPast}
                        style={{ padding: '10px 4px', borderRadius: 12, border: `2px solid ${shiftColor(shift)}`, background: shiftBg(shift), cursor: isPast?'default':'pointer', opacity: isPast?0.4:1, textAlign: 'center', transition: 'all .15s' }}>
                  <div style={{ fontSize: 11, color: '#6B8AA8', marginBottom: 2 }}>{DAYS[idx]}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: shift ? shiftColor(shift) : '#8BAEC8', lineHeight: 1 }}>{date.getDate()}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: shiftColor(shift), marginTop: 3, minHeight: 18 }}>{shift || ''}</div>
                  {bkCount > 0 && <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 2 }}>{bkCount} jobs</div>}
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B8AA8', marginBottom: 6, fontWeight: 700, letterSpacing: 0.8 }}>NOTES SPÉCIFIQUES</label>
            <textarea value={myNotes} onChange={e => setMyNotes(e.target.value)} rows={3}
                      placeholder="ex: Mardi soir pas disponible après 21h, Jeudi je commence à 9h..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: 'white', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <button onClick={saveAvailability} disabled={saving}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, background: saving?'#0E7ACC':'#1B9EF3', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving?'default':'pointer' }}>
            {saving ? 'Sauvegarde...' : '✓ Sauvegarder mes disponibilités'}
          </button>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
            {[['J','Jour (AM)','#1B9EF3'],['S','Soir (PM)','#A78BFA'],['JS','Tout la journée','#22C55E']].map(([s,l,c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: c+'22', border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: c }}>{s}</div>
                <span style={{ fontSize: 11, color: '#6B8AA8' }}>{l}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0F1E35', border: '2px solid #1E3A5F' }} />
              <span style={{ fontSize: 11, color: '#6B8AA8' }}>Pas disponible</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TEAM VIEW ───────────────────────────────────────────── */}
      {tab === 'team' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setWeekOffset(w => w-1)} style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>←</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#E2EEF8' }}>
              Semaine du {monday.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}
            </div>
            <button onClick={() => setWeekOffset(w => w+1)} style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>→</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#5A8AA8', fontWeight: 700, background: '#132D45', borderRadius: 8, minWidth: 100 }}>Staff</th>
                  {DAY_KEYS.map((_, idx) => {
                    const d = dayDate(wk, idx);
                    return <th key={idx} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, color: '#5A8AA8', fontWeight: 600, background: '#132D45', minWidth: 50 }}>
                      <div>{DAYS[idx]}</div>
                      <div style={{ fontSize: 12, color: '#8BAEC8' }}>{d.getDate()}</div>
                    </th>;
                  })}
                  <th style={{ padding: '8px 10px', fontSize: 11, color: '#5A8AA8', fontWeight: 700, background: '#132D45', textAlign: 'left', minWidth: 120 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, si) => {
                  const row = allAvail.find(a => a.user_id === s.id && a.semaine === wk);
                  const isMe = s.id === userId;
                  return (
                    <tr key={s.id} style={{ background: si%2===0?'#0A1628':'#0C1B30' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: isMe?'#1B9EF3':'#C2D4E8', fontWeight: isMe?700:500 }}>
                        {s.full_name.split(' ')[0]} {s.full_name.split(' ')[1]?.charAt(0)}.
                        <div style={{ fontSize: 10, color: '#4A6A88' }}>{s.role==='cleaner'?'Tech':'Rep'}</div>
                      </td>
                      {DAY_KEYS.map((dayKey, idx) => {
                        const shift = row?.jours?.[dayKey] ?? null;
                        return (
                          <td key={dayKey} style={{ textAlign: 'center', padding: '4px 3px' }}>
                            {shift ? (
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: shiftBg(shift), border: `2px solid ${shiftColor(shift)}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: shiftColor(shift) }}>
                                {shift}
                              </div>
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid #1E3A5F22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#2A4060' }}>—</div>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#5A8AA8', maxWidth: 140 }}>
                        {row?.notes ? <span title={row.notes}>{row.notes.slice(0, 40)}{row.notes.length > 40 ? '...' : ''}</span> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SLOT FINDER ─────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div>
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#0F1E35', border: '1px solid #1E3A5F', fontSize: 12, color: '#6B8AA8' }}>
            📍 Les créneaux sont groupés par zone géographique des jobs déjà bookés ce jour-là.
            Si on est dans Lévis, on suggère d'abord les jours avec d'autres jobs dans Lévis.
            <strong style={{ color: '#F59E0B', display: 'block', marginTop: 4 }}>
              ⚠️ Activer la sync Jobber pour voir les vrais jobs — {bookings.length > 0 ? `${bookings.length} jobs chargés` : 'aucun job Jobber pour l\'instant'}
            </strong>
          </div>

          {slotSuggestions.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              Aucun créneau disponible trouvé. Vérifiez que les disponibilités sont configurées.
            </div>
          )}

          {slotSuggestions.slice(0, 10).map(({ date, dateStr, zone, zoneLabel, freeSlots, workingStaff, sameZoneJobs }) => {
            const hasZoneMatch = sameZoneJobs.length > 0;
            const dayJobs = bookingsByDate[dateStr] || [];
            return (
              <div key={dateStr} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${hasZoneMatch?'#22C55E44':'#1E3A5F'}`, marginBottom: 10, background: '#0F1E35' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1E3A5F22' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'white', textTransform: 'capitalize' }}>{fmtDate(date)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: hasZoneMatch?'#0F2E1A':'#132D45', color: hasZoneMatch?'#22C55E':'#6B8AA8', border: `1px solid ${hasZoneMatch?'#22C55E33':'#1E3A5F'}` }}>
                        📍 {zoneLabel}
                      </span>
                      {workingStaff.slice(0, 3).map((n, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#0D2E4A', color: '#1B9EF3', border: '1px solid #1B9EF322' }}>
                          {n.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: freeSlots < 4 ? '#F59E0B' : '#22C55E' }}>{freeSlots}</div>
                    <div style={{ fontSize: 10, color: '#5A8AA8' }}>créneaux libres</div>
                  </div>
                </div>

                {/* Jobs déjà booked ce jour */}
                {dayJobs.length > 0 && (
                  <div style={{ padding: '8px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A6A88', letterSpacing: 0.8, marginBottom: 4 }}>JOBS CE JOUR</div>
                    {dayJobs.slice(0, 5).map((b, i) => {
                      const bZone = getZone(b.client_adresse || '');
                      const isSame = bZone === zone;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: isSame?'#8BAEC8':'#4A6A88' }}>
                          <span>{b.client_nom}</span>
                          <span>{b.client_adresse?.split(',').slice(-1)[0]?.trim() || ZONES[bZone]?.label || 'Autre'}</span>
                        </div>
                      );
                    })}
                    {dayJobs.length > 5 && <div style={{ fontSize: 10, color: '#4A6A88' }}>+ {dayJobs.length - 5} autres</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
