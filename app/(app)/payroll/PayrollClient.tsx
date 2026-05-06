'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

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
  period: { id: string; label: string; start_date: string; end_date: string };
  repBreakdown: RepPaycheck[];
  totalCommission: number;
  totalCloses: number;
  jobberRevenue: number;
  jobberJobs: number;
}

const TIER_COLORS: Record<string, string> = {
  'Élite': '#F59E0B', 'Tier 3': '#A78BFA', 'Tier 2': '#1B9EF3', 'Débutant': '#9CA3AF'
};

function fmtMoney(n: number) { return `$${Math.round(n).toLocaleString('fr-CA')}` ; }

export default function PayrollClient({ periodPaychecks, userId, jobberLastSync, currentPeriodIndex }: {
  periodPaychecks: PeriodData[];
  userId: string;
  jobberLastSync: string;
  currentPeriodIndex: number;
}) {
  const supabase = createClient();
  // Default to current period (like leaderboard)
  const [idx, setIdx] = useState(currentPeriodIndex >= 0 ? currentPeriodIndex : 0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const current = periodPaychecks[idx];
  const neverSynced = jobberLastSync.startsWith('2020');

  async function syncJobber() {
    setSyncing(true); setSyncMsg(null);
    try {
      // Use correct path where you placed the file
      const res = await fetch('/api/jobber/sync', { method: 'POST' });
      const d = await res.json();
      setSyncMsg(d.success ? `✅ ${d.synced} jobs Jobber importés` : `❌ ${d.error || 'Erreur'}`);
    } catch { setSyncMsg('❌ Erreur réseau'); }
    setSyncing(false);
  }

  if (!periodPaychecks.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#4A6A88' }}>Aucune période configurée</div>;
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
          <p style={{ fontSize: 12, color: '#5A8AA8', margin: '3px 0 0' }}>
            Jobber: {neverSynced
              ? <span style={{ color: '#EF4444' }}>jamais synchronisé</span>
              : <span style={{ color: '#22C55E' }}>
                  {new Date(jobberLastSync).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
            }
          </p>
        </div>
        <button onClick={syncJobber} disabled={syncing}
                style={{ padding: '7px 14px', borderRadius: 8, background: syncing ? '#132D45' : '#1B9EF322', color: '#1B9EF3', border: '1px solid #1B9EF355', fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
          {syncing ? '⌛ Sync...' : '🔄 Sync Jobber'}
        </button>
      </div>

      {syncMsg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: syncMsg.startsWith('✅') ? '#0F2E1A' : '#2A0F0F', color: syncMsg.startsWith('✅') ? '#22C55E' : '#EF4444', border: `1px solid ${syncMsg.startsWith('✅') ? '#22C55E33' : '#EF444433'}`, fontSize: 12, marginBottom: 12 }}>
          {syncMsg}
        </div>
      )}

      {/* ── PERIOD SELECTOR — same style as leaderboard ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setIdx(i => Math.min(i + 1, periodPaychecks.length - 1))}
                  disabled={idx >= periodPaychecks.length - 1}
                  style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx >= periodPaychecks.length - 1 ? '#3A5F80' : '#8BAEC8', cursor: idx >= periodPaychecks.length - 1 ? 'default' : 'pointer', fontSize: 14 }}>←</button>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{current?.period.label}</div>
            <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 2 }}>
              {current?.period.start_date} → {current?.period.end_date}
            </div>
          </div>

          <button onClick={() => setIdx(i => Math.max(i - 1, 0))}
                  disabled={idx <= 0}
                  style={{ padding: '5px 12px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx <= 0 ? '#3A5F80' : '#8BAEC8', cursor: idx <= 0 ? 'default' : 'pointer', fontSize: 14 }}>→</button>
        </div>

        {/* Quick jump to current period */}
        {idx !== currentPeriodIndex && currentPeriodIndex >= 0 && (
          <button onClick={() => setIdx(currentPeriodIndex)}
                  style={{ width: '100%', padding: '6px', borderRadius: 8, background: '#0F2E1A', border: '1px solid #22C55E33', color: '#22C55E', fontSize: 12, cursor: 'pointer' }}>
            ▶ Retour à la période actuelle
          </button>
        )}
      </div>

      {!current ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88' }}>Aucune donnée</div>
      ) : (
        <>
          {/* Period summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>{current.totalCloses}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Closes SR</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1B9EF3' }}>{fmtMoney(current.totalCommission)}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Commissions totales</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: current.jobberJobs > 0 ? '#0F2E1A' : '#0F1E35', border: `1px solid ${current.jobberJobs > 0 ? '#22C55E33' : '#1E3A5F'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: current.jobberJobs > 0 ? '#22C55E' : '#4A6A88' }}>{current.jobberJobs}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Jobs Jobber complétés</div>
            </div>
          </div>

          {/* Per rep paychecks */}
          {current.repBreakdown.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F', color: '#4A6A88', fontSize: 13 }}>
              Aucun close dans cette période
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
              {current.repBreakdown.sort((a, b) => b.total_commission - a.total_commission).map((rep, i) => {
                const tc = TIER_COLORS[rep.tier] || '#9CA3AF';
                const isMe = rep.rep_id === userId;
                return (
                  <details key={rep.rep_id} style={{ borderBottom: i < current.repBreakdown.length - 1 ? '1px solid #0F1E30' : 'none' }}>
                    <summary style={{ padding: '12px 14px', background: isMe ? '#0D2E4A' : i % 2 === 0 ? '#0A1628' : '#0C1B30', cursor: 'pointer', listStyle: 'none' }}>
                      {/* Mobile-friendly: stacked instead of grid */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: isMe ? '#1B9EF3' : 'white' }}>{rep.full_name}</div>
                          <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 2 }}>
                            <span style={{ color: '#22C55E' }}>{rep.d2d_closes} D2D</span>
                            {rep.recall_closes > 0 && <span style={{ color: '#A78BFA', marginLeft: 8 }}>{rep.recall_closes} rappels</span>}
                            <span style={{ color: tc, marginLeft: 8 }}>{rep.tier} · {(rep.d2d_rate*100).toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E' }}>{fmtMoney(rep.total_commission)}</div>
                          <div style={{ fontSize: 11, color: '#5A8AA8' }}>{fmtMoney(rep.d2d_revenue + rep.recall_revenue)} revenu</div>
                        </div>
                      </div>
                    </summary>

                    {/* Expandable detail */}
                    <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                      {/* D2D */}
                      {rep.d2d_closes > 0 && (<>
                        <div style={{ padding: '6px 14px', fontSize: 10, color: '#22C55E', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628' }}>
                          🚪 D2D — {(rep.d2d_rate*100).toFixed(1)}% · {fmtMoney(rep.d2d_commission)}
                        </div>
                        {rep.closes.filter((c: any) => c.sale_type !== 'recall').slice(0, 15).map((c: any, ci: number) => {
                          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                          return (
                            <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 14px 5px 22px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                              <span style={{ color: '#C2D4E8', minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</span>
                              <span style={{ flexShrink: 0, marginLeft: 8 }}>
                                {c.prix > 0 && <><span style={{ color: '#1B9EF3' }}>{fmtMoney(c.prix)}</span><span style={{ color: '#22C55E', marginLeft: 6 }}>+{fmtMoney(c.prix * rep.d2d_rate)}</span></>}
                              </span>
                            </div>
                          );
                        })}
                      </>)}
                      {/* Recall */}
                      {rep.recall_closes > 0 && (<>
                        <div style={{ padding: '6px 14px', fontSize: 10, color: '#A78BFA', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628', borderTop: '1px solid #1E3A5F22' }}>
                          📞 RAPPELS — {fmtMoney(rep.recall_commission)}
                        </div>
                        {rep.closes.filter((c: any) => c.sale_type === 'recall').slice(0, 15).map((c: any, ci: number) => {
                          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                          return (
                            <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 14px 5px 22px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                              <span style={{ color: '#C2D4E8', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</span>
                              <span style={{ flexShrink: 0, marginLeft: 8 }}>
                                {c.prix > 0 && <><span style={{ color: '#A78BFA' }}>{fmtMoney(c.prix)}</span><span style={{ color: '#22C55E', marginLeft: 6 }}>+{fmtMoney(c.prix * rep.recall_rate)}</span></>}
                              </span>
                            </div>
                          );
                        })}
                      </>)}
                      <div style={{ padding: '8px 14px', borderTop: '1px solid #1E3A5F11', display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Paycheck: {fmtMoney(rep.total_commission)}</span>
                      </div>
                    </div>
                  </details>
                );
              })}

              {/* Period total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#132D45', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#8BAEC8' }}>Total période</span>
                <span style={{ color: '#22C55E' }}>{fmtMoney(current.totalCommission)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
