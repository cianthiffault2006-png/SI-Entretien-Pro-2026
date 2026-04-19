'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile, SalesLog } from '@/lib/types';

interface Props {
  profile: Profile;
  initialLogs: SalesLog[];
  repList: { id: string; full_name: string }[];
  userId: string;
}

export default function SalesClient({ profile, initialLogs, repList, userId }: Props) {
  const supabase = createClient();
  const isManager = profile.role === 'admin' || profile.role === 'manager';

  const [logs, setLogs] = useState<SalesLog[]>(initialLogs);
  const [tab, setTab] = useState<'log' | 'history' | 'stats'>('log');

  // Log form
  const today = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState(today);
  const [revenue, setRevenue] = useState('');
  const [closes, setCloses] = useState('');
  const [hours, setHours] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  async function saveLog() {
    if (!revenue && !closes) { setErr('Entrer au moins le revenu ou le nombre de ventes.'); return; }
    setSaving(true); setErr('');
    const existing = logs.find(l => l.log_date === logDate && l.rep_id === userId);
    let result;
    if (existing) {
      result = await supabase.from('sales_logs').update({
        revenue_value: parseFloat(revenue) || 0,
        closes_count: parseInt(closes) || 0,
        hours_worked: parseFloat(hours) || 0,
        notes: logNotes || null,
      }).eq('id', existing.id).select('*, profiles(full_name)').single();
    } else {
      result = await supabase.from('sales_logs').insert({
        rep_id: userId,
        log_date: logDate,
        revenue_value: parseFloat(revenue) || 0,
        closes_count: parseInt(closes) || 0,
        hours_worked: parseFloat(hours) || 0,
        notes: logNotes || null,
      }).select('*, profiles(full_name)').single();
    }
    if (result.error) { setErr(result.error.message); setSaving(false); return; }
    setLogs(prev => [result.data!, ...prev.filter(l => l.id !== result.data!.id)]);
    setRevenue(''); setCloses(''); setHours(''); setLogNotes('');
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Stats computation
  const myLogs = logs.filter(l => l.rep_id === userId);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekLogs = myLogs.filter(l => new Date(l.log_date) >= weekAgo);
  const monthKey = today.slice(0, 7);
  const monthLogs = myLogs.filter(l => l.log_date.startsWith(monthKey));

  function sum(arr: SalesLog[], field: keyof SalesLog) {
    return arr.reduce((s, l) => s + (Number(l[field]) || 0), 0);
  }

  const TABS = [
    { id: 'log', label: 'Enregistrer' },
    { id: 'history', label: 'Historique' },
    { id: 'stats', label: 'Statistiques' },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-4">
        {isManager ? 'Suivi des ventes' : 'Mes ventes'}
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
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

      {/* Log shift */}
      {tab === 'log' && (
        <div className="rounded-2xl p-5 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#6B8AA8' }}>
            Enregistrer une journée
          </div>
          {err && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>{err}</div>}
          {saved && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: '#0F2E1A', color: '#22C55E', border: '1px solid #22C55E44' }}>✓ Sauvegardé!</div>}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Date</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Heures travaillées</label>
              <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="ex. 8" min="0" step="0.5" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Revenu généré ($)</label>
              <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="ex. 1200" min="0" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Nombre de ventes</label>
              <input type="number" value={closes} onChange={e => setCloses(e.target.value)} placeholder="ex. 4" min="0" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Notes</label>
            <input value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="ex. Excellente journée à Ste-Foy..." />
          </div>
          <button onClick={saveLog} disabled={saving}
                  className="w-full py-3 rounded-xl font-bold text-white"
                  style={{ background: saving ? '#0E7ACC' : '#1B9EF3' }}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="space-y-2">
          {logs.length === 0 && <div className="text-center py-8" style={{ color: '#3A5F80' }}>Aucune entrée.</div>}
          {logs.map(l => (
            <div key={l.id} className="rounded-xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm text-white">
                    {new Date(l.log_date + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {isManager && l.profiles && (
                    <div className="text-xs mt-0.5" style={{ color: '#6B8AA8' }}>{l.profiles.full_name}</div>
                  )}
                  {l.notes && <div className="text-xs mt-1" style={{ color: '#3A6B8A' }}>{l.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: '#22C55E' }}>${l.revenue_value.toLocaleString('fr-CA')}</div>
                  <div className="text-xs" style={{ color: '#6B8AA8' }}>{l.closes_count} vente{l.closes_count !== 1 ? 's' : ''}</div>
                  {l.hours_worked > 0 && <div className="text-xs" style={{ color: '#6B8AA8' }}>{l.hours_worked}h</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {[
            { label: 'Cette semaine', data: weekLogs },
            { label: 'Ce mois', data: monthLogs },
            { label: 'Total', data: myLogs },
          ].map(({ label, data }) => (
            <div key={label} className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
              <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>{label}</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Revenu', v: `$${Math.round(sum(data, 'revenue_value')).toLocaleString('fr-CA')}`, c: '#22C55E' },
                  { l: 'Ventes', v: sum(data, 'closes_count'), c: '#1B9EF3' },
                  { l: 'Heures', v: `${sum(data, 'hours_worked').toFixed(1)}h`, c: '#A78BFA' },
                ].map(s => (
                  <div key={s.l} className="rounded-xl p-3" style={{ background: '#132D45' }}>
                    <div className="text-lg font-bold" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B8AA8' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {sum(data, 'hours_worked') > 0 && (
                <div className="mt-2 text-xs" style={{ color: '#3A6B8A' }}>
                  Moy: ${(sum(data, 'revenue_value') / sum(data, 'hours_worked')).toFixed(0)}/h
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
