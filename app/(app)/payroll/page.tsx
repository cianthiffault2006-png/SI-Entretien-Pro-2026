import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { getCommissionRate, getTierLabel, getRecallRate, RECALL_RATE_DEFAULT } from '@/lib/types';

const CIAN_ID = '67e2aada-e15d-46a2-871d-d27a5c5ff14e';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';
  const isMe = (repId: string) => repId === user.id;
  const isCian = user.id === CIAN_ID;

  if (!isManager) redirect('/dashboard');

  const { data: stats } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .order('sr_closes', { ascending: false });

  const { data: allCloses } = await supabase
    .from('leads')
    .select('assigned_rep_id, prix, appointment_date, first_name, last_name, address, city, sale_type')
    .eq('ping_type', 'close')
    .not('assigned_rep_id', 'is', null);

  const byRep: Record<string, { d2d: any[]; recall: any[] }> = {};
  (allCloses || []).forEach(c => {
    if (!byRep[c.assigned_rep_id]) byRep[c.assigned_rep_id] = { d2d: [], recall: [] };
    if (c.sale_type === 'recall') byRep[c.assigned_rep_id].recall.push(c);
    else byRep[c.assigned_rep_id].d2d.push(c);
  });

  const allStats = stats || [];
  let totalD2DRevenue = 0, totalRecallRevenue = 0, totalCommission = 0;
  allStats.forEach(r => {
    const d2dRate = getCommissionRate(r.sr_closes);
    const recallRate = getRecallRate(r.rep_id);
    totalD2DRevenue += r.d2d_revenue || 0;
    totalRecallRevenue += r.recall_revenue || 0;
    totalCommission += (r.d2d_revenue || 0) * d2dRate + (r.recall_revenue || 0) * recallRate;
  });

  return (
    <div style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
        <p style={{ fontSize: 13, color: '#5A8AA8', marginTop: 4 }}>Commissions depuis SalesRabbit</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Revenu D2D total', value: `$${Math.round(totalD2DRevenue).toLocaleString('fr-CA')}`, color: '#1B9EF3' },
          { label: 'Revenu Rappels total', value: `$${Math.round(totalRecallRevenue).toLocaleString('fr-CA')}`, color: '#A78BFA' },
          { label: 'Total commissions dues', value: `$${Math.round(totalCommission).toLocaleString('fr-CA')}`, color: '#22C55E' },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rate info — generic, no Cian-specific mention */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', fontSize: 12, color: '#8BAEC8' }}>
          📞 Rappels: <strong style={{ color: '#A78BFA' }}>5%</strong>
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', fontSize: 12, color: '#8BAEC8' }}>
          🚪 D2D: paliers 15% → 17.5% → 20% → 25%
        </div>
      </div>

      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 70px 90px 90px', padding: '10px 16px', background: '#132D45', fontSize: 11, color: '#5A8AA8', fontWeight: 700, gap: 8 }}>
          <span>Vendeur</span>
          <span style={{ textAlign: 'right' }}>D2D</span>
          <span style={{ textAlign: 'right' }}>Rappels</span>
          <span style={{ textAlign: 'right' }}>Taux D2D</span>
          <span style={{ textAlign: 'right' }}>Commission</span>
          <span style={{ textAlign: 'right' }}>Palier</span>
        </div>

        {allStats.filter(r => (r.total_closes || 0) > 0).map((rep, i) => {
          const d2dRate = getCommissionRate(rep.sr_closes);
          // Only show special recall rate to the person themselves or managers
          // We never display who gets what special rate publicly
          const recallRate = getRecallRate(rep.rep_id);
          const tier = getTierLabel(rep.sr_closes);
          const d2dComm = (rep.d2d_revenue || 0) * d2dRate;
          const recallComm = (rep.recall_revenue || 0) * recallRate;
          const totalComm = d2dComm + recallComm;
          const tierColors: Record<string, string> = { 'Élite': '#F59E0B', 'Tier 3': '#A78BFA', 'Tier 2': '#1B9EF3', 'Débutant': '#9CA3AF' };
          const tc = tierColors[tier] || '#9CA3AF';
          const repCloses = byRep[rep.rep_id];

          return (
            <details key={rep.rep_id} style={{ borderBottom: i < allStats.length - 1 ? '1px solid #0F1E30' : 'none' }}>
              <summary style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 70px 90px 90px', padding: '12px 16px', background: i % 2 === 0 ? '#0A1628' : '#0C1B30', gap: 8, alignItems: 'center', cursor: 'pointer', listStyle: 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>{rep.full_name}</div>
                  <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 1 }}>
                    {rep.sr_closes} D2D · {rep.recall_closes || 0} rappels
                    {rep.close_rate > 0 && ` · ${rep.close_rate}% rate`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>{rep.sr_closes}</div>
                  <div style={{ fontSize: 10, color: '#4A6A88' }}>${Math.round(rep.d2d_revenue || 0).toLocaleString('fr-CA')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{rep.recall_closes || 0}</div>
                  <div style={{ fontSize: 10, color: '#4A6A88' }}>${Math.round(rep.recall_revenue || 0).toLocaleString('fr-CA')}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tc, textAlign: 'right' }}>{(d2dRate * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', textAlign: 'right' }}>
                  ${Math.round(totalComm).toLocaleString('fr-CA')}
                  {/* Only show recall rate breakdown to managers (not visible in the column, just in details) */}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: tc + '22', color: tc }}>{tier}</span>
                </div>
              </summary>

              {repCloses && (repCloses.d2d.length > 0 || repCloses.recall.length > 0) && (
                <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                  {repCloses.d2d.length > 0 && <>
                    <div style={{ padding: '6px 16px', fontSize: 11, color: '#22C55E', fontWeight: 700, letterSpacing: 1, background: '#0A1628' }}>
                      🚪 D2D — {(d2dRate * 100).toFixed(1)}% · ${Math.round(d2dComm)} comm.
                    </div>
                    {repCloses.d2d.slice(0, 15).map((c, ci) => {
                      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                      return (
                        <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px 7px 28px', borderTop: '1px solid #0F1E30', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#C2D4E8' }}>{name}</span>
                            <span style={{ color: '#4A6A88', fontSize: 11, marginLeft: 8 }}>{[c.address, c.city].filter(Boolean).join(', ')}</span>
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: 12 }}>
                            {c.prix > 0 && <><span style={{ color: '#1B9EF3' }}>${c.prix}</span><span style={{ color: '#22C55E', marginLeft: 8 }}>+${Math.round(c.prix * d2dRate)}</span></>}
                          </div>
                        </div>
                      );
                    })}
                    {repCloses.d2d.length > 15 && <div style={{ padding: '4px 16px 8px 28px', fontSize: 11, color: '#4A6A88' }}>+ {repCloses.d2d.length - 15} autres</div>}
                  </>}

                  {repCloses.recall.length > 0 && <>
                    <div style={{ padding: '6px 16px', fontSize: 11, color: '#A78BFA', fontWeight: 700, letterSpacing: 1, background: '#0A1628', borderTop: '1px solid #1E3A5F22' }}>
                      {/* Show actual recall rate only to managers — don't mention who gets what rate */}
                      📞 Rappels — ${Math.round(recallComm)} comm.
                    </div>
                    {repCloses.recall.slice(0, 15).map((c, ci) => {
                      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                      return (
                        <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px 7px 28px', borderTop: '1px solid #0F1E30', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#C2D4E8' }}>{name}</span>
                            <span style={{ color: '#4A6A88', fontSize: 11, marginLeft: 8 }}>{[c.address, c.city].filter(Boolean).join(', ')}</span>
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: 12 }}>
                            {c.prix > 0 && <><span style={{ color: '#A78BFA' }}>${c.prix}</span><span style={{ color: '#22C55E', marginLeft: 8 }}>+${Math.round(c.prix * recallRate)}</span></>}
                          </div>
                        </div>
                      );
                    })}
                    {repCloses.recall.length > 15 && <div style={{ padding: '4px 16px 8px 28px', fontSize: 11, color: '#4A6A88' }}>+ {repCloses.recall.length - 15} autres</div>}
                  </>}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
