import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { getCommissionRate, getTierLabel, getNextTierInfo } from '@/lib/types';

export default async function VentesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';

  // My closes from SR leads
  const { data: myCloses } = await supabase
    .from('leads')
    .select('id, first_name, last_name, address, city, appointment_date, prix, services_sr, ping_type, status_sr, created_at')
    .eq('assigned_rep_id', user.id)
    .eq('ping_type', 'close')
    .order('appointment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Team closes for managers
  const { data: teamStats } = isManager ? await supabase
    .from('leaderboard_stats')
    .select('*')
    .order('sr_closes', { ascending: false }) : { data: null };

  const closes = myCloses || [];
  const totalRevenue = closes.reduce((s, c) => s + (c.prix || 0), 0);
  const rate = getCommissionRate(closes.length);
  const tier = getTierLabel(closes.length);
  const next = getNextTierInfo(closes.length);
  const commission = totalRevenue * rate;

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Mes Ventes</h1>
          <p style={{ fontSize: 13, color: '#5A8AA8', margin: '4px 0 0' }}>Données en temps réel depuis SalesRabbit</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/historique" style={{ padding: '7px 14px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 13, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📋 Historique</a>
          <a href="/stats" style={{ padding: '7px 14px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 13, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📊 Stats équipe</a>
        </div>
      </div>

      {/* My commission summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Closes confirmés', value: closes.length, color: '#22C55E' },
          { label: 'Revenu total', value: `$${Math.round(totalRevenue).toLocaleString('fr-CA')}`, color: '#1B9EF3' },
          { label: 'Commission estimée', value: `$${Math.round(commission).toLocaleString('fr-CA')}`, color: '#A78BFA' },
          { label: `Taux actuel — ${tier}`, value: `${(rate * 100).toFixed(1)}%`, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tier progress */}
      {next && (
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#6B8AA8' }}>Prochain palier — {(next.rate * 100).toFixed(1)}%</span>
            <span style={{ color: '#1B9EF3', fontWeight: 600 }}>{next.closes} closes restants</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#1B9EF3,#A78BFA)', width: `${Math.min(100, (closes.length / (closes.length + next.closes)) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A6A88', marginTop: 6 }}>
            {[
              { label: 'Débutant', min: 0, rate: '15%' },
              { label: 'Tier 2', min: 150, rate: '17.5%' },
              { label: 'Tier 3', min: 300, rate: '20%' },
              { label: 'Élite 🏆', min: 450, rate: '25%' },
            ].map(t => (
              <span key={t.label} style={{ color: closes.length >= t.min ? '#1B9EF3' : '#3A5F80' }}>{t.label} ({t.rate})</span>
            ))}
          </div>
        </div>
      )}

      {/* My close list */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#E2EEF8', margin: 0 }}>Mes closes ({closes.length})</h2>
      </div>
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
        {closes.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#4A6A88', fontSize: 14 }}>
            Aucun close assigné à votre profil.<br/>
            <span style={{ fontSize: 12, color: '#3A5F80' }}>Les closes sont assignés depuis SalesRabbit via votre nom de vendeur.</span>
          </div>
        )}
        {closes.map((c, i) => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client inconnu';
          const addr = [c.address, c.city].filter(Boolean).join(', ');
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < closes.length - 1 ? '1px solid #0F1E30' : 'none', background: i % 2 === 0 ? '#0A1628' : '#0C1B30' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>{name}</div>
                <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 2 }}>{addr}</div>
                {c.services_sr?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {c.services_sr.map((s: string) => (
                      <span key={s} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#22C55E22', color: '#22C55E' }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                {c.prix > 0 && <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E' }}>${c.prix}</div>}
                <div style={{ fontSize: 11, color: '#4A6A88' }}>{c.appointment_date || '—'}</div>
                {c.prix > 0 && <div style={{ fontSize: 11, color: '#A78BFA' }}>comm. ${Math.round(c.prix * rate)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
