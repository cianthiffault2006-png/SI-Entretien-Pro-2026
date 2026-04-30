'use client';
import { useState } from 'react';

interface RepPaycheck {
  rep_id: string; full_name: string;
  d2d_closes: number; recall_closes: number;
  d2d_revenue: number; recall_revenue: number;
  d2d_commission: number; recall_commission: number;
  total_commission: number;
  d2d_rate: number; recall_rate: number; tier: string;
  closes: any[];
}

interface PeriodData {
  period: { id: string; label: string; start_date: string; end_date: string; is_closed: boolean };
  repBreakdown: RepPaycheck[];
  totalCommission: number;
  totalCloses: number;
  jobberRevenue: number;
  jobberJobs: number;
}

const TIER_COLORS: Record<string, string> = {
  'Élite': '#F59E0B', 'Tier 3': '#A78BFA', 'Tier 2': '#1B9EF3', 'Débutant': '#9CA3AF'
};

function fmtMoney(n: number) { return `$${Math.round(n).toLocaleString('fr-CA')}`; }

export default function PayrollClient({ periodPaychecks, isManager, userId, jobberLastSync }: {
  periodPaychecks: PeriodData[]; isManager: boolean; userId: string; jobberLastSync: string;
}) {
  const [selected, setSelected] = useState(0); // index into periodPaychecks
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const current = periodPaychecks[selected];

  async function syncJobber() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch('/api/jobber/sync', { method: 'POST' });
      const d = await res.json();
      setSyncMsg(d.success ? `✅ ${d.synced} jobs Jobber importés` : `❌ ${d.error || 'Erreur'}`);
    } catch { setSyncMsg('❌ Erreur réseau'); }
    setSyncing(false);
  }

  const neverSynced = jobberLastSync.startsWith('2020');

  return (
    <div style={{ padding: '16px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
          <p style={{ fontSize: 12, color: '#5A8AA8', margin: '3px 0 0' }}>Commissions calculées par période · basées sur les closes SR</p>
        </div>
        <button onClick={syncJobber} disabled={syncing}
                style={{ padding: '7px 14px', borderRadius: 8, background: syncing ? '#132D45' : '#1B9EF322', color: '#1B9EF3', border: '1px solid #1B9EF355', fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
          {syncing ? '⌛ Sync...' : '🔄 Sync Jobber'}
        </button>
      </div>

      {/* Jobber sync status */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#0F1E35', border: `1px solid ${neverSynced ? '#EF444433' : '#1E3A5F'}`, marginBottom: syncMsg ? 8 : 14, fontSize: 12, color: neverSynced ? '#EF4444' : '#5A8AA8' }}>
        Jobber: {neverSynced ? '⚠️ Jamais synchronisé — les jobs complétés ne seront pas visibles' : `✅ Dernière sync: ${new Date(jobberLastSync).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
      </div>
      {syncMsg && <div style={{ padding: '8px 12px', borderRadius: 8, background: syncMsg.startsWith('✅') ? '#0F2E1A' : '#2A0F0F', color: syncMsg.startsWith('✅') ? '#22C55E' : '#EF4444', border: `1px solid ${syncMsg.startsWith('✅') ? '#22C55E33' : '#EF444433'}`, fontSize: 12, marginBottom: 14 }}>{syncMsg}</div>}

      {/* Period selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 0.8, marginBottom: 8 }}>PÉRIODE DE PAIE</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {periodPaychecks.map((p, i) => {
            const isActive = i === selected;
            const today = new Date().toISOString().split('T')[0];
            const isCurrent = p.period.start_date <= today && p.period.end_date >= today;
            return (
              <button key={p.period.id} onClick={() => setSelected(i)}
                      style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: isActive ? 700 : 500, border: `1px solid ${isActive ? '#1B9EF3' : isCurrent ? '#22C55E44' : '#1E3A5F'}`, background: isActive ? '#0D2E4A' : isCurrent ? '#0F2E1A' : '#132D45', color: isActive ? '#1B9EF3' : isCurrent ? '#22C55E' : '#8BAEC8', cursor: 'pointer' }}>
                {isCurrent && '▶ '}{p.period.label}
                {p.totalCloses > 0 && <span style={{ marginLeft: 5, fontSize: 10, color: isActive ? '#1B9EF3' : '#4A6A88' }}>({p.totalCloses})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!current ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88' }}>Aucune période sélectionnée</div>
      ) : (
        <>
          {/* Period summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>{current.totalCloses}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Closes SR</div>
              <div style={{ fontSize: 10, color: '#3A5F80', marginTop: 1 }}>{current.period.start_date} → {current.period.end_date}</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1B9EF3' }}>{fmtMoney(current.totalCommission)}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Commissions totales</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: current.jobberJobs > 0 ? '#0F2E1A' : '#0F1E35', border: `1px solid ${current.jobberJobs > 0 ? '#22C55E33' : '#1E3A5F'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: current.jobberJobs > 0 ? '#22C55E' : '#4A6A88' }}>{current.jobberJobs}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Jobs Jobber complétés</div>
              {current.jobberRevenue > 0 && <div style={{ fontSize: 10, color: '#22C55E', marginTop: 1 }}>{fmtMoney(current.jobberRevenue)}</div>}
            </div>
          </div>

          {/* Per rep paychecks */}
          {current.repBreakdown.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88', fontSize: 13 }}>
              Aucun close dans cette période
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px 90px 90px', padding: '8px 14px', background: '#132D45', fontSize: 11, color: '#5A8AA8', fontWeight: 700, gap: 8 }}>
                <span>Vendeur</span>
                <span style={{ textAlign: 'right' }}>D2D</span>
                <span style={{ textAlign: 'right' }}>Rappels</span>
                <span style={{ textAlign: 'right' }}>Taux</span>
                <span style={{ textAlign: 'right' }}>Revenu</span>
                <span style={{ textAlign: 'right' }}>💵 Paycheck</span>
              </div>

              {current.repBreakdown.sort((a, b) => b.total_commission - a.total_commission).map((rep, i) => {
                const tc = TIER_COLORS[rep.tier] || '#9CA3AF';
                const isMe = rep.rep_id === userId;
                return (
                  <details key={rep.rep_id} style={{ borderBottom: i < current.repBreakdown.length - 1 ? '1px solid #0F1E30' : 'none' }}>
                    <summary style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px 90px 90px', padding: '12px 14px', background: isMe ? '#0D2E4A' : i % 2 === 0 ? '#0A1628' : '#0C1B30', gap: 8, alignItems: 'center', cursor: 'pointer', listStyle: 'none' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: isMe ? '#1B9EF3' : 'white' }}>{rep.full_name}</div>
                        <div style={{ fontSize: 10, color: tc, marginTop: 1 }}>{rep.tier} · {(rep.d2d_rate * 100).toFixed(1)}%</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', textAlign: 'right' }}>{rep.d2d_closes}</div>
                      <div style={{ fontSize: 13, fontWeight: rep.recall_closes > 0 ? 700 : 400, color: rep.recall_closes > 0 ? '#A78BFA' : '#4A6A88', textAlign: 'right' }}>{rep.recall_closes || '—'}</div>
                      <div style={{ fontSize: 11, color: tc, textAlign: 'right', fontWeight: 600 }}>{(rep.d2d_rate * 100).toFixed(1)}%</div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#1B9EF3' }}>{fmtMoney(rep.d2d_revenue + rep.recall_revenue)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#22C55E' }}>{fmtMoney(rep.total_commission)}</div>
                        {rep.recall_commission > 0 && (
                          <div style={{ fontSize: 10, color: '#A78BFA' }}>+{fmtMoney(rep.recall_commission)} rappels</div>
                        )}
                      </div>
                    </summary>

                    {/* Expandable closes detail */}
                    <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                      {/* D2D closes */}
                      {rep.closes.filter((c: any) => c.sale_type !== 'recall').length > 0 && (
                        <>
                          <div style={{ padding: '6px 14px', fontSize: 10, color: '#22C55E', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628' }}>
                            🚪 D2D — {(rep.d2d_rate * 100).toFixed(1)}% · {fmtMoney(rep.d2d_commission)}
                          </div>
                          {rep.closes.filter((c: any) => c.sale_type !== 'recall').slice(0, 10).map((c: any, ci: number) => {
                            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                            return (
                              <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px 6px 24px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                                <span style={{ color: '#C2D4E8' }}>{name} <span style={{ color: '#3A5F80' }}>{[c.address, c.city].filter(Boolean).join(', ')}</span></span>
                                <span>
                                  {c.prix > 0 && <><span style={{ color: '#1B9EF3' }}>{fmtMoney(c.prix)}</span><span style={{ color: '#22C55E', marginLeft: 8 }}>+{fmtMoney(c.prix * rep.d2d_rate)}</span></>}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                      {/* Recall closes */}
                      {rep.closes.filter((c: any) => c.sale_type === 'recall').length > 0 && (
                        <>
                          <div style={{ padding: '6px 14px', fontSize: 10, color: '#A78BFA', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628', borderTop: '1px solid #1E3A5F22' }}>
                            📞 RAPPELS — {fmtMoney(rep.recall_commission)}
                          </div>
                          {rep.closes.filter((c: any) => c.sale_type === 'recall').slice(0, 10).map((c: any, ci: number) => {
                            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                            return (
                              <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px 6px 24px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                                <span style={{ color: '#C2D4E8' }}>{name}</span>
                                <span>
                                  {c.prix > 0 && <><span style={{ color: '#A78BFA' }}>{fmtMoney(c.prix)}</span><span style={{ color: '#22C55E', marginLeft: 8 }}>+{fmtMoney(c.prix * rep.recall_rate)}</span></>}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                      <div style={{ padding: '8px 14px', fontSize: 10, color: '#4A6A88', borderTop: '1px solid #1E3A5F11', textAlign: 'right' }}>
                        Total paycheck: <strong style={{ color: '#22C55E', fontSize: 12 }}>{fmtMoney(rep.total_commission)}</strong>
                      </div>
                    </div>
                  </details>
                );
              })}

              {/* Period total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#132D45', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#8BAEC8' }}>Total période {current.period.label}</span>
                <span style={{ color: '#22C55E' }}>{fmtMoney(current.totalCommission)}</span>
              </div>
            </div>
          )}

          {/* Note about Jobber */}
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#0F1E35', border: '1px solid #1E3A5F', fontSize: 12, color: '#5A8AA8' }}>
            💡 Les commissions sont calculées sur les closes SR avec date de RDV dans la période.
            Les jobs Jobber complétés ({current.jobberJobs}) servent à confirmer que le travail a été fait.
            {current.jobberJobs === 0 && ' ⚠️ Aucun job Jobber complété — sync nécessaire pour validation.'}
          </div>
        </>
      )}
    </div>
  );
}
