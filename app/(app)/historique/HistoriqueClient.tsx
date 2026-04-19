'use client';
import { useState, useMemo } from 'react';

interface Close {
  id: string; first_name: string; last_name: string;
  address: string; city: string; appointment_date: string;
  prix: number; services_sr: string[]; sr_rep_name: string;
  assigned_rep_id: string; status_sr: string; created_at: string;
}

interface Rep { id: string; full_name: string; }

function monthKey(d: string | null) {
  if (!d) return 'Sans date';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long' });
}

export default function HistoriqueClient({ profile, closes, reps, isManager }: {
  profile: any; closes: Close[]; reps: Rep[]; isManager: boolean;
}) {
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('all');
  const [sort, setSort] = useState<'date' | 'prix'>('date');

  const filtered = useMemo(() => {
    let r = closes;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c =>
        [c.first_name, c.last_name, c.address, c.city, c.sr_rep_name].join(' ').toLowerCase().includes(q)
      );
    }
    if (repFilter !== 'all') r = r.filter(c => c.assigned_rep_id === repFilter || c.sr_rep_name === repFilter);
    if (sort === 'prix') r = [...r].sort((a, b) => (b.prix || 0) - (a.prix || 0));
    return r;
  }, [closes, search, repFilter, sort]);

  // Group by month
  const grouped = useMemo(() => {
    const m: Record<string, Close[]> = {};
    filtered.forEach(c => {
      const k = monthKey(c.appointment_date || c.created_at);
      if (!m[k]) m[k] = [];
      m[k].push(c);
    });
    return m;
  }, [filtered]);

  const totalRevenue = filtered.reduce((s, c) => s + (c.prix || 0), 0);
  const avgDeal = filtered.length > 0 ? totalRevenue / filtered.filter(c => c.prix > 0).length : 0;

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Historique des closes</h1>
          <p style={{ fontSize: 13, color: '#5A8AA8', margin: '4px 0 0' }}>
            {filtered.length} closes · ${Math.round(totalRevenue).toLocaleString('fr-CA')} · moy. ${Math.round(avgDeal).toLocaleString('fr-CA')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/ventes" style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, textDecoration: 'none', border: '1px solid #1E3A5F' }}>← Ventes</a>
          <a href="/stats" style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📊 Stats</a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher client, adresse..."
               style={{ flex: 1, minWidth: 200, padding: '7px 12px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: 'white', fontSize: 13 }} />
        {isManager && (
          <select value={repFilter} onChange={e => setRepFilter(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: '#8BAEC8', fontSize: 13 }}>
            <option value="all">Tous les reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
          {([['date', '📅 Date'], ['prix', '💰 Prix']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSort(v)}
                    style={{ padding: '7px 12px', fontSize: 12, background: sort === v ? '#1B9EF3' : '#132D45', color: sort === v ? 'white' : '#6B8AA8', border: 'none', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      {Object.entries(grouped).map(([month, items]) => {
        const monthRevenue = items.reduce((s, c) => s + (c.prix || 0), 0);
        return (
          <div key={month} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', marginBottom: 6, borderBottom: '1px solid #1E3A5F44' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#8BAEC8', textTransform: 'capitalize' }}>{month}</span>
              <span style={{ fontSize: 12, color: '#4A6A88' }}>{items.length} closes · ${Math.round(monthRevenue).toLocaleString('fr-CA')}</span>
            </div>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
              {items.map((c, i) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                const addr = [c.address, c.city].filter(Boolean).join(', ');
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < items.length - 1 ? '1px solid #0F1E30' : 'none', background: i % 2 === 0 ? '#0A1628' : '#0C1B30' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#5A8AA8' }}>{addr || '—'}</div>
                      {c.services_sr?.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                          {c.services_sr.map((s: string) => <span key={s} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: '#1B9EF322', color: '#1B9EF3' }}>{s}</span>)}
                        </div>
                      )}
                    </div>
                    {isManager && c.sr_rep_name && (
                      <div style={{ fontSize: 11, color: '#4A6A88', flexShrink: 0 }}>{c.sr_rep_name.split(' ')[0]}</div>
                    )}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {c.prix > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: '#22C55E' }}>${c.prix}</div>}
                      <div style={{ fontSize: 10, color: '#4A6A88' }}>{c.appointment_date || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#4A6A88' }}>Aucun résultat</div>
      )}
    </div>
  );
}
