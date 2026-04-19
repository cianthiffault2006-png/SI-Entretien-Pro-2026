'use client';
import { useState } from 'react';
import type { Profile } from '@/lib/types';

interface RepStat {
  rep_id: string;
  full_name: string;
  role: string;
  sr_closes: number;
  closes_with_rdv: number;
  follow_ups: number;
  call_backs: number;
  total_leads: number;
  total_revenue: number;
  avg_deal_size: number;
  close_rate: number;
}

const TIERS = [
  { min: 450, label: 'Élite 🏆', color: '#F59E0B', bg: '#2E1A0A' },
  { min: 300, label: 'Tier 3', color: '#A78BFA', bg: '#1E1040' },
  { min: 150, label: 'Tier 2', color: '#1B9EF3', bg: '#0D2E4A' },
  { min: 0,   label: 'Débutant', color: '#9CA3AF', bg: '#1A2535' },
];

function getTier(closes: number) {
  return TIERS.find(t => closes >= t.min) || TIERS[3];
}

function getRate(closes: number) {
  if (closes >= 450) return 0.25;
  if (closes >= 300) return 0.20;
  if (closes >= 150) return 0.175;
  return 0.15;
}

function medal(i: number) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return `${i + 1}.`;
}

export default function LeaderboardClient({ profile, userId, stats, lastSync }: {
  profile: Profile; userId: string; stats: RepStat[]; lastSync: string | null;
}) {
  const [sort, setSort] = useState<'closes' | 'revenue' | 'rate'>('closes');
  const [showAll, setShowAll] = useState(false);

  const sorted = [...stats].sort((a, b) => {
    if (sort === 'closes') return b.sr_closes - a.sr_closes;
    if (sort === 'revenue') return (b.total_revenue || 0) - (a.total_revenue || 0);
    return (b.close_rate || 0) - (a.close_rate || 0);
  });

  const displayed = showAll ? sorted : sorted.slice(0, 10);
  const myStats = stats.find(s => s.rep_id === userId);
  const myRank = sorted.findIndex(s => s.rep_id === userId) + 1;
  const totalCloses = stats.reduce((s, r) => s + (r.sr_closes || 0), 0);
  const totalRevenue = stats.reduce((s, r) => s + (r.total_revenue || 0), 0);

  const neverSynced = lastSync === '2020-01-01T00:00:00Z' || !lastSync;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Classement</h1>
          <div style={{ fontSize: 11, color: '#4A6A88', padding: '4px 10px', borderRadius: 8, background: '#132D45' }}>
            🔄 {neverSynced ? 'SR non déployé' : `Sync: ${new Date(lastSync!).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#5A8AA8', margin: '4px 0 0' }}>
          Données directement depuis SalesRabbit · {totalCloses} closes · ${Math.round(totalRevenue).toLocaleString('fr-CA')} revenu total
        </p>
      </div>

      {/* My stats card */}
      {myStats && (
        <div style={{ borderRadius: 14, padding: '14px 16px', border: '1px solid #1E3A5F', marginBottom: 16, background: '#0F1E35' }}>
          <div style={{ fontSize: 11, color: '#5A8AA8', marginBottom: 6, fontWeight: 700 }}>MON RÉSUMÉ</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Closes', value: myStats.sr_closes, color: '#22C55E' },
              { label: 'Taux', value: `${myStats.close_rate || 0}%`, color: '#1B9EF3' },
              { label: 'Revenu', value: `$${Math.round(myStats.total_revenue || 0).toLocaleString('fr-CA')}`, color: '#A78BFA' },
              { label: 'Rang', value: `#${myRank}`, color: '#F59E0B' },
              { label: 'Commission', value: `${(getRate(myStats.sr_closes) * 100).toFixed(1)}%`, color: getTier(myStats.sr_closes).color },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 70, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#5A8AA8' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Tier progress */}
          <div style={{ marginTop: 10 }}>
            {(() => {
              const tier = getTier(myStats.sr_closes);
              const next = TIERS[Math.max(0, TIERS.findIndex(t => t === tier) - 1)];
              const pct = next ? Math.min(100, (myStats.sr_closes / next.min) * 100) : 100;
              const remaining = next ? next.min - myStats.sr_closes : 0;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5A8AA8', marginBottom: 4 }}>
                    <span style={{ color: tier.color }}>{tier.label}</span>
                    {next && <span>{remaining} closes → {next.label}</span>}
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${tier.color},${next?.color || tier.color})`, width: `${pct}%`, transition: 'width .5s' }} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Sort tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['closes', 'Closes'], ['revenue', 'Revenu'], ['rate', 'Taux de close']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: sort === k ? '#1B9EF3' : '#132D45', color: sort === k ? 'white' : '#6B8AA8' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
        {displayed.map((rep, i) => {
          const tier = getTier(rep.sr_closes);
          const isMe = rep.rep_id === userId;
          return (
            <div key={rep.rep_id}
                 style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < displayed.length - 1 ? '1px solid #0F1E30' : 'none', background: isMe ? '#0D2E4A' : i % 2 === 0 ? '#0A1628' : '#0C1B30' }}>
              {/* Rank */}
              <div style={{ width: 32, textAlign: 'center', fontSize: i < 3 ? 18 : 13, flexShrink: 0, color: '#5A8AA8', fontWeight: 700 }}>
                {medal(i)}
              </div>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: tier.bg, border: `2px solid ${tier.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: tier.color, flexShrink: 0 }}>
                {rep.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {/* Name + tier */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: isMe ? '#1B9EF3' : 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {rep.full_name.split(' ')[0]} {rep.full_name.split(' ')[1]?.charAt(0)}.
                  {isMe && <span style={{ fontSize: 10, color: '#1B9EF3' }}>← moi</span>}
                </div>
                <div style={{ fontSize: 11, marginTop: 1 }}>
                  <span style={{ color: tier.color, fontWeight: 600 }}>{tier.label}</span>
                  <span style={{ color: '#4A6A88', marginLeft: 6 }}>{(getRate(rep.sr_closes) * 100).toFixed(1)}% comm.</span>
                </div>
              </div>
              {/* Stats */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', lineHeight: 1 }}>{rep.sr_closes}</div>
                <div style={{ fontSize: 10, color: '#5A8AA8' }}>closes</div>
                {rep.close_rate > 0 && <div style={{ fontSize: 11, color: '#1B9EF3', marginTop: 2 }}>{rep.close_rate}% rate</div>}
                {rep.total_revenue > 0 && <div style={{ fontSize: 10, color: '#A78BFA' }}>${Math.round(rep.total_revenue / 1000)}k</div>}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 10 && (
        <button onClick={() => setShowAll(!showAll)}
                style={{ width: '100%', marginTop: 10, padding: '8px', borderRadius: 10, background: '#132D45', color: '#6B8AA8', border: '1px solid #1E3A5F', cursor: 'pointer', fontSize: 13 }}>
          {showAll ? 'Afficher moins' : `Voir tous (${sorted.length})`}
        </button>
      )}
    </div>
  );
}
