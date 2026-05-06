'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  admin: [
    { href: '/dashboard',     label: 'Dashboard',      icon: '⊞' },
    { href: '/schedule',      label: 'Horaires',        icon: '📅' },
    { href: '/disponibilite', label: 'Disponibilités',  icon: '🗓' },
    { href: '/ventes',        label: 'Ventes',          icon: '▲' },
    { href: '/historique',    label: 'Historique',      icon: '📋' },
    { href: '/stats',         label: 'Stats',           icon: '📊' },
    { href: '/leaderboard',   label: 'Classement',      icon: '★' },
    { href: '/payroll',       label: 'Paie',            icon: '$' },
    { href: '/leads',         label: 'Leads SR',        icon: '👥' },
    { href: '/map',           label: 'Carte',           icon: '◉' },
    { href: '/book',          label: 'Nouveau RDV',     icon: '+' },
    { href: '/admin/users',   label: 'Équipe',          icon: '◎' },
    { href: '/settings',      label: 'Paramètres',      icon: '⚙' },
  ],
  manager: [
    { href: '/dashboard',     label: 'Dashboard',      icon: '⊞' },
    { href: '/schedule',      label: 'Horaires',        icon: '📅' },
    { href: '/disponibilite', label: 'Disponibilités',  icon: '🗓' },
    { href: '/ventes',        label: 'Ventes',          icon: '▲' },
    { href: '/historique',    label: 'Historique',      icon: '📋' },
    { href: '/stats',         label: 'Stats',           icon: '📊' },
    { href: '/leaderboard',   label: 'Classement',      icon: '★' },
    { href: '/payroll',       label: 'Paie',            icon: '$' },
    { href: '/leads',         label: 'Leads SR',        icon: '👥' },
    { href: '/admin/users',   label: 'Équipe',          icon: '◎' },
    { href: '/settings',      label: 'Paramètres',      icon: '⚙' },
  ],
  rep: [
    { href: '/dashboard',     label: 'Dashboard',      icon: '⊞' },
    { href: '/disponibilite', label: 'Disponibilités', icon: '🗓' },
    { href: '/ventes',        label: 'Mes ventes',     icon: '▲' },
    { href: '/leaderboard',   label: 'Classement',     icon: '★' },
    { href: '/settings',      label: 'Paramètres',     icon: '⚙' },
  ],
  cleaner: [
    { href: '/dashboard',     label: 'Mon horaire',    icon: '⊞' },
    { href: '/disponibilite', label: 'Disponibilités', icon: '🗓' },
    { href: '/settings',      label: 'Paramètres',     icon: '⚙' },
  ],
};

const BOTTOM_TABS: Record<string, string[]> = {
  admin:   ['/dashboard', '/schedule', '/disponibilite', '/ventes', '/leads'],
  manager: ['/dashboard', '/schedule', '/disponibilite', '/ventes', '/stats'],
  rep:     ['/dashboard', '/disponibilite', '/ventes', '/leaderboard', '/settings'],
  cleaner: ['/dashboard', '/disponibilite', '/settings'],
};

// Mobile nav bar exported separately so DashboardClient can use it inline
export function MobileNavBar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV[profile.role] || NAV.rep;

  async function logout() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh();
  }

  function active(href: string) {
    return pathname === href || (href.length > 1 && pathname.startsWith(href + '/'));
  }

  const initials = profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const rc: Record<string, string> = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' };
  const color = rc[profile.role] || '#6B8AA8';
  const roleLabel: Record<string, string> = { admin: 'Admin', manager: 'Manager', rep: 'Vendeur', cleaner: 'Tech' };

  return (
    <>
      {/* Inline nav controls — rendered by each page's header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* SI badge */}
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1B9EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>SI</div>
        {/* Hamburger */}
        <button onClick={() => setOpen(true)} aria-label="Menu"
                style={{ width: 34, height: 34, borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ width: 14, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
          <span style={{ width: 10, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
        </button>
      </div>

      {/* Drawer */}
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 260, maxWidth: '82vw', background: '#0A1628', borderLeft: '1px solid #1E3A5F', zIndex: 51, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #1E3A5F', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: color + '22', border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color }}>{initials}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{profile.full_name}</div>
                <div style={{ fontSize: 11, color }}>{roleLabel[profile.role]}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
            {items.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, marginBottom: 2, textDecoration: 'none', fontSize: 14, fontWeight: 500, background: active(item.href) ? '#1B9EF322' : 'transparent', color: active(item.href) ? '#1B9EF3' : '#C2D4E8', borderLeft: `3px solid ${active(item.href) ? '#1B9EF3' : 'transparent'}` }}>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ padding: '12px', borderTop: '1px solid #1E3A5F', flexShrink: 0 }}>
            <button onClick={logout} style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#1E1A0A', border: '1px solid #EF444433', color: '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Déconnexion</button>
          </div>
        </div>
      </>}
    </>
  );
}

export default function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const items = NAV[profile.role] || NAV.rep;
  const tabHrefs = BOTTOM_TABS[profile.role] || BOTTOM_TABS.rep;
  const tabItems = tabHrefs.map(h => items.find(i => i.href === h)).filter(Boolean) as typeof items;

  async function logout() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh();
  }

  function active(href: string) {
    return pathname === href || (href.length > 1 && pathname.startsWith(href + '/'));
  }

  const initials = profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const rc: Record<string, string> = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' };
  const color = rc[profile.role] || '#6B8AA8';
  const roleLabel: Record<string, string> = { admin: 'Admin', manager: 'Manager', rep: 'Vendeur', cleaner: 'Tech' };

  return (
    <>
      {/* ══ DESKTOP SIDEBAR (≥640px) ══ */}
      <aside className="sm-sidebar" style={{ display: 'none', flexDirection: 'column', width: 200, minWidth: 200, flexShrink: 0, minHeight: '100vh', background: '#0A1628', borderRight: '1px solid #1E3A5F' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderBottom: '1px solid #1E3A5F' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1B9EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 11, flexShrink: 0 }}>SI</div>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#E2EEF8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>SI Entretien Pro</span>
        </div>
        <nav style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
          {items.filter(i => i.href !== '/settings').map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 12, fontWeight: 500, background: active(item.href) ? '#1B9EF322' : 'transparent', color: active(item.href) ? '#1B9EF3' : '#8BAEC8', borderLeft: `2px solid ${active(item.href) ? '#1B9EF3' : 'transparent'}` }}>
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div style={{ padding: 8, borderTop: '1px solid #1E3A5F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', marginBottom: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#E2EEF8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
              <div style={{ fontSize: 10, color }}>{roleLabel[profile.role]}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link href="/settings" style={{ flex: 1, padding: '5px', borderRadius: 6, textAlign: 'center', fontSize: 12, background: '#132D45', border: '1px solid #1E3A5F', color: '#6B8AA8', textDecoration: 'none' }}>⚙</Link>
            <button onClick={logout} style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 12, background: '#132D45', border: '1px solid #1E3A5F', color: '#6B8AA8', cursor: 'pointer' }}>Sortir</button>
          </div>
        </div>
      </aside>

      {/* ══ MOBILE BOTTOM TABS ONLY — no top bar ══ */}
      <nav className="mobile-tabs" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: '#0A1628', borderTop: '1px solid #1E3A5F', alignItems: 'stretch', justifyContent: 'space-around', height: 54 }}>
        {tabItems.map(item => {
          const on = active(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, textDecoration: 'none', color: on ? '#1B9EF3' : '#5A8AA8', position: 'relative', padding: '4px 2px' }}>
              {on && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, borderRadius: '0 0 2px 2px', background: '#1B9EF3' }} />}
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: on ? 700 : 400, lineHeight: 1 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 640px) {
          .sm-sidebar  { display: flex !important; }
          .mobile-tabs { display: none !important; }
        }
        @media (max-width: 639px) {
          .sm-sidebar  { display: none !important; }
          .mobile-tabs { display: flex !important; }
        }
      `}</style>
    </>
  );
}
