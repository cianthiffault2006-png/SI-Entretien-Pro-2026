'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile, Booking } from '@/lib/types';

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function getWeekLabel(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const lundi = new Date(now); lundi.setDate(diff);
  const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  return `${fmt(lundi)} au ${fmt(dimanche)}`;
}

interface Props {
  profile: Profile;
  userId: string;
  allAvailability: any[];
  allProfiles: any[];
  bookings: any[];
}

export default function ScheduleClient({ profile, userId, allAvailability, allProfiles, bookings }: Props) {
  const supabase = createClient();
  const isManager = profile.role === 'admin' || profile.role === 'manager';

  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<'my' | 'team' | 'rdvs'>(isManager ? 'team' : 'my');
  const [jours, setJours] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const semaine = getWeekLabel(weekOffset);

  // Load existing availability for this week/user
  const myAvail = allAvailability.find(
  a => a.semaine === semaine && a.user_id === userId
);

const savedJours: Record<string, string | string[]> =
  myAvail && typeof myAvail.jours === 'string'
    ? JSON.parse(myAvail.jours)
    : ((myAvail?.jours ?? {}) as Record<string, string | string[]>);

function toggleShift(day: string, shift: 'Jour' | 'Soir') {
  setJours(prev => {
    const current = prev[day] ?? savedJours[day] ?? [];

    const arr = Array.isArray(current)
      ? current
      : String(current).split(' + ').filter(Boolean);

    const next = arr.includes(shift)
      ? arr.filter(s => s !== shift)
      : [...arr, shift];

    return { ...prev, [day]: next };
  });
}

  function getDayShifts(day: string): string[] {
    if (jours[day] !== undefined) return jours[day];
    const saved = savedJours[day];
    if (!saved) return [];
    return typeof saved === 'string' ? saved.split(' + ').filter(Boolean) : saved;
  }

  async function saveAvailability() {
    setSaving(true);
    const toSave: Record<string, string> = {};
    DAYS.forEach(d => {
      const shifts = getDayShifts(d);
      if (shifts.length) toSave[d] = shifts.join(' + ');
    });

    if (myAvail) {
      await supabase.from('weekly_availability').update({ jours: toSave, notes }).eq('id', myAvail.id);
    } else {
      await supabase.from('weekly_availability').insert({ semaine, user_id: userId, jours: toSave, notes });
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-4">Horaires</h1>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setWeekOffset(w => w - 1)}
                className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>
          ←
        </button>
        <div className="flex-1 text-center text-sm font-semibold text-white">Semaine du {semaine}</div>
        <button onClick={() => setWeekOffset(w => w + 1)}
                className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>
          →
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'my', label: 'Mon horaire' },
          ...(isManager ? [{ id: 'team', label: 'Équipe' }, { id: 'rdvs', label: 'RDV' }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                  style={{
                    background: tab === t.id ? '#1B9EF3' : 'transparent',
                    borderColor: tab === t.id ? '#1B9EF3' : '#1E3A5F',
                    color: tab === t.id ? '#fff' : '#6B8AA8',
                  }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* My schedule */}
      {tab === 'my' && (
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          {saved && (
            <div className="mx-4 mt-4 px-3 py-2 rounded-lg text-sm" style={{ background: '#0F2E1A', color: '#22C55E', border: '1px solid #22C55E44' }}>
              ✓ Horaire sauvegardé!
            </div>
          )}
          {DAYS.map((day, i) => {
            const shifts = getDayShifts(day);
            return (
              <div key={day} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                   style={{ borderColor: '#132D45' }}>
                <span className="text-sm font-semibold w-24" style={{ color: '#E2EEF8' }}>{day}</span>
                <div className="flex gap-3">
                  {(['Jour', 'Soir'] as const).map(shift => {
                    const active = shifts.includes(shift);
                    return (
                      <button key={shift} onClick={() => toggleShift(day, shift)}
                              className="px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                              style={{
                                background: active ? (shift === 'Jour' ? '#0D2E4A' : '#1A0F2E') : 'transparent',
                                borderColor: active ? (shift === 'Jour' ? '#1B9EF3' : '#A78BFA') : '#1E3A5F',
                                color: active ? (shift === 'Jour' ? '#1B9EF3' : '#A78BFA') : '#3A5F80',
                              }}>
                        {shift}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="p-4 border-t" style={{ borderColor: '#1E3A5F' }}>
            <input value={notes} onChange={e => setNotes(e.target.value)}
                   placeholder="Notes (ex: absent mercredi matin)" className="mb-3" />
            <button onClick={saveAvailability} disabled={saving}
                    className="w-full py-3 rounded-xl font-bold text-white"
                    style={{ background: saving ? '#0E7ACC' : '#1B9EF3' }}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder mon horaire'}
            </button>
          </div>
        </div>
      )}

      {/* Team view */}
      {tab === 'team' && isManager && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#0A1628' }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: '#6B8AA8' }}>Employé</th>
                  {DAYS.map(d => (
                    <th key={d} className="px-2 py-2 text-center font-semibold" style={{ color: '#6B8AA8' }}>{d.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allProfiles.map(p => {
                  const avail = allAvailability.find(a => a.semaine === semaine && a.user_id === p.id);
                  const jd = avail ? (typeof avail.jours === 'string' ? JSON.parse(avail.jours) : avail.jours) : {};
                  const roleColor = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' }[p.role as string] || '#6B8AA8';
                  return (
                    <tr key={p.id} className="border-t" style={{ borderColor: '#132D45' }}>
                      <td className="px-3 py-2">
                        <div className="font-semibold" style={{ color: '#E2EEF8' }}>{p.full_name}</div>
                        <div style={{ color: roleColor, fontSize: 10 }}>{p.role}</div>
                      </td>
                      {DAYS.map(d => {
                        const val = jd[d] || '';
                        const hasJ = val.includes('Jour');
                        const hasS = val.includes('Soir');
                        return (
                          <td key={d} className="px-2 py-2 text-center">
                            {hasJ && <span style={{ color: '#1B9EF3', fontWeight: 700 }}>J</span>}
                            {hasJ && hasS && ' '}
                            {hasS && <span style={{ color: '#A78BFA', fontWeight: 700 }}>S</span>}
                            {!hasJ && !hasS && <span style={{ color: '#1E3A5F' }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t text-xs" style={{ borderColor: '#1E3A5F', color: '#3A6B8A' }}>
            J = Jour &nbsp; S = Soir
          </div>
        </div>
      )}

      {/* RDVs view */}
      {tab === 'rdvs' && isManager && (
        <div className="space-y-2">
          {bookings.length === 0 && <div className="text-center py-8" style={{ color: '#3A5F80' }}>Aucun RDV cette semaine.</div>}
          {bookings.map((b: any) => (
            <div key={b.id} className="rounded-xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm text-white">{b.client_nom}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B8AA8' }}>
                    {new Date(b.date + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{b.slot_start}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#3A6B8A' }}>{b.client_adresse}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-1 rounded-full font-semibold"
                        style={{ background: '#0D2E4A', color: '#1B9EF3' }}>{b.duration_hours}h</span>
                  {b.cleaner_ids?.length === 0 && (
                    <div className="text-xs mt-1" style={{ color: '#EF4444' }}>Non assigné</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
