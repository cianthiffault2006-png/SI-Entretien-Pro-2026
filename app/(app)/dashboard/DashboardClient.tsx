'use client';
import Link from 'next/link';
import { getCommissionRate, getTierLabel, getNextTierInfo } from '@/lib/types';

interface RepStats {
  rep_id: string; full_name: string;
  sr_closes: number; recall_closes: number; total_closes: number;
  d2d_revenue: number; recall_revenue: number; total_revenue: number;
  close_rate: number; avg_deal_size: number;
}

interface Props {
  profile: any;
  userId: string;
  myStats: RepStats | null;
  myRank: number;
  todayBookings: any[];
  unassignedCount: number;
  currentPeriod: { label: string; start_date: string; end_date: string } | null;
  periodStats: { closes: number; revenue: number } | null;
}

export default function DashboardClient({ profile, userId, myStats, myRank, todayBookings, unassignedCount, currentPeriod, periodStats }: Props) {
  const isAdmin = profile.role === 'admin';
  const isManager = profile.role === 'admin' || profile.role === 'manager';
  const isRep = profile.role === 'rep';

  const d2dCloses = myStats?.sr_closes || 0;
  const rate = getCommissionRate(d2dCloses);
  const tier = getTierLabel(d2dCloses);
  const next = getNextTierInfo(d2dCloses);
  const totalRevenue = myStats?.total_revenue || 0;
  const commission = (myStats?.d2d_revenue || 0) * rate;

  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>
          Bonjour, {profile.full_name.split(' ')[0]} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#6B8AA8', margin: '4px 0 0' }}>
          {new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Current pay period */}
      {currentPeriod && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: '#0F2E1A', border: '1px solid #22C55E33', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#4A6A88', fontWeight: 700, letterSpacing: 0.8 }}>PÉRIODE ACTUELLE</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E2EEF8', marginTop: 2 }}>{currentPeriod.label}</div>
          </div>
          {periodStats && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E' }}>{periodStats.closes} closes</div>
              <div style={{ fontSize: 11, color: '#4A6A88' }}>${Math.round(periodStats.revenue).toLocaleString('fr-CA')}</div>
            </div>
          )}
        </div>
      )}

      {/* Rep stats from SR */}
      {(isRep || isManager) && myStats && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>MES STATS — SR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ padding: '14px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#22C55E' }}>{d2dCloses}</div>
              <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>Closes D2D</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1B9EF3' }}>${Math.round(commission).toLocaleString('fr-CA')}</div>
              <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>Commission D2D est.</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#F59E0B' }}>{(rate*100).toFixed(1)}%</div>
              <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>{tier}</div>
            </div>
            <div style={{ padding: '14px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#A78BFA' }}>#{myRank}</div>
              <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>Classement</div>
            </div>
          </div>

          {/* Tier progress bar */}
          {next && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span style={{ color: '#6B8AA8' }}>{tier} → {(next.rate*100).toFixed(1)}%</span>
                <span style={{ color: '#1B9EF3', fontWeight: 600 }}>{next.closes} closes restants</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#1B9EF3,#A78BFA)', width: `${Math.min(100,(d2dCloses/(d2dCloses+next.closes))*100)}%`, transition: 'width .5s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manager operational overview */}
      {isManager && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>APERÇU OPÉRATIONNEL</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1B9EF3' }}>{todayBookings.length}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Jobs aujourd'hui</div>
            </div>
            <div style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: `1px solid ${unassignedCount>0?'#EF444433':'#1E3A5F'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: unassignedCount>0?'#EF4444':'#22C55E' }}>{unassignedCount}</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Non assignés</div>
            </div>
            <Link href="/schedule" style={{ padding: '12px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#A78BFA' }}>→</div>
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Voir horaire</div>
            </Link>
          </div>
        </div>
      )}

      {/* Quick actions — ADMIN only shows carte/RDV, reps don't */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>ACTIONS RAPIDES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Link href="/disponibilite" style={quickBtn}>
            <span style={{ fontSize: 24 }}>🗓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Disponibilités</span>
          </Link>
          <Link href="/ventes" style={quickBtn}>
            <span style={{ fontSize: 24 }}>▲</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Mes ventes</span>
          </Link>
          <Link href="/leaderboard" style={quickBtn}>
            <span style={{ fontSize: 24 }}>★</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Classement</span>
          </Link>
          {isManager && (
            <Link href="/payroll" style={quickBtn}>
              <span style={{ fontSize: 24 }}>$</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Paie</span>
            </Link>
          )}
          {/* ADMIN ONLY: carte and RDV */}
          {isAdmin && (
            <>
              <Link href="/map" style={quickBtn}>
                <span style={{ fontSize: 24 }}>◉</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Carte & Pings</span>
              </Link>
              <Link href="/book" style={quickBtn}>
                <span style={{ fontSize: 24 }}>+</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Nouveau RDV</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Commission tiers reference */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 8 }}>PALIERS DE COMMISSION D2D</div>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
          {[
            { label: 'Débutant', range: '0–149', rate: '15%', color: '#9CA3AF', active: tier==='Débutant' },
            { label: 'Tier 2',   range: '150–299', rate: '17.5%', color: '#1B9EF3', active: tier==='Tier 2' },
            { label: 'Tier 3',   range: '300–449', rate: '20%', color: '#A78BFA', active: tier==='Tier 3' },
            { label: 'Élite 🏆', range: '450+', rate: '25%', color: '#F59E0B', active: tier==='Élite' },
          ].map((t, i) => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i<3?'1px solid #0F1E30':'none', background: t.active?t.color+'11':'transparent' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
                {t.active && <span style={{ fontSize: 11, color: t.color, marginLeft: 6 }}>← vous</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{t.rate}</div>
                <div style={{ fontSize: 11, color: '#4A6A88' }}>{t.range} closes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const quickBtn: React.CSSProperties = {
  padding: '14px 12px', borderRadius: 14, background: '#0F1E35',
  border: '1px solid #1E3A5F', display: 'flex', flexDirection: 'column',
  gap: 8, textDecoration: 'none', alignItems: 'flex-start',
};
