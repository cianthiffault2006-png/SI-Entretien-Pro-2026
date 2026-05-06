'use client';
import Link from 'next/link';
import { useState } from 'react';
import { getCommissionRate, getTierLabel, getNextTierInfo } from '@/lib/types';
import type { Profile } from '@/lib/types';

interface RepStats {
  rep_id: string; full_name: string;
  sr_closes: number; recall_closes: number; total_closes: number;
  d2d_revenue: number; recall_revenue: number; total_revenue: number;
  close_rate: number; avg_deal_size: number;
}

interface Props {
  profile: Profile;
  userId: string;
  myStats: RepStats | null;
  myRank: number;
  todayBookings: any[];
  unassignedCount: number;
  currentPeriod: { label: string; start_date: string; end_date: string } | null;
  periodStats: { closes: number; revenue: number } | null;
}

// Inline mobile nav — imported here directly to avoid circular deps
function MobileNav({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/disponibilite', label: 'Disponibilités', icon: '🗓' },
    { href: '/ventes', label: 'Ventes', icon: '▲' },
    { href: '/leaderboard', label: 'Classement', icon: '★' },
    ...(profile.role === 'admin' || profile.role === 'manager' ? [
      { href: '/schedule', label: 'Horaires', icon: '📅' },
      { href: '/stats', label: 'Stats', icon: '📊' },
      { href: '/payroll', label: 'Paie', icon: '$' },
      { href: '/leads', label: 'Leads SR', icon: '👥' },
      { href: '/admin/users', label: 'Équipe', icon: '◎' },
      { href: '/historique', label: 'Historique', icon: '📋' },
    ] : []),
    ...(profile.role === 'admin' ? [
      { href: '/map', label: 'Carte', icon: '◉' },
      { href: '/book', label: 'Nouveau RDV', icon: '+' },
    ] : []),
    { href: '/settings', label: 'Paramètres', icon: '⚙' },
  ];

  const rc: Record<string, string> = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' };
  const color = rc[profile.role] || '#6B8AA8';
  const initials = profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1B9EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>SI</div>
        <button onClick={() => setOpen(true)}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ width: 14, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
          <span style={{ width: 10, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
        </button>
      </div>

      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 260, maxWidth: '82vw', background: '#0A1628', borderLeft: '1px solid #1E3A5F', zIndex: 51, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #1E3A5F', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: color + '22', border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color }}>{initials}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{profile.full_name}</div>
                <div style={{ fontSize: 11, color }}>{{ admin:'Admin', manager:'Manager', rep:'Vendeur', cleaner:'Tech' }[profile.role]}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 26, cursor: 'pointer' }}>×</button>
          </div>
          <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
            {items.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, marginBottom: 2, textDecoration: 'none', fontSize: 14, fontWeight: 500, color: '#C2D4E8' }}>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ padding: 12, borderTop: '1px solid #1E3A5F' }}>
            <Link href="/settings" onClick={() => setOpen(false)} style={{ display: 'block', width: '100%', padding: '10px', borderRadius: 10, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', textDecoration: 'none', textAlign: 'center', fontSize: 13, marginBottom: 8 }}>⚙ Paramètres</Link>
          </div>
        </div>
      </>}
    </>
  );
}

export default function DashboardClient({ profile, userId, myStats, myRank, todayBookings, unassignedCount, currentPeriod, periodStats }: Props) {
  const isAdmin = profile.role === 'admin';
  const isManager = profile.role === 'admin' || profile.role === 'manager';

  const d2dCloses = myStats?.sr_closes || 0;
  const rate = getCommissionRate(d2dCloses);
  const tier = getTierLabel(d2dCloses);
  const next = getNextTierInfo(d2dCloses);
  const d2dCommission = (myStats?.d2d_revenue || 0) * rate;

  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>

      {/* ── GREETING ROW — mobile: greeting left + SI/menu right, desktop: just greeting ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>
            Bonjour, {profile.full_name.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6B8AA8', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {/* Mobile only: SI logo + hamburger inline with greeting */}
        <div className="mobile-nav-inline">
          <MobileNav profile={profile} />
        </div>
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

      {/* My SR stats */}
      {myStats && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>MES STATS SR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'Closes D2D', value: d2dCloses, color: '#22C55E' },
              { label: 'Commission est.', value: `$${Math.round(d2dCommission).toLocaleString('fr-CA')}`, color: '#1B9EF3' },
              { label: `Taux — ${tier}`, value: `${(rate*100).toFixed(1)}%`, color: '#F59E0B' },
              { label: 'Classement', value: `#${myRank || '—'}`, color: '#A78BFA' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#6B8AA8', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {next && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1E35', border: '1px solid #1E3A5F' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span style={{ color: '#6B8AA8' }}>{tier} → {(next.rate*100).toFixed(1)}%</span>
                <span style={{ color: '#1B9EF3', fontWeight: 600 }}>{next.closes} closes D2D restants</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#132D45', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#1B9EF3,#A78BFA)', width: `${Math.min(100,(d2dCloses/(d2dCloses+next.closes))*100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manager ops */}
      {isManager && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>OPÉRATIONNEL</div>
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
              <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 2 }}>Horaires</div>
            </Link>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 10 }}>ACTIONS RAPIDES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { href: '/disponibilite', icon: '🗓', label: 'Disponibilités' },
            { href: '/ventes', icon: '▲', label: 'Mes ventes' },
            { href: '/leaderboard', icon: '★', label: 'Classement' },
            ...(isManager ? [{ href: '/payroll', icon: '$', label: 'Paie' }] : []),
            ...(isAdmin ? [
              { href: '/map', icon: '◉', label: 'Carte & Pings' },
              { href: '/book', icon: '+', label: 'Nouveau RDV' },
            ] : []),
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ padding: '14px 12px', borderRadius: 14, background: '#0F1E35', border: '1px solid #1E3A5F', display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Tier reference */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5A8AA8', letterSpacing: 1, marginBottom: 8 }}>PALIERS D2D</div>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
          {[
            { label: 'Débutant', range: '0–149', rate: '15%', color: '#9CA3AF', me: tier==='Débutant' },
            { label: 'Tier 2', range: '150–299', rate: '17.5%', color: '#1B9EF3', me: tier==='Tier 2' },
            { label: 'Tier 3', range: '300–449', rate: '20%', color: '#A78BFA', me: tier==='Tier 3' },
            { label: 'Élite 🏆', range: '450+', rate: '25%', color: '#F59E0B', me: tier==='Élite' },
          ].map((t, i) => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i<3?'1px solid #0F1E30':'none', background: t.me?t.color+'11':'transparent' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
                {t.me && <span style={{ fontSize: 10, color: t.color, marginLeft: 6 }}>← vous</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{t.rate}</div>
                <div style={{ fontSize: 11, color: '#4A6A88' }}>{t.range}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) { .mobile-nav-inline { display: none !important; } }
        @media (max-width: 639px) { .mobile-nav-inline { display: flex !important; } }
        .mobile-nav-inline { display: none; }
      `}</style>
    </div>
  );
}
