'use client';
import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { getCommissionRate, getTierLabel } from '@/lib/types';

interface RepStat {
  rep_id: string; full_name: string; role: string;
  sr_closes: number; recall_closes: number; total_closes: number;
  d2d_revenue: number; recall_revenue: number; total_revenue: number;
  close_rate: number; avg_deal_size: number;
}
interface PayPeriod { id: string; label: string; start_date: string; end_date: string; }
interface PeriodClose { assigned_rep_id: string; prix: number; sale_type: string; }

function medal(i: number) {
  if (i===0) return '🥇'; if (i===1) return '🥈'; if (i===2) return '🥉';
  return `${i+1}.`;
}

const TIER_COLORS: Record<string,string> = { 'Élite':'#F59E0B','Tier 3':'#A78BFA','Tier 2':'#1B9EF3','Débutant':'#9CA3AF' };

export default function LeaderboardClient({ profile, userId, stats, payPeriods, currentPeriodId }: {
  profile: Profile; userId: string; stats: RepStat[];
  payPeriods: PayPeriod[]; currentPeriodId: string | null;
}) {
  const supabase = createClient();
  const [sort, setSort] = useState<'closes'|'revenue'|'rate'>('closes');
  const [periodId, setPeriodId] = useState<string>(currentPeriodId || 'all');
  const [periodCloses, setPeriodCloses] = useState<PeriodClose[] | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  async function loadPeriod(id: string) {
    if (id === 'all') { setPeriodCloses(null); return; }
    const period = payPeriods.find(p => p.id === id);
    if (!period) return;
    setLoadingPeriod(true);
    const { data } = await supabase
      .from('leads')
      .select('assigned_rep_id, prix, sale_type')
      .eq('ping_type', 'close')
      .gte('appointment_date', period.start_date)
      .lte('appointment_date', period.end_date);
    setPeriodCloses(data || []);
    setLoadingPeriod(false);
  }

  // Build per-rep stats for selected period
  const displayStats = useMemo(() => {
    if (!periodCloses || periodId === 'all') return stats;

    // Aggregate period closes by rep
    const repMap: Record<string, { d2d_closes: number; recall_closes: number; d2d_revenue: number; recall_revenue: number }> = {};
    periodCloses.forEach(c => {
      if (!repMap[c.assigned_rep_id]) repMap[c.assigned_rep_id] = { d2d_closes: 0, recall_closes: 0, d2d_revenue: 0, recall_revenue: 0 };
      if (c.sale_type === 'recall') { repMap[c.assigned_rep_id].recall_closes++; repMap[c.assigned_rep_id].recall_revenue += c.prix || 0; }
      else { repMap[c.assigned_rep_id].d2d_closes++; repMap[c.assigned_rep_id].d2d_revenue += c.prix || 0; }
    });

    return stats.map(s => {
      const p = repMap[s.rep_id] || { d2d_closes: 0, recall_closes: 0, d2d_revenue: 0, recall_revenue: 0 };
      return {
        ...s,
        sr_closes: p.d2d_closes, recall_closes: p.recall_closes, total_closes: p.d2d_closes + p.recall_closes,
        d2d_revenue: p.d2d_revenue, recall_revenue: p.recall_revenue,
        total_revenue: p.d2d_revenue + p.recall_revenue,
        close_rate: 0, avg_deal_size: p.d2d_closes > 0 ? p.d2d_revenue / p.d2d_closes : 0,
      };
    }).filter(s => s.total_closes > 0);
  }, [stats, periodCloses, periodId]);

  const sorted = [...displayStats].sort((a, b) => {
    if (sort==='closes') return b.sr_closes - a.sr_closes;
    if (sort==='revenue') return (b.total_revenue||0) - (a.total_revenue||0);
    return (b.close_rate||0) - (a.close_rate||0);
  });

  const myStats = displayStats.find(s => s.rep_id === userId);
  const myRank = sorted.findIndex(s => s.rep_id === userId) + 1;
  const totalCloses = displayStats.reduce((s,r) => s + r.sr_closes, 0);
  const totalRevenue = displayStats.reduce((s,r) => s + (r.total_revenue||0), 0);

  return (
    <div style={{ padding: '16px 20px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Classement</h1>
          <p style={{ fontSize: 12, color: '#5A8AA8', margin: '3px 0 0' }}>
            {totalCloses} closes D2D · ${Math.round(totalRevenue).toLocaleString('fr-CA')}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ marginBottom: 14 }}>
        <select
          value={periodId}
          onChange={e => { setPeriodId(e.target.value); loadPeriod(e.target.value); }}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: '#E2EEF8', fontSize: 13 }}>
          <option value="all">Toute l'année</option>
          {payPeriods.map(p => (
            <option key={p.id} value={p.id}>
              {p.id === currentPeriodId ? `▶ ${p.label} (actuelle)` : p.label}
            </option>
          ))}
        </select>
        {loadingPeriod && <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 4 }}>Chargement...</div>}
      </div>

      {/* Sort tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['closes','Closes D2D'],['revenue','Revenu'],['rate','Taux']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setSort(k)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: sort===k?'#1B9EF3':'#132D45', color: sort===k?'white':'#6B8AA8' }}>
            {l}
          </button>
        ))}
      </div>

      {/* My summary */}
      {myStats && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#5A8AA8', fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>MON RÉSUMÉ {periodId !== 'all' && `— ${payPeriods.find(p=>p.id===periodId)?.label}`}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'D2D', value: myStats.sr_closes, color: '#22C55E' },
              { label: 'Rappels', value: myStats.recall_closes||0, color: '#A78BFA' },
              { label: 'Revenu', value: `$${Math.round(myStats.total_revenue||0).toLocaleString('fr-CA')}`, color: '#1B9EF3' },
              { label: 'Rang', value: `#${myRank}`, color: '#F59E0B' },
              { label: 'Comm.', value: `${(getCommissionRate(myStats.sr_closes)*100).toFixed(1)}%`, color: TIER_COLORS[getTierLabel(myStats.sr_closes)] },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', flex: 1, minWidth: 50 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#5A8AA8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88' }}>
          Aucune donnée pour cette période
        </div>
      ) : (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
          {sorted.map((rep, i) => {
            const tier = getTierLabel(rep.sr_closes);
            const tc = TIER_COLORS[tier] || '#9CA3AF';
            const isMe = rep.rep_id === userId;
            return (
              <div key={rep.rep_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i<sorted.length-1?'1px solid #0F1E30':'none', background: isMe?'#0D2E4A':i%2===0?'#0A1628':'#0C1B30' }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: i<3?18:13, flexShrink: 0, color: '#5A8AA8', fontWeight: 700 }}>{medal(i)}</div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: tc+'22', border: `2px solid ${tc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: tc, flexShrink: 0 }}>
                  {rep.full_name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: isMe?'#1B9EF3':'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {rep.full_name.split(' ')[0]} {rep.full_name.split(' ')[1]?.charAt(0)}.
                    {isMe && <span style={{ fontSize: 10, color: '#1B9EF3' }}>← moi</span>}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 1 }}>
                    <span style={{ color: tc }}>{tier}</span>
                    <span style={{ color: '#4A6A88', marginLeft: 6 }}>{(getCommissionRate(rep.sr_closes)*100).toFixed(1)}%</span>
                    {(rep.recall_closes||0) > 0 && <span style={{ color: '#A78BFA', marginLeft: 6 }}>{rep.recall_closes} rappels</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', lineHeight: 1 }}>{rep.sr_closes}</div>
                  <div style={{ fontSize: 10, color: '#5A8AA8' }}>closes D2D</div>
                  {rep.total_revenue > 0 && <div style={{ fontSize: 10, color: '#A78BFA' }}>${Math.round(rep.total_revenue/1000)}k</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
