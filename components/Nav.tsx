'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  admin: [
    { href: '/dashboard',   label: 'Dashboard',  icon: '⊞' },
    { href: '/map',         label: 'Carte',       icon: '◉' },
    { href: '/leads',       label: 'Leads',       icon: '👥' },
    { href: '/book',        label: 'RDV',         icon: '+' },
    { href: '/contract',    label: 'Contrat',     icon: '📄' },
    { href: '/schedule',    label: 'Horaires',    icon: '📅' },
    { href: '/ventes',      label: 'Ventes',      icon: '▲' },
    { href: '/historique',  label: 'Historique',  icon: '📋' },
    { href: '/stats',       label: 'Stats',       icon: '📊' },
    { href: '/leaderboard', label: 'Classement',  icon: '★' },
    { href: '/payroll',     label: 'Paie',        icon: '$' },
    { href: '/admin/users', label: 'Équipe',      icon: '◎' },
    { href: '/settings',    label: 'Paramètres',  icon: '⚙' },
  ],
  manager: [
    { href: '/dashboard',   label: 'Dashboard',  icon: '⊞' },
    { href: '/map',         label: 'Carte',       icon: '◉' },
    { href: '/leads',       label: 'Leads',       icon: '👥' },
    { href: '/book',        label: 'RDV',         icon: '+' },
    { href: '/contract',    label: 'Contrat',     icon: '📄' },
    { href: '/schedule',    label: 'Horaires',    icon: '📅' },
    { href: '/ventes',      label: 'Ventes',      icon: '▲' },
    { href: '/historique',  label: 'Historique',  icon: '📋' },
    { href: '/stats',       label: 'Stats',       icon: '📊' },
    { href: '/leaderboard', label: 'Classement',  icon: '★' },
    { href: '/payroll',     label: 'Paie',        icon: '$' },
    { href: '/admin/users', label: 'Équipe',      icon: '◎' },
    { href: '/settings',    label: 'Paramètres',  icon: '⚙' },
  ],
  rep: [
    { href: '/dashboard',   label: 'Dashboard',  icon: '⊞' },
    { href: '/map',         label: 'Carte',       icon: '◉' },
    { href: '/leads',       label: 'Leads',       icon: '👥' },
    { href: '/book',        label: 'RDV',         icon: '+' },
    { href: '/contract',    label: 'Contrat',     icon: '📄' },
    { href: '/ventes',      label: 'Ventes',      icon: '▲' },
    { href: '/leaderboard', label: 'Classement',  icon: '★' },
    { href: '/schedule',    label: 'Horaire',     icon: '📅' },
    { href: '/settings',    label: 'Paramètres',  icon: '⚙' },
  ],
  cleaner: [
    { href: '/dashboard',  label: 'Dashboard',   icon: '⊞' },
    { href: '/schedule',   label: 'Horaire',     icon: '📅' },
    { href: '/settings',   label: 'Paramètres',  icon: '⚙' },
  ],
};

// Bottom tab items (5 most used per role)
const BOTTOM_TABS: Record<string, string[]> = {
  admin:   ['/dashboard', '/map', '/leads', '/book', '/schedule'],
  manager: ['/dashboard', '/map', '/leads', '/book', '/schedule'],
  rep:     ['/dashboard', '/map', '/book', '/contract', '/leaderboard'],
  cleaner: ['/dashboard', '/schedule'],
};

export default function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = NAV[profile.role] || NAV.rep;
  const bottomHrefs = BOTTOM_TABS[profile.role] || BOTTOM_TABS.rep;
  const bottomItems = bottomHrefs.map(href => items.find(i => i.href === href)).filter(Boolean) as typeof items;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const roleColors: Record<string, string> = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' };
  const rc = roleColors[profile.role] || '#6B8AA8';
  const roleLabels: Record<string, string> = { admin: 'Admin', manager: 'Manager', rep: 'Vendeur', cleaner: 'Tech' };

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  }

  return (
    <>
      {/* ═══════════════════════════════════════════
          DESKTOP SIDEBAR (≥640px)
      ═══════════════════════════════════════════ */}
      <aside
        className="hidden sm:flex flex-col border-r"
        style={{ width: 200, minWidth: 200, flexShrink: 0, minHeight: '100vh', background: '#0A1628', borderColor: '#1E3A5F' }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px', borderBottom: '1px solid #1E3A5F' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1B9EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 11, flexShrink: 0 }}>SI</div>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#E2EEF8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>SI Entretien Pro</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {items.filter(i => i.href !== '/settings').map(item => (
            <Link key={item.href} href={item.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 12, fontWeight: 500, background: isActive(item.href) ? '#1B9EF322' : 'transparent', color: isActive(item.href) ? '#1B9EF3' : '#8BAEC8', borderLeft: `2px solid ${isActive(item.href) ? '#1B9EF3' : 'transparent'}` }}>
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: 8, borderTop: '1px solid #1E3A5F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: rc + '22', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: rc, flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#E2EEF8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
              <div style={{ fontSize: 10, color: rc }}>{roleLabels[profile.role]}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link href="/settings" style={{ flex: 1, padding: '5px', borderRadius: 6, textAlign: 'center', fontSize: 12, background: '#132D45', border: '1px solid #1E3A5F', color: '#6B8AA8', textDecoration: 'none' }}>⚙</Link>
            <button onClick={logout} style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 12, background: '#132D45', border: '1px solid #1E3A5F', color: '#6B8AA8', cursor: 'pointer' }}>Sortir</button>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MOBILE TOP BAR (< 640px)
      ═══════════════════════════════════════════ */}
      <header
        className="sm:hidden"
        style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 48, background: '#0A1628', borderBottom: '1px solid #1E3A5F', flexShrink: 0 }}
      >
        {/* Left: logo only — very compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1B9EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 11 }}>SI</div>
        </div>

        {/* Right: avatar + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: rc + '22', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: rc }}>
            {initials}
          </div>
          {/* Hamburger menu button */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}
          >
            <span style={{ width: 16, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
            <span style={{ width: 16, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
            <span style={{ width: 16, height: 2, background: '#8BAEC8', borderRadius: 1 }} />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          MOBILE DRAWER (slides from right)
      ═══════════════════════════════════════════ */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="sm:hidden"
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}
          />
          {/* Drawer panel */}
          <div
            className="sm:hidden"
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 260, background: '#0A1628', borderLeft: '1px solid #1E3A5F', zIndex: 51, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #1E3A5F' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: rc + '22', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{profile.full_name}</div>
                  <div style={{ fontSize: 11, color: rc }}>{roleLabels[profile.role]}</div>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#6B8AA8', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* All nav items */}
            <nav style={{ flex: 1, padding: '10px 10px' }}>
              {items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, marginBottom: 3, textDecoration: 'none', fontSize: 14, fontWeight: 500, background: isActive(item.href) ? '#1B9EF322' : 'transparent', color: isActive(item.href) ? '#1B9EF3' : '#C2D4E8', borderLeft: `3px solid ${isActive(item.href) ? '#1B9EF3' : 'transparent'}` }}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: '12px 12px', borderTop: '1px solid #1E3A5F' }}>
              <button onClick={logout} style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#1E1A0A', border: '1px solid #EF444433', color: '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════
          MOBILE BOTTOM TAB BAR (< 640px)
      ═══════════════════════════════════════════ */}
      <nav
        className="sm:hidden"
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: '#0A1628', borderTop: '1px solid #1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 56 }}
      >
        {bottomItems.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, height: '100%', textDecoration: 'none', color: active ? '#1B9EF3' : '#6B8AA8' }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, lineHeight: 1, letterSpacing: 0.3 }}>{item.label}</span>
              {active && <span style={{ position: 'absolute', bottom: 0, width: 24, height: 2, borderRadius: 1, background: '#1B9EF3' }} />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
