import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  // Full leaderboard stats
  const { data: stats } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .order('sr_closes', { ascending: false });

  // Monthly closes for last 12 months
  const { data: monthly } = await supabase
    .from('leads')
    .select('appointment_date, prix')
    .eq('ping_type', 'close')
    .not('appointment_date', 'is', null)
    .gte('appointment_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Group by month
  const monthlyMap: Record<string, { closes: number; revenue: number }> = {};
  (monthly || []).forEach(c => {
    const m = (c.appointment_date as string).slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { closes: 0, revenue: 0 };
    monthlyMap[m].closes++;
    monthlyMap[m].revenue += c.prix || 0;
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);

  const allStats = stats || [];
  const totalCloses = allStats.reduce((s, r) => s + (r.sr_closes || 0), 0);
  const totalRevenue = allStats.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const repsWithRate = allStats.filter(r => r.close_rate > 0);
  const avgCloseRate = repsWithRate.length > 0
    ? repsWithRate.reduce((s, r) => s + r.close_rate, 0) / repsWithRate.length
    : 0;

  return (
    <div style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Stats équipe</h1>
          <p style={{ fontSize: 13, color: '#5A8AA8', margin: '4px 0 0' }}>Données SalesRabbit en temps réel</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/ventes" style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, textDecoration: 'none', border: '1px solid #1E3A5F' }}>← Ventes</a>
          <a href="/historique" style={{ padding: '6px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📋 Historique</a>
        </div>
      </div>

      {/* Team totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total closes équipe', value: totalCloses, color: '#22C55E', sub: 'depuis SR' },
          { label: 'Revenu total', value: `$${Math.round(totalRevenue).toLocaleString('fr-CA')}`, color: '#1B9EF3', sub: 'toutes périodes' },
          { label: 'Deal moyen', value: totalCloses > 0 ? `$${Math.round(totalRevenue / totalCloses)}` : '—', color: '#A78BFA', sub: 'par close' },
          { label: 'Taux moyen équipe', value: `${avgCloseRate.toFixed(1)}%`, color: '#F59E0B', sub: 'close rate' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: '#3A5F80', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Per rep table */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#E2EEF8', marginBottom: 12 }}>Par vendeur</h2>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 60px 44px 50px', padding: '8px 14px', background: '#132D45', fontSize: 11, color: '#5A8AA8', fontWeight: 700, gap: 4 }}>
              <span>Vendeur</span>
              <span style={{ textAlign: 'right' }}>Cls</span>
              <span style={{ textAlign: 'right' }}>Revenu</span>
              <span style={{ textAlign: 'right' }}>Taux</span>
              <span style={{ textAlign: 'right' }}>Moy.</span>
            </div>
            {allStats.filter(r => r.sr_closes > 0).map((r, i) => (
              <div key={r.rep_id} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 60px 44px 50px', padding: '10px 14px', borderBottom: i < allStats.length - 1 ? '1px solid #0F1E30' : 'none', background: i % 2 === 0 ? '#0A1628' : '#0C1B30', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {r.full_name.split(' ')[0]} {r.full_name.split(' ')[1]?.charAt(0)}.
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', textAlign: 'right' }}>{r.sr_closes}</div>
                <div style={{ fontSize: 11, color: '#1B9EF3', textAlign: 'right' }}>${Math.round((r.total_revenue || 0) / 1000)}k</div>
                <div style={{ fontSize: 11, color: '#F59E0B', textAlign: 'right' }}>{r.close_rate || 0}%</div>
                <div style={{ fontSize: 11, color: '#A78BFA', textAlign: 'right' }}>${Math.round(r.avg_deal_size || 0)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly chart */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#E2EEF8', marginBottom: 12 }}>Par mois (12 derniers mois)</h2>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
            {monthlyData.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#4A6A88', fontSize: 13 }}>
                Aucune donnée mensuelle — les RDV sans date ne sont pas comptés
              </div>
            )}
            {monthlyData.map(([month, data], i) => {
              const label = new Date(month + '-15').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long' });
              const maxCloses = Math.max(...monthlyData.map(([, d]) => d.closes), 1);
              const pct = (data.closes / maxCloses) * 100;
              return (
                <div key={month} style={{ padding: '10px 14px', borderBottom: i < monthlyData.length - 1 ? '1px solid #0F1E30' : 'none', background: i % 2 === 0 ? '#0A1628' : '#0C1B30' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#8BAEC8', textTransform: 'capitalize' }}>{label}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>{data.closes} closes</span>
                      <span style={{ fontSize: 12, color: '#1B9EF3' }}>${Math.round(data.revenue).toLocaleString('fr-CA')}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#22C55E', width: `${pct}%`, transition: 'width .3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}