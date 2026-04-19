'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  admin: [
    { href: '/dashboard',   label: 'Tableau de bord', icon: '⊞' },
    { href: '/map',         label: 'Carte & Pings',   icon: '◉' },
    { href: '/leads',       label: 'Leads',           icon: '👥' },
    { href: '/book',        label: 'Nouveau RDV',     icon: '+' },
    { href: '/contract',    label: 'Contrat',         icon: '📄' },
    { href: '/schedule',    label: 'Horaires',        icon: '📅' },
    { href: '/ventes',      label: 'Ventes',          icon: '▲' },
    { href: '/historique',  label: 'Historique',      icon: '📋' },
    { href: '/stats',       label: 'Stats',           icon: '📊' },
    { href: '/leaderboard', label: 'Classement',      icon: '★' },
    { href: '/payroll',     label: 'Paie',            icon: '$' },
    { href: '/admin/users', label: 'Équipe',          icon: '◎' },
  ],
  manager: [
    { href: '/dashboard',   label: 'Tableau de bord', icon: '⊞' },
    { href: '/map',         label: 'Carte & Pings',   icon: '◉' },
    { href: '/leads',       label: 'Leads',           icon: '👥' },
    { href: '/book',        label: 'Nouveau RDV',     icon: '+' },
    { href: '/contract',    label: 'Contrat',         icon: '📄' },
    { href: '/schedule',    label: 'Horaires',        icon: '📅' },
    { href: '/ventes',      label: 'Ventes',          icon: '▲' },
    { href: '/historique',  label: 'Historique',      icon: '📋' },
    { href: '/stats',       label: 'Stats',           icon: '📊' },
    { href: '/leaderboard', label: 'Classement',      icon: '★' },
    { href: '/payroll',     label: 'Paie',            icon: '$' },
    { href: '/admin/users', label: 'Équipe',          icon: '◎' },
  ],
  rep: [
    { href: '/dashboard',   label: 'Tableau de bord', icon: '⊞' },
    { href: '/map',         label: 'Carte & Pings',   icon: '◉' },
    { href: '/leads',       label: 'Leads',           icon: '👥' },
    { href: '/book',        label: 'Nouveau RDV',     icon: '+' },
    { href: '/contract',    label: 'Contrat',         icon: '📄' },
    { href: '/ventes',      label: 'Mes ventes',      icon: '▲' },
    { href: '/historique',  label: 'Historique',      icon: '📋' },
    { href: '/leaderboard', label: 'Classement',      icon: '★' },
    { href: '/schedule',    label: 'Horaire',         icon: '📅' },
  ],
  cleaner: [
    { href: '/dashboard',  label: 'Mon horaire',    icon: '⊞' },
    { href: '/schedule',   label: 'Disponibilités', icon: '📅' },
  ],
};

export default function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const items = NAV[profile.role] || NAV.rep;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const rc: Record<string, string> = { admin: '#EF4444', manager: '#1B9EF3', rep: '#22C55E', cleaner: '#F97316' };
  const color = rc[profile.role] || '#6B8AA8';
  const roleLabel: Record<string, string> = { admin: 'Admin', manager: 'Manager', rep: 'Vendeur', cleaner: 'Tech' };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col border-r"
             style={{ width: 200, minWidth: 200, maxWidth: 200, minHeight: '100vh', background: '#0A1628', borderColor: '#1E3A5F', flexShrink: 0 }}>
        <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: '#1E3A5F' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0" style={{ background: '#1B9EF3' }}>SI</div>
          <span className="font-bold text-xs truncate" style={{ color: '#E2EEF8' }}>SI Entretien Pro</span>
        </div>
        <nav className="flex-1 p-2 pt-2 overflow-y-auto">
          {items.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
            return (
              <Link key={item.href} href={item.href}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium mb-0.5 transition-all"
                    style={{ background: active ? '#1B9EF322' : 'transparent', color: active ? '#1B9EF3' : '#8BAEC8', borderLeft: `2px solid ${active ? '#1B9EF3' : 'transparent'}` }}>
                <span className="text-sm w-4 text-center shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t" style={{ borderColor: '#1E3A5F' }}>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                 style={{ background: color + '22', color, border: `1px solid ${color}44` }}>{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate" style={{ color: '#E2EEF8' }}>{profile.full_name}</div>
              <div style={{ color, fontSize: 10 }}>{roleLabel[profile.role]}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <Link href="/settings" className="flex-1 text-center py-1.5 rounded-lg text-xs border" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>⚙</Link>
            <button onClick={logout} className="flex-1 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>Sortir</button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sm:hidden sticky top-0 z-40 flex items-center justify-between px-3 py-2.5 border-b"
              style={{ background: '#0A1628', borderColor: '#1E3A5F' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs" style={{ background: '#1B9EF3' }}>SI</div>
          <span className="font-bold text-xs" style={{ color: '#E2EEF8' }}>SI Entretien Pro</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
               style={{ background: color + '22', color, border: `1px solid ${color}44` }}>{initials}</div>
          <button onClick={logout} className="text-xs px-2 py-1.5 rounded-lg border" style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>Sortir</button>
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t" style={{ background: '#0A1628', borderColor: '#1E3A5F' }}>
        <div className="flex items-center justify-around py-1.5">
          {items.slice(0, 5).map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                    className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
                    style={{ color: active ? '#1B9EF3' : '#6B8AA8' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 500 }}>{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
