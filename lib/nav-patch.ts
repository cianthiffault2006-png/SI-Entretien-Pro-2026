// This file patches the Nav to include the contract route for reps
// Replace the NAV_ITEMS.rep array in components/Nav.tsx with this:

export const REP_NAV = [
  { href: '/dashboard',  label: 'Tableau de bord', icon: '⊞' },
  { href: '/map',        label: 'Carte & Pings',   icon: '◎' },
  { href: '/book',       label: 'Nouveau RDV',     icon: '+' },
  { href: '/contract',   label: 'Contrat',         icon: '✎' },
  { href: '/sales',      label: 'Mes ventes',      icon: '▲' },
  { href: '/leaderboard',label: 'Classement',      icon: '★' },
  { href: '/schedule',   label: 'Mon horaire',     icon: '▦' },
];
