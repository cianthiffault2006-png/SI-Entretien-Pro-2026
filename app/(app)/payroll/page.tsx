import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { getCommissionRate, getTierLabel } from '@/lib/types';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';
  if (!isManager) redirect('/dashboard');

  // Pull full leaderboard stats
  const { data: stats } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .order('sr_closes', { ascending: false });

  // Also get individual closes per rep for breakdown
  const { data: repCloses } = await supabase
    .from('leads')
    .select('assigned_rep_id, prix, appointment_date, first_name, last_name, address, city')
    .eq('ping_type', 'close')
    .not('assigned_rep_id', 'is', null)
    .order('appointment_date', { ascending: false, nullsFirst: false });

  // Group closes by rep
  const closesByRep: Record<string, any[]> = {};
  (repCloses || []).forEach(c => {
    if (!closesByRep[c.assigned_rep_id]) closesByRep[c.assigned_rep_id] = [];
    closesByRep[c.assigned_rep_id].push(c);
  });

  const allStats = stats || [];
  const totalRevenue = allStats.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalCommission = allStats.reduce((s, r) => {
    const rate = getCommissionRate(r.sr_closes);
    return s + (r.total_revenue || 0) * rate;
  }, 0);

  return (
    <div style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
        <p style={{ fontSize: 13, color: '#5A8AA8', margin: '4px 0 0' }}>
          Commissions calculées depuis SalesRabbit · Données en temps réel
        </p>
      </div>

      {/* Team totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Revenu total équipe', value: `$${Math.round(totalRevenue).toLocaleString('fr-CA')}`, color: '#1B9EF3' },
          { label: 'Commissions totales dues', value: `$${Math.round(totalCommission).toLocaleString('fr-CA')}`, color: '#22C55E' },
          { label: 'Closes totaux', value: allStats.reduce((s, r) => s + r.sr_closes, 0), color: '#A78BFA' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per rep breakdown */}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 70px 90px 100px', padding: '10px 16px', background: '#132D45', fontSize: 11, color: '#5A8AA8', fontWeight: 700, gap: 8 }}>
          <span>Vendeur</span>
          <span style={{ textAlign: 'right' }}>Closes</span>
          <span style={{ textAlign: 'right' }}>Revenu</span>
          <span style={{ textAlign: 'right' }}>Taux</span>
          <span style={{ textAlign: 'right' }}>Commission</span>
          <span style={{ textAlign: 'right' }}>Palier</span>
        </div>

        {allStats.filter(r => r.sr_closes > 0).map((rep, i) => {
          const rate = getCommissionRate(rep.sr_closes);
          const tier = getTierLabel(rep.sr_closes);
          const commission = (rep.total_revenue || 0) * rate;
          const tierColors: Record<string, string> = {
            'Élite': '#F59E0B', 'Tier 3': '#A78BFA', 'Tier 2': '#1B9EF3', 'Débutant': '#9CA3AF'
          };
          const tierColor = tierColors[tier] || '#9CA3AF';

          return (
            <details key={rep.rep_id}
                     style={{ borderBottom: i < allStats.length - 1 ? '1px solid #0F1E30' : 'none' }}>
              <summary style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 70px 90px 100px', padding: '12px 16px', background: i % 2 === 0 ? '#0A1628' : '#0C1B30', gap: 8, alignItems: 'center', cursor: 'pointer', listStyle: 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>{rep.full_name}</div>
                  <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 1 }}>
                    {rep.close_rate > 0 ? `${rep.close_rate}% close rate` : '—'}
                    {rep.avg_deal_size > 0 ? ` · moy. $${Math.round(rep.avg_deal_size)}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#22C55E', textAlign: 'right' }}>{rep.sr_closes}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1B9EF3', textAlign: 'right' }}>${Math.round(rep.total_revenue || 0).toLocaleString('fr-CA')}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tierColor, textAlign: 'right' }}>{(rate * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', textAlign: 'right' }}>${Math.round(commission).toLocaleString('fr-CA')}</div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: tierColor + '22', color: tierColor, fontWeight: 600 }}>
                    {tier}
                  </span>
                </div>
              </summary>

              {/* Expandable: individual closes */}
              {closesByRep[rep.rep_id]?.length > 0 && (
                <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                  <div style={{ padding: '6px 16px', fontSize: 11, color: '#4A6A88', fontWeight: 700, letterSpacing: 1 }}>
                    DÉTAIL DES CLOSES — cliquez sur le nom pour ouvrir
                  </div>
                  {closesByRep[rep.rep_id].slice(0, 20).map((c, ci) => {
                    const cName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                    const cAddr = [c.address, c.city].filter(Boolean).join(', ');
                    const cComm = (c.prix || 0) * rate;
                    return (
                      <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 8px 32px', borderTop: '1px solid #0F1E30', fontSize: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#C2D4E8', fontWeight: 500 }}>{cName}</div>
                          <div style={{ color: '#4A6A88', fontSize: 11 }}>{cAddr} {c.appointment_date ? `· ${c.appointment_date}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                          {c.prix > 0 && <div style={{ color: '#1B9EF3', fontWeight: 600 }}>${c.prix}</div>}
                          {cComm > 0 && <div style={{ color: '#22C55E', fontSize: 11 }}>comm. ${Math.round(cComm)}</div>}
                        </div>
                      </div>
                    );
                  })}
                  {closesByRep[rep.rep_id].length > 20 && (
                    <div style={{ padding: '6px 16px 10px 32px', fontSize: 11, color: '#4A6A88' }}>
                      + {closesByRep[rep.rep_id].length - 20} autres closes non affichés
                    </div>
                  )}
                </div>
              )}
            </details>
          );
        })}

        {allStats.filter(r => r.sr_closes > 0).length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4A6A88', fontSize: 14 }}>
            Aucune donnée — les closes de SalesRabbit doivent être importés d'abord.
          </div>
        )}
      </div>

      {/* Note */}
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', fontSize: 12, color: '#5A8AA8' }}>
        💡 <strong style={{ color: '#8BAEC8' }}>Note:</strong> Les commissions sont calculées sur le revenu total des closes dans SalesRabbit.
        Le taux s'applique selon le palier atteint — plus de closes = meilleur taux sur <em>tous</em> les closes.
        Cliquez sur un vendeur pour voir le détail de ses closes.
      </div>
    </div>
  );
}