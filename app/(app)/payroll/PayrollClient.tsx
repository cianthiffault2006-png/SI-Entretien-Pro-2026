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
  null_prix_closes: number;
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

function fmt(n: number) { return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`; }
function fmtR(n: number) { return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`; }

export default function PayrollClient({
  periodPaychecks, userId, jobberLastSync, currentPeriodIndex
}: {
  periodPaychecks: PeriodData[];
  userId: string;
  jobberLastSync: string;
  currentPeriodIndex: number;
}) {
  const supabase = createClient();
  const [idx, setIdx] = useState(currentPeriodIndex >= 0 ? currentPeriodIndex : 0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [editingPrix, setEditingPrix] = useState<string | null>(null); // lead id
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'payroll'|'clients'>('payroll');

  const current = periodPaychecks[idx];
  const neverSynced = jobberLastSync.startsWith('2020');

  async function syncJobber() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/jobber/sync', { method: 'POST' });
      const d = await res.json();
      setSyncResult(d);
    } catch (e: any) { setSyncResult({ error: e.message }); }
    setSyncing(false);
  }

  async function savePrix(leadId: string) {
    const prix = parseFloat(editVal);
    if (isNaN(prix) || prix <= 0) return;
    setSaving(true);
    await supabase.from('leads').update({ prix }).eq('id', leadId);
    setSaving(false);
    setEditingPrix(null);
    window.location.reload();
  }

  if (!periodPaychecks.length) {
    return <div style={{ padding: 40, color: '#4A6A88', textAlign: 'center' }}>Aucune période configurée</div>;
  }

  // Client commission view — all closes across ALL reps this period with commission per client
  const allCloses = current?.repBreakdown.flatMap(r =>
    r.closes.map(c => ({ ...c, rep_name: r.full_name, rep_rate: c.sale_type === 'recall' ? r.recall_rate : r.d2d_rate }))
  ) || [];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Paie</h1>
          <div style={{ fontSize: 11, color: neverSynced ? '#EF4444' : '#5A8AA8', marginTop: 3 }}>
            Jobber: {neverSynced ? '⚠️ jamais synchronisé' : `✅ ${new Date(jobberLastSync).toLocaleDateString('fr-CA', { day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}`}
          </div>
        </div>
        <button onClick={syncJobber} disabled={syncing}
                style={{ padding: '7px 14px', borderRadius: 8, background: syncing ? '#132D45' : '#1B9EF322', color: '#1B9EF3', border: '1px solid #1B9EF355', fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
          {syncing ? '⌛ Sync...' : '🔄 Sync Jobber'}
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: syncResult.success ? '#0F2E1A' : '#2A0F0F', color: syncResult.success ? '#22C55E' : '#EF4444', border: `1px solid ${syncResult.success ? '#22C55E33' : '#EF444433'}`, fontSize: 12, marginBottom: 12 }}>
          {syncResult.success
            ? `✅ ${syncResult.synced} jobs Jobber importés${syncResult.errors ? ` (${syncResult.errors.length} erreurs)` : ''}`
            : `❌ ${syncResult.error}${syncResult.detail ? ` — ${syncResult.detail}` : ''}${syncResult.hint ? ` — ${syncResult.hint}` : ''}`
          }
          {syncResult.errors?.map((e: string, i: number) => (
            <div key={i} style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{e}</div>
          ))}
        </div>
      )}

      {/* Period nav */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setIdx(i => Math.min(i + 1, periodPaychecks.length - 1))}
                  disabled={idx >= periodPaychecks.length - 1}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx >= periodPaychecks.length - 1 ? '#3A5F80' : '#8BAEC8', cursor: idx >= periodPaychecks.length - 1 ? 'default' : 'pointer', fontSize: 14 }}>←</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{current?.period.label}</div>
            <div style={{ fontSize: 11, color: '#5A8AA8', marginTop: 2 }}>{current?.period.start_date} → {current?.period.end_date}</div>
          </div>
          <button onClick={() => setIdx(i => Math.max(i - 1, 0))}
                  disabled={idx <= 0}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: idx <= 0 ? '#3A5F80' : '#8BAEC8', cursor: idx <= 0 ? 'default' : 'pointer', fontSize: 14 }}>→</button>
        </div>
        {idx !== currentPeriodIndex && currentPeriodIndex >= 0 && (
          <button onClick={() => setIdx(currentPeriodIndex)}
                  style={{ width: '100%', padding: '6px', borderRadius: 8, background: '#0F2E1A', border: '1px solid #22C55E33', color: '#22C55E', fontSize: 12, cursor: 'pointer' }}>
            ▶ Période actuelle
          </button>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['payroll', 'clients'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
                  style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: view === v ? '#1B9EF322' : '#132D45', color: view === v ? '#1B9EF3' : '#6B8AA8', border: `1px solid ${view === v ? '#1B9EF355' : '#1E3A5F'}` }}>
            {v === 'payroll' ? '💰 Paychecks' : '👤 Par client'}
          </button>
        ))}
      </div>

      {!current ? null : view === 'payroll' ? (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>{current.totalCloses}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Closes SR</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1B9EF3' }}>{fmtR(current.totalCommission)}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Commissions totales</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: current.jobberJobs > 0 ? '#0F2E1A' : '#0F1E35', border: `1px solid ${current.jobberJobs > 0 ? '#22C55E33' : '#EF444433'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: current.jobberJobs > 0 ? '#22C55E' : '#EF4444' }}>{current.jobberJobs}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Jobs Jobber complétés</div>
            </div>
          </div>

          {/* Rep paychecks */}
          {current.repBreakdown.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4A6A88', background: '#0F1E35', borderRadius: 14, border: '1px solid #1E3A5F' }}>Aucun close dans cette période</div>
          ) : (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
              {current.repBreakdown.sort((a, b) => b.total_commission - a.total_commission).map((rep, i) => {
                const tc = TIER_COLORS[rep.tier] || '#9CA3AF';
                const isMe = rep.rep_id === userId;
                const missingPrix = rep.closes.filter((c: any) => !c.prix && c.appointment_date);
                const d2dCloses = rep.closes.filter((c: any) => c.sale_type !== 'recall');
                const recallCloses = rep.closes.filter((c: any) => c.sale_type === 'recall');

                return (
                  <details key={rep.rep_id} style={{ borderBottom: i < current.repBreakdown.length - 1 ? '1px solid #0F1E30' : 'none' }}>
                    <summary style={{ padding: '12px 14px', background: isMe ? '#0D2E4A' : i % 2 === 0 ? '#0A1628' : '#0C1B30', cursor: 'pointer', listStyle: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? '#1B9EF3' : 'white' }}>{rep.full_name}</div>
                          <div style={{ fontSize: 11, marginTop: 2 }}>
                            <span style={{ color: '#22C55E' }}>{rep.d2d_closes} D2D</span>
                            {rep.recall_closes > 0 && <span style={{ color: '#A78BFA', marginLeft: 8 }}>{rep.recall_closes} rappels</span>}
                            <span style={{ color: tc, marginLeft: 8 }}>{rep.tier} · {(rep.d2d_rate*100).toFixed(1)}%</span>
                            {missingPrix.length > 0 && <span style={{ color: '#EF4444', marginLeft: 8 }}>⚠️ {missingPrix.length} prix manquant{missingPrix.length > 1 ? 's' : ''}</span>}
                          </div>
                          {/* Transparent math */}
                          <div style={{ fontSize: 10, color: '#4A6A88', marginTop: 3 }}>
                            D2D: {fmt(rep.d2d_revenue)} × {(rep.d2d_rate*100).toFixed(1)}% = {fmt(rep.d2d_commission)}
                            {rep.recall_closes > 0 && <> · Rappels: {fmt(rep.recall_revenue)} × {(rep.recall_rate*100).toFixed(1)}% = {fmt(rep.recall_commission)}</>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>{fmt(rep.total_commission)}</div>
                          {missingPrix.length > 0 && (
                            <div style={{ fontSize: 10, color: '#EF4444' }}>+{missingPrix.length} non comptés</div>
                          )}
                        </div>
                      </div>
                    </summary>

                    <div style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F22' }}>
                      {/* D2D closes */}
                      {d2dCloses.length > 0 && (
                        <>
                          <div style={{ padding: '6px 14px', fontSize: 10, color: '#22C55E', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628' }}>
                            🚪 D2D — {(rep.d2d_rate*100).toFixed(1)}% · Revenu: {fmt(rep.d2d_revenue)} · Commission: {fmt(rep.d2d_commission)}
                          </div>
                          {d2dCloses.map((c: any, ci: number) => {
                            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                            const missing = !c.prix;
                            const isEditing = editingPrix === c.id;
                            return (
                              <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px 6px 22px', borderTop: '1px solid #0F1E30', fontSize: 11, background: missing ? '#1A0A0A' : 'transparent' }}>
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: missing ? '#EF4444' : '#C2D4E8' }}>
                                  {missing ? '⚠️ ' : ''}{name} <span style={{ color: '#3A5F80', fontSize: 10 }}>{c.appointment_date}</span>
                                </span>
                                <span style={{ flexShrink: 0, marginLeft: 8 }}>
                                  {isEditing ? (
                                    <span style={{ display: 'flex', gap: 4 }}>
                                      <input value={editVal} onChange={e => setEditVal(e.target.value)}
                                             placeholder="Prix $" style={{ width: 70, padding: '2px 6px', borderRadius: 4, background: '#132D45', border: '1px solid #1B9EF3', color: 'white', fontSize: 11 }} />
                                      <button onClick={() => savePrix(c.id)} disabled={saving}
                                              style={{ padding: '2px 8px', borderRadius: 4, background: '#22C55E', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer' }}>
                                        {saving ? '...' : '✓'}
                                      </button>
                                      <button onClick={() => setEditingPrix(null)}
                                              style={{ padding: '2px 6px', borderRadius: 4, background: '#132D45', color: '#6B8AA8', border: 'none', fontSize: 11, cursor: 'pointer' }}>✕</button>
                                    </span>
                                  ) : missing ? (
                                    <button onClick={() => { setEditingPrix(c.id); setEditVal(''); }}
                                            style={{ padding: '2px 8px', borderRadius: 4, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>
                                      + Prix
                                    </button>
                                  ) : (
                                    <>
                                      <span style={{ color: '#1B9EF3' }}>{fmt(parseFloat(c.prix))}</span>
                                      <span style={{ color: '#22C55E', marginLeft: 6 }}>+{fmt(parseFloat(c.prix) * rep.d2d_rate)}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Recall closes */}
                      {recallCloses.length > 0 && (
                        <>
                          <div style={{ padding: '6px 14px', fontSize: 10, color: '#A78BFA', fontWeight: 700, letterSpacing: 0.8, background: '#0A1628', borderTop: '1px solid #1E3A5F22' }}>
                            📞 RAPPELS — Revenu: {fmt(rep.recall_revenue)} · Commission: {fmt(rep.recall_commission)}
                          </div>
                          {recallCloses.map((c: any, ci: number) => {
                            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                            const missing = !c.prix;
                            const isEditing = editingPrix === c.id;
                            return (
                              <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px 6px 22px', borderTop: '1px solid #0F1E30', fontSize: 11, background: missing ? '#1A0A0A' : 'transparent' }}>
                                <span style={{ flex: 1, color: missing ? '#EF4444' : '#C2D4E8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                  {missing ? '⚠️ ' : ''}{name} <span style={{ color: '#3A5F80', fontSize: 10 }}>{c.appointment_date}</span>
                                </span>
                                <span style={{ flexShrink: 0, marginLeft: 8 }}>
                                  {isEditing ? (
                                    <span style={{ display: 'flex', gap: 4 }}>
                                      <input value={editVal} onChange={e => setEditVal(e.target.value)}
                                             placeholder="Prix $" style={{ width: 70, padding: '2px 6px', borderRadius: 4, background: '#132D45', border: '1px solid #1B9EF3', color: 'white', fontSize: 11 }} />
                                      <button onClick={() => savePrix(c.id)} disabled={saving}
                                              style={{ padding: '2px 8px', borderRadius: 4, background: '#22C55E', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer' }}>
                                        {saving ? '...' : '✓'}
                                      </button>
                                      <button onClick={() => setEditingPrix(null)}
                                              style={{ padding: '2px 6px', borderRadius: 4, background: '#132D45', color: '#6B8AA8', border: 'none', fontSize: 11, cursor: 'pointer' }}>✕</button>
                                    </span>
                                  ) : missing ? (
                                    <button onClick={() => { setEditingPrix(c.id); setEditVal(''); }}
                                            style={{ padding: '2px 8px', borderRadius: 4, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>
                                      + Prix
                                    </button>
                                  ) : (
                                    <>
                                      <span style={{ color: '#A78BFA' }}>{fmt(parseFloat(c.prix))}</span>
                                      <span style={{ color: '#22C55E', marginLeft: 6 }}>+{fmt(parseFloat(c.prix) * rep.recall_rate)}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Paycheck total */}
                      <div style={{ padding: '8px 14px', borderTop: '1px solid #1E3A5F11', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: '#4A6A88' }}>
                          {rep.null_prix_closes > 0 && <span style={{ color: '#EF4444' }}>⚠️ {rep.null_prix_closes} close{rep.null_prix_closes > 1 ? 's' : ''} sans prix — montant sous-estimé</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Paycheck: {fmt(rep.total_commission)}</span>
                      </div>
                    </div>
                  </details>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#132D45', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#8BAEC8' }}>Total période</span>
                <span style={{ color: '#22C55E' }}>{fmt(current.totalCommission)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        /* CLIENT VIEW */
        <div>
          <div style={{ fontSize: 11, color: '#5A8AA8', marginBottom: 10 }}>
            {allCloses.filter((c: any) => c.prix).length} clients · {fmt(allCloses.reduce((s: number, c: any) => s + (parseFloat(c.prix) || 0), 0))} revenu total · {fmt(allCloses.reduce((s: number, c: any) => s + (parseFloat(c.prix) || 0) * (c.rep_rate || 0), 0))} commissions totales
          </div>

          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 80px', padding: '8px 14px', background: '#132D45', fontSize: 11, color: '#5A8AA8', fontWeight: 700, gap: 8 }}>
              <span>Client</span>
              <span style={{ textAlign: 'right' }}>Type</span>
              <span style={{ textAlign: 'right' }}>Prix</span>
              <span style={{ textAlign: 'right' }}>Comm.</span>
              <span style={{ textAlign: 'right' }}>Vendeur</span>
            </div>

            {allCloses
              .sort((a: any, b: any) => (parseFloat(b.prix) || 0) - (parseFloat(a.prix) || 0))
              .map((c: any, i: number) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Inconnu';
                const prix = parseFloat(c.prix) || 0;
                const comm = prix * (c.rep_rate || 0);
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 80px', padding: '8px 14px', borderTop: '1px solid #0F1E30', background: i % 2 === 0 ? '#0A1628' : '#0C1B30', gap: 8, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#3A5F80', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.address}</div>
                    </div>
                    <span style={{ fontSize: 11, color: c.sale_type === 'recall' ? '#A78BFA' : '#22C55E', textAlign: 'right' }}>
                      {c.sale_type === 'recall' ? 'Rappel' : 'D2D'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: prix ? '#1B9EF3' : '#EF4444', textAlign: 'right' }}>
                      {prix ? fmt(prix) : '⚠️ —'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: comm ? '#22C55E' : '#4A6A88', textAlign: 'right' }}>
                      {comm ? fmt(comm) : '—'}
                    </span>
                    <span style={{ fontSize: 10, color: '#6B8AA8', textAlign: 'right', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {c.rep_name?.split(' ')[0]}
                    </span>
                  </div>
                );
              })}

            {/* Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 80px', padding: '10px 14px', background: '#132D45', gap: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#8BAEC8' }}>TOTAL</span>
              <span />
              <span style={{ color: '#1B9EF3', textAlign: 'right' }}>{fmt(allCloses.reduce((s: number, c: any) => s + (parseFloat(c.prix) || 0), 0))}</span>
              <span style={{ color: '#22C55E', textAlign: 'right' }}>{fmt(allCloses.reduce((s: number, c: any) => s + (parseFloat(c.prix) || 0) * (c.rep_rate || 0), 0))}</span>
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
