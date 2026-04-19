'use client';
import Link from 'next/link';
import { getCommissionRate, getTierLabel, getNextTierInfo, PING_CONFIG } from '@/lib/types';
import type { Profile, Booking, PayrollRecord, SalesLog } from '@/lib/types';

interface Props {
  profile: Profile;
  todayBookings: Booking[];
  unassignedCount: number;
  payrollRecords: PayrollRecord[];
  recentLogs: SalesLog[];
}

function StatCard({ label, value, sub, color = '#1B9EF3' }: any) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: '#132D45', borderColor: '#1E3A5F' }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: '#6B8AA8' }}>{label}</div>
      {sub && <div className="text-xs mt-0.5 font-medium" style={{ color: '#8BAEC8' }}>{sub}</div>}
    </div>
  );
}

export default function DashboardClient({ profile, todayBookings, unassignedCount, payrollRecords, recentLogs }: Props) {
  const confirmed = payrollRecords.filter(r => r.status === 'confirmed').length;
  const pending   = payrollRecords.filter(r => r.status === 'pending').length;
  const totalEarned = payrollRecords.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.commission_amount, 0);
  const rate = getCommissionRate(confirmed);
  const tier = getTierLabel(confirmed);
  const next = getNextTierInfo(confirmed);

  const isManager = profile.role === 'admin' || profile.role === 'manager';
  const isCleaner = profile.role === 'cleaner';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          Bonjour, {profile.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B8AA8' }}>
          {new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Rep stats */}
      {(profile.role === 'rep' || profile.role === 'admin') && (
        <section className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>
            Mes stats — {new Date().getFullYear()}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Ventes confirmées" value={confirmed} color="#22C55E" />
            <StatCard label="En attente" value={pending} color="#F59E0B" />
            <StatCard label="Commission gagnée" value={`$${Math.round(totalEarned).toLocaleString('fr-CA')}`} color="#1B9EF3" />
            <StatCard label="Taux actuel" value={`${(rate * 100).toFixed(1)}%`} sub={tier} color="#A78BFA" />
          </div>

          {/* Tier progress */}
          {next && (
            <div className="rounded-xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold" style={{ color: '#6B8AA8' }}>
                  Prochain palier — {(next.rate * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-bold" style={{ color: '#1B9EF3' }}>
                  {next.closes} vente{next.closes > 1 ? 's' : ''} restante{next.closes > 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#132D45' }}>
                <div className="h-full rounded-full transition-all" style={{
                  background: '#1B9EF3',
                  width: `${Math.min(100, (confirmed / (confirmed + next.closes)) * 100)}%`
                }} />
              </div>
            </div>
          )}

          {tier === 'Élite' && (
            <div className="rounded-xl p-4 border text-center" style={{ background: '#0F2E1A', borderColor: '#22C55E44' }}>
              <span className="text-2xl">🏆</span>
              <p className="text-sm font-bold mt-1" style={{ color: '#22C55E' }}>
                Statut Élite atteint! Voyage annuel inclus.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Manager overview */}
      {isManager && (
        <section className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>
            Aperçu opérationnel
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="RDV aujourd'hui" value={todayBookings.length} />
            <StatCard label="Non assignés" value={unassignedCount} color={unassignedCount > 0 ? '#EF4444' : '#22C55E'} />
            <StatCard label="Logs récents" value={recentLogs.length} color="#A78BFA" />
          </div>
        </section>
      )}

      {/* Today's bookings */}
      {todayBookings.length > 0 && (
        <section className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>
            RDV aujourd'hui ({todayBookings.length})
          </div>
          <div className="space-y-2">
            {todayBookings.map(b => (
              <div key={b.id} className="rounded-xl p-4 border flex justify-between items-start"
                   style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
                <div>
                  <div className="font-semibold text-sm text-white">{b.client_nom}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B8AA8' }}>
                    {b.slot_start} · {b.client_adresse}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-semibold"
                      style={{ background: '#0D2E4A', color: '#1B9EF3' }}>
                  {b.duration_hours}h
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>
          Actions rapides
        </div>
        <div className="grid grid-cols-2 gap-3">
          {profile.role !== 'cleaner' && (
            <>
              <Link href="/map" className="rounded-xl p-4 border flex flex-col gap-2 transition-colors hover:border-blue-400"
                    style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
                <span className="text-xl">📍</span>
                <span className="text-sm font-semibold text-white">Carte & Pings</span>
              </Link>
              <Link href="/book" className="rounded-xl p-4 border flex flex-col gap-2 transition-colors hover:border-blue-400"
                    style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
                <span className="text-xl">+</span>
                <span className="text-sm font-semibold text-white">Nouveau RDV</span>
              </Link>
            </>
          )}
          <Link href="/schedule" className="rounded-xl p-4 border flex flex-col gap-2 transition-colors hover:border-blue-400"
                style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
            <span className="text-xl">📅</span>
            <span className="text-sm font-semibold text-white">Mon horaire</span>
          </Link>
          {profile.role !== 'cleaner' && (
            <Link href="/sales" className="rounded-xl p-4 border flex flex-col gap-2 transition-colors hover:border-blue-400"
                  style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
              <span className="text-xl">📊</span>
              <span className="text-sm font-semibold text-white">Mes ventes</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
