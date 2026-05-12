'use client';
import { useState } from 'react';

interface RepPaycheck {
  rep_id: string; full_name: string;
  completed_jobs: number; scheduled_jobs: number;
  confirmed_revenue: number; expected_revenue: number;
  confirmed_commission: number; expected_commission: number;
  d2d_rate: number; recall_rate: number;
  tier: string; cumul_completed: number;
  completed_details: any[];
  scheduled_details: any[];
}

interface PeriodData {
  period: { id: string; label: string; start_date: string; end_date: string };
  repBreakdown: RepPaycheck[];
  totalConfirmed: number;
  totalExpected: number;
  totalConfirmedRevenue: number;
  totalScheduledRevenue: number;
  completedJobs: number;
  scheduledJobs: number;
  unmatchedCount: number;
  unmatchedRevenue: number;
}

const TIER_COLORS: Record<string, string> = {
  'Élite': '#F59E0B', 'Tier 3': '#A78BFA', 'Tier 2': '#1B9EF3', 'Débutant': '#9CA3AF'
};

function fmt(n: number) {
  if (!n || isNaN(n)) return '$0.00';
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function fmtR(n: number) {
  if (!n || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('fr-CA');
}

export default function PayrollClient({
  periodPaychecks, userId, jobberLastSync, currentPeriodIndex, jobberAuthUrl
}: {
  periodPaychecks: PeriodData[];
  userId: string;
  jobberLastSync: string;
  currentPeriodIndex: number;
  jobberAuthUrl: string;
}) {
  const [idx, setIdx] = useState(currentPeriodIndex >= 0 ? currentPeriodIndex : 0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const current = periodPaychecks[idx];
  const neverSynced = jobberLastSync.startsWith('2020');
  const today = new Date().toISOString().split('T')[0];

  async function syncJobber() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/jobber/sync', { method: 'POST' });
      const d = await res.json();
      setSyncResult(d);
      if (d.success) setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) { setSyncResult({ error: String(e.message) }); }
    setSyncing(false);
  }

  if (!periodPaychecks.length) return <div style={{ padding: 40, color: '#4A6A88', textAlign: 'center' }}>Aucune période</div>;

  const isPast = current?.period.end_date < today;
  const isCurrent = current?.period.start_date <= today && current?.period.end_date >= today;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            {neverSynced
              ? <span style={{ color: '#EF4444' }}>⚠️ Jobber non connecté — <a href={jobberAuthUrl} style={{ color: '#1B9EF3' }}>Connecter</a></span>
              : <span style={{ color: '#5A8AA8' }}>Jobber ✅ {new Date(jobberLastSync).toLocaleDateString('fr-CA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {neverSynced && <a href={jobberAuthUrl} style={{ padding: '7px 12px', borderRadius: 8, background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B55', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>🔗 Connecter</a>}
          <button onClick={syncJobber} disabled={syncing}
                  style={{ padding: '7px 14px', borderRadius: 8, background: syncing ? '#132D45' : '#1B9EF322', color: '#1B9EF3', border: '1px solid #1B9EF355', fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
            {syncing ? '⌛ Sync...' : '🔄 Sync Jobber'}
          </button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: syncResult.success ? '#0F2E1A' : '#2A0F0F', color: syncResult.success ? '#22C55E' : '#EF4444', border: `1px solid ${syncResult.success ? '#22C55E33' : '#EF444433'}`, fontSize: 12, marginBottom: 12 }}>
          {syncResult.needsAuth
            ? <>❌ Reconnecter Jobber — <a href={jobberAuthUrl} style={{ color: '#1B9EF3' }}>Cliquer ici</a></>
            : syncResult.success
              ? <>✅ {syncResult.synced} jobs · ✓ {syncResult.completed} complétés · ⏳ {syncResult.scheduled} planifiés
                {syncResult.jobberStatuses && <span style={{ color: '#5A8AA8', marginLeft: 8 }}>Statuts Jobber: {JSON.stringify(syncResult.jobberStatuses)}</span>}
              </>
              : `❌ ${syncResult.error}${syncResult.detail ? ' — ' + syncResult.detail : ''}`
          }
        </div>
      )}

      {/* Period nav */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setIdx(i => Math.min(i + 1, periodPaychecks.length - 1))} disabled={idx >= periodPaychecks.length - 1}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx >= periodPaychecks.length - 1 ? '#3A5F80' : '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>←</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              {current?.period.label}
              {isCurrent && <span style={{ fontSize: 11, color: '#22C55E', marginLeft: 8 }}>● En cours</span>}
              {isPast && <span style={{ fontSize: 11, color: '#5A8AA8', marginLeft: 8 }}>Terminée</span>}
            </div>
            <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 2 }}>{current?.period.start_date} → {current?.period.end_date}</div>
          </div>
          <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx <= 0}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx <= 0 ? '#3A5F80' : '#8BAEC8', cursor: 'pointer', fontSize: 14 }}>→</button>
        </div>
        {idx !== currentPeriodIndex && currentPeriodIndex >= 0 && (
          <button onClick={() => setIdx(currentPeriodIndex)}
                  style={{ width: '100%', padding: '6px', borderRadius: 8, background: '#0F2E1A', border: '1px solid #22C55E33', color: '#22C55E', fontSize: 12, cursor: 'pointer' }}>
            ▶ Période actuelle
          </button>
        )}
      </div>

      {!current ? null : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, letterSpacing: 0.8 }}>ATTENDU</div>
              <div style={{ fontSize: 10, color: '#4A6A88', marginBottom: 4 }}>planifiés dans la période</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>{fmtR(current.totalExpected)}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8' }}>{current.scheduledJobs + current.completedJobs} jobs · {fmtR(current.totalConfirmedRevenue + current.totalScheduledRevenue)} revenu</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: current.completedJobs > 0 ? '#0F2E1A' : '#0F1E35', border: `1px solid ${current.completedJobs > 0 ? '#22C55E33' : '#1E3A5F'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, letterSpacing: 0.8 }}>CONFIRMÉ</div>
              <div style={{ fontSize: 10, color: '#4A6A88', marginBottom: 4 }}>jobs complétés Jobber</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: current.completedJobs > 0 ? '#22C55E' : '#4A6A88' }}>
                {current.completedJobs > 0 ? fmtR(current.totalConfirmed) : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#6B8AA8' }}>{current.completedJobs} complétés · {fmtR(current.totalConfirmedRevenue)} revenu</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: `1px solid ${current.unmatchedCount > 0 ? '#EF444433' : '#1E3A5F'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, letterSpacing: 0.8 }}>NON ASSIGNÉS</div>
              <div style={{ fontSize: 10, color: '#4A6A88', marginBottom: 4 }}>pas de vendeur trouvé</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: current.unmatchedCount > 0 ? '#EF4444' : '#4A6A88' }}>
                {current.unmatchedCount > 0 ? current.unmatchedCount : '✓'}
              </div>
              <div style={{ fontSize: 11, color: '#6B8AA8' }}>{current.unmatchedCount > 0 ? fmtR(current.unmatchedRevenue) + ' non assigné' : 'tous assignés'}</div>
            </div>
          </div>

          {current.unmatchedCount > 0 && (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#2A0F0F', border: '1px solid #EF444433', fontSize: 11, color: '#EF4444', marginBottom: 12 }}>
              ⚠️ {current.unmatchedCount} jobs Jobber sans vendeur SR correspondant — adresse non trouvée dans SR. Ces jobs ne sont pas comptés dans les commissions.
            </div>
          )}

          {/* Rep paychecks */}
          {current.repBreakdown.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4A6A88', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F' }}>
              Aucun job Jobber assigné à un vendeur dans cette période
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
              {current.repBreakdown.sort((a, b) => b.confirmed_commission - a.confirmed_commission).map((rep, i) => {
                const tc = TIER_COLORS[rep.tier] || '#9CA3AF';
                const isMe = rep.rep_id === userId;

                return (
                  <details key={rep.rep_id} style={{ borderBottom: i < current.repBreakdown.length - 1 ? '1px solid #0F1E30' : 'none' }}>
                    <summary style={{ padding: '12px 14px', background: isMe ? '#0D2E4A' : i % 2 === 0 ? '#0A1628' : '#0C1B30', cursor: 'pointer', listStyle: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? '#1B9EF3' : 'white' }}>{rep.full_name}</div>
                          <div style={{ fontSize: 11, marginTop: 2 }}>
                            <span style={{ color: '#22C55E' }}>✓ {rep.completed_jobs} complétés</span>
                            {rep.scheduled_jobs > 0 && <span style={{ color: '#F59E0B', marginLeft: 8 }}>⏳ {rep.scheduled_jobs} planifiés</span>}
                            <span style={{ color: tc, marginLeft: 8 }}>{rep.tier} · {(rep.d2d_rate*100).toFixed(1)}% · #{rep.cumul_completed} total</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#4A6A88', marginTop: 2 }}>
                            Confirmé: {fmtR(rep.confirmed_revenue)} × {(rep.d2d_rate*100).toFixed(1)}% = {fmt(rep.confirmed_commission)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>{fmt(rep.confirmed_commission)}</div>
                          <div style={{ fontSize: 11, color: '#F59E0B' }}>+ {fmt(rep.expected_commission - rep.confirmed_commission)} si tous complétés</div>
                        </div>
                      </div>
                    </summary>

                    <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                      {/* Completed jobs */}
                      {rep.completed_details.length > 0 && (<>
                        <div style={{ padding: '5px 14px', fontSize: 10, color: '#22C55E', fontWeight: 700, background: '#0A1628' }}>
                          ✓ COMPLÉTÉS — {fmtR(rep.confirmed_revenue)} → {fmt(rep.confirmed_commission)}
                        </div>
                        {rep.completed_details.map((j: any, ci: number) => (
                          <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 14px 5px 22px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                            <span style={{ flex: 1, color: '#C2D4E8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {j.client_nom}
                              <span style={{ color: j.sale_type==='recall'?'#A78BFA':'#22C55E', marginLeft: 6, fontSize: 10 }}>{j.sale_type==='recall'?'Rappel':'D2D'}</span>
                            </span>
                            <span>
                              <span style={{ color: '#1B9EF3' }}>{fmt(parseFloat(j.prix_final)||0)}</span>
                              <span style={{ color: '#22C55E', marginLeft: 6 }}>→ {fmt((parseFloat(j.prix_final)||0) * (j.sale_type==='recall'?rep.recall_rate:rep.d2d_rate))}</span>
                            </span>
                          </div>
                        ))}
                      </>)}

                      {/* Scheduled jobs */}
                      {rep.scheduled_details.length > 0 && (<>
                        <div style={{ padding: '5px 14px', fontSize: 10, color: '#F59E0B', fontWeight: 700, background: '#0A1628', borderTop: '1px solid #1E3A5F11' }}>
                          ⏳ PLANIFIÉS — {fmtR(rep.scheduled_details.reduce((s: number, j: any) => s + (parseFloat(j.prix_final)||0), 0))} attendu
                        </div>
                        {rep.scheduled_details.map((j: any, ci: number) => (
                          <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 14px 5px 22px', borderTop: '1px solid #0F1E30', fontSize: 11 }}>
                            <span style={{ flex: 1, color: '#8BAEC8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {j.client_nom}
                              <span style={{ color: '#5A8AA8', marginLeft: 6, fontSize: 10 }}>{j.date}</span>
                            </span>
                            <span style={{ color: '#8BAEC8' }}>{fmt(parseFloat(j.prix_final)||0)}</span>
                          </div>
                        ))}
                      </>)}

                      <div style={{ padding: '8px 14px', borderTop: '1px solid #1E3A5F11', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#4A6A88' }}>Palier actuel: {rep.tier} ({rep.cumul_completed} jobs complétés au total)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Paycheck: {fmt(rep.confirmed_commission)}</span>
                      </div>
                    </div>
                  </details>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#132D45', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: '#8BAEC8' }}>Total période</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#22C55E' }}>{fmt(current.totalConfirmed)} confirmé</span>
                  <span style={{ color: '#F59E0B' }}>{fmt(current.totalExpected)} si tout complété</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
