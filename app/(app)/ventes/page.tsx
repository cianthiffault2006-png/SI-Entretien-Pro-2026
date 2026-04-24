import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { getCommissionRate, getTierLabel, getNextTierInfo, getRecallRate } from '@/lib/types';
import Link from 'next/link';

export default async function VentesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isManager = profile.role === 'admin' || profile.role === 'manager';

  // My closes from SR — split D2D and recall
  const { data: myCloses } = await supabase
    .from('leads')
    .select('id, first_name, last_name, address, city, appointment_date, prix, services_sr, ping_type, status_sr, sale_type, created_at')
    .eq('assigned_rep_id', user.id)
    .eq('ping_type', 'close')
    .order('appointment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const closes = myCloses || [];
  const d2dCloses = closes.filter(c => c.sale_type !== 'recall');
  const recallCloses = closes.filter(c => c.sale_type === 'recall');

  const d2dRevenue = d2dCloses.reduce((s, c) => s + (c.prix || 0), 0);
  const recallRevenue = recallCloses.reduce((s, c) => s + (c.prix || 0), 0);

  const d2dRate = getCommissionRate(d2dCloses.length);
  const recallRate = getRecallRate(user.id); // each rep sees their OWN rate only
  const tier = getTierLabel(d2dCloses.length);
  const next = getNextTierInfo(d2dCloses.length);

  const d2dCommission = d2dRevenue * d2dRate;
  const recallCommission = recallRevenue * recallRate;
  const totalCommission = d2dCommission + recallCommission;

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Mes Ventes</h1>
          <p style={{ fontSize: 13, color: '#5A8AA8', margin: '4px 0 0' }}>Données en temps réel depuis SalesRabbit</p>
        </div>
        {isManager && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/historique" style={{ padding: '7px 14px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 13, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📋 Historique</Link>
            <Link href="/stats" style={{ padding: '7px 14px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 13, textDecoration: 'none', border: '1px solid #1E3A5F' }}>📊 Stats équipe</Link>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 16, borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22C55E' }}>{d2dCloses.length}</div>
          <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 3 }}>Closes D2D</div>
          <div style={{ fontSize: 11, color: '#4A6A88', marginTop: 1 }}>${Math.round(d2dRevenue).toLocaleString('fr-CA')} · {(d2dRate*100).toFixed(1)}% comm.</div>
        </div>
        <div style={{ padding: 16, borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#A78BFA' }}>{recallCloses.length}</div>
          <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 3 }}>Rappels</div>
          {/* Each rep sees their own recall rate — this is private to them */}
          <div style={{ fontSize: 11, color: '#4A6A88', marginTop: 1 }}>${Math.round(recallRevenue).toLocaleString('fr-CA')} · {(recallRate*100).toFixed(1)}% comm.</div>
        </div>
        <div style={{ padding: 16, borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1B9EF3' }}>${Math.round(totalCommission).toLocaleString('fr-CA')}</div>
          <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 3 }}>Commission totale estimée</div>
        </div>
        <div style={{ padding: 16, borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>{(d2dRate*100).toFixed(1)}%</div>
          <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 3 }}>Taux D2D — {tier}</div>
        </div>
      </div>

      {/* Tier progress (D2D only — recall doesn't count) */}
      {next && (
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#6B8AA8' }}>Prochain palier D2D — {(next.rate*100).toFixed(1)}%</span>
            <span style={{ color: '#1B9EF3', fontWeight: 600 }}>{next.closes} closes restants</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#1B9EF3,#A78BFA)', width: `${Math.min(100,(d2dCloses.length/(d2dCloses.length+next.closes))*100)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: '#4A6A88', marginTop: 6 }}>
            ℹ️ Les rappels ne comptent pas vers les paliers — seulement les closes D2D
          </div>
        </div>
      )}

      {/* D2D closes list */}
      {d2dCloses.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', letterSpacing: 1, marginBottom: 8 }}>🚪 CLOSES D2D ({d2dCloses.length})</div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F', marginBottom: 16 }}>
            {d2dCloses.slice(0, 20).map((c, i) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client inconnu';
              const addr = [c.address, c.city].filter(Boolean).join(', ');
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < d2dCloses.length-1 ? '1px solid #0F1E30' : 'none', background: i%2===0?'#0A1628':'#0C1B30' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>{name}</div>
                    <div style={{ fontSize: 11, color: '#5A8AA8' }}>{addr}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    {c.prix > 0 && <><div style={{ fontSize: 15, fontWeight: 700, color: '#22C55E' }}>${c.prix}</div><div style={{ fontSize: 11, color: '#A78BFA' }}>+${Math.round(c.prix*d2dRate)} comm.</div></>}
                    <div style={{ fontSize: 10, color: '#4A6A88' }}>{c.appointment_date || '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recall closes list */}
      {recallCloses.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', letterSpacing: 1, marginBottom: 8 }}>📞 RAPPELS ({recallCloses.length})</div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F', marginBottom: 16 }}>
            {recallCloses.slice(0, 20).map((c, i) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client inconnu';
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < recallCloses.length-1 ? '1px solid #0F1E30' : 'none', background: i%2===0?'#0A1628':'#0C1B30' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>{name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    {c.prix > 0 && <><div style={{ fontSize: 15, fontWeight: 700, color: '#A78BFA' }}>${c.prix}</div><div style={{ fontSize: 11, color: '#22C55E' }}>+${Math.round(c.prix*recallRate)} comm.</div></>}
                    <div style={{ fontSize: 10, color: '#4A6A88' }}>{c.appointment_date || '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {closes.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88' }}>
          Aucun close assigné à votre profil depuis SalesRabbit.
        </div>
      )}
    </div>
  );
}
