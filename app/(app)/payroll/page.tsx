import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import PayrollClient from './PayrollClient';
import { getCommissionRate, getTierLabel, getRecallRate } from '@/lib/types';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard');

  const today = new Date().toISOString().split('T')[0];

  const { data: periods } = await supabase
    .from('pay_periods')
    .select('*')
    .gte('end_date', '2026-01-01')
    .order('start_date', { ascending: false })
    .limit(20);

  const { data: reps } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['rep', 'manager'])
    .eq('is_active', true)
    .order('full_name');

  // Get ALL closes with full data
  const { data: allCloses } = await supabase
    .from('leads')
    .select('id, assigned_rep_id, prix, sale_type, appointment_date, first_name, last_name, address, city')
    .eq('ping_type', 'close')
    .not('assigned_rep_id', 'is', null);

  const { data: jobberBookings } = await supabase
    .from('bookings')
    .select('date, prix_final, status')
    .not('jobber_job_id', 'is', null)
    .eq('status', 'completed');

  const allClosesArr = allCloses || [];
  const allPeriodsArr = periods || [];

  const periodPaychecks = allPeriodsArr.map(period => {
    // Period closes = those with appointment_date in range
    const periodCloses = allClosesArr.filter(c =>
      c.appointment_date &&
      c.appointment_date >= period.start_date &&
      c.appointment_date <= period.end_date
    );

    const periodJobber = (jobberBookings || []).filter(b =>
      b.date >= period.start_date && b.date <= period.end_date
    );

    const repBreakdown = (reps || []).map(rep => {
      const repCloses = periodCloses.filter(c => c.assigned_rep_id === rep.id);
      if (!repCloses.length) return null;

      const d2d = repCloses.filter(c => c.sale_type !== 'recall');
      const recall = repCloses.filter(c => c.sale_type === 'recall');

      // Cumulative D2D before this period (for tier)
      const cumulD2D = allClosesArr.filter(c =>
        c.assigned_rep_id === rep.id &&
        c.sale_type !== 'recall' &&
        c.appointment_date &&
        c.appointment_date < period.start_date
      ).length + d2d.length;

      const d2dRate = getCommissionRate(cumulD2D);
      const recallRate = getRecallRate(rep.id);

      const d2dRevenue = d2d.reduce((s, c) => s + (parseFloat(c.prix) || 0), 0);
      const recallRevenue = recall.reduce((s, c) => s + (parseFloat(c.prix) || 0), 0);
      const nullPrix = repCloses.filter(c => !c.prix || parseFloat(c.prix) === 0).length;

      return {
        rep_id: rep.id,
        full_name: rep.full_name,
        d2d_closes: d2d.length,
        recall_closes: recall.length,
        d2d_revenue: d2dRevenue,
        recall_revenue: recallRevenue,
        d2d_commission: d2dRevenue * d2dRate,
        recall_commission: recallRevenue * recallRate,
        total_commission: d2dRevenue * d2dRate + recallRevenue * recallRate,
        d2d_rate: d2dRate,
        recall_rate: recallRate,
        tier: getTierLabel(cumulD2D),
        closes: repCloses,
        null_prix_closes: nullPrix,
      };
    }).filter(Boolean) as any[];

    return {
      period,
      repBreakdown,
      totalCommission: repBreakdown.reduce((s, r) => s + r.total_commission, 0),
      totalCloses: repBreakdown.reduce((s, r) => s + r.d2d_closes + r.recall_closes, 0),
      jobberRevenue: periodJobber.reduce((s, b) => s + (b.prix_final || 0), 0),
      jobberJobs: periodJobber.length,
    };
  });

  const currentPeriodIndex = allPeriodsArr.findIndex(p =>
    p.start_date <= today && p.end_date >= today
  );

  const { data: syncState } = await supabase.from('sync_state').select('key,value');
  const jobberSync = syncState?.find(s => s.key === 'jobber_last_sync')?.value || '2020-01-01';

  return (
    <PayrollClient
      periodPaychecks={periodPaychecks}
      userId={user.id}
      jobberLastSync={jobberSync}
      currentPeriodIndex={currentPeriodIndex >= 0 ? currentPeriodIndex : 0}
    />
  );
}
