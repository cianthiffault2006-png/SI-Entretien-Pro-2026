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

  const isManager = profile.role === 'admin' || profile.role === 'manager';
  if (!isManager) redirect('/dashboard');

  // Pay periods
  const { data: periods } = await supabase
    .from('pay_periods')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(10);

  // All rep profiles
  const { data: reps } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['rep', 'manager'])
    .eq('is_active', true)
    .order('full_name');

  // ALL closes from SR (with period date)
  const { data: allCloses } = await supabase
    .from('leads')
    .select('assigned_rep_id, prix, sale_type, appointment_date, first_name, last_name, address, city')
    .eq('ping_type', 'close')
    .not('assigned_rep_id', 'is', null)
    .not('appointment_date', 'is', null);

  // Also get Jobber bookings for "confirmed" check
  const { data: jobberBookings } = await supabase
    .from('bookings')
    .select('date, prix_final, client_nom, jobber_job_id, status')
    .not('jobber_job_id', 'is', null)
    .eq('status', 'completed');

  // Build period paycheck data
  const periodPaychecks = (periods || []).map(period => {
    // SR closes in this period
    const periodCloses = (allCloses || []).filter(c =>
      c.appointment_date >= period.start_date && c.appointment_date <= period.end_date
    );

    // Jobber completed jobs in this period (for "confirmed" revenue)
    const periodJobber = (jobberBookings || []).filter(b =>
      b.date >= period.start_date && b.date <= period.end_date
    );
    const jobberRevenue = periodJobber.reduce((s, b) => s + (b.prix_final || 0), 0);

    // Per rep breakdown
    const repBreakdown = (reps || []).map(rep => {
      const repCloses = periodCloses.filter(c => c.assigned_rep_id === rep.id);
      const d2d = repCloses.filter(c => c.sale_type !== 'recall');
      const recall = repCloses.filter(c => c.sale_type === 'recall');

      // For tier calculation, use CUMULATIVE d2d closes up to this period
      const allD2DBefore = (allCloses || []).filter(c =>
        c.assigned_rep_id === rep.id &&
        c.sale_type !== 'recall' &&
        c.appointment_date < period.start_date
      ).length;
      const cumulativeD2D = allD2DBefore + d2d.length;
      // Rate is based on cumulative closes at END of period
      const d2dRate = getCommissionRate(cumulativeD2D);
      const recallRate = getRecallRate(rep.id);

      const d2dRevenue = d2d.reduce((s, c) => s + (c.prix || 0), 0);
      const recallRevenue = recall.reduce((s, c) => s + (c.prix || 0), 0);
      const d2dComm = d2dRevenue * d2dRate;
      const recallComm = recallRevenue * recallRate;

      return {
        rep_id: rep.id,
        full_name: rep.full_name,
        d2d_closes: d2d.length,
        recall_closes: recall.length,
        d2d_revenue: d2dRevenue,
        recall_revenue: recallRevenue,
        d2d_commission: d2dComm,
        recall_commission: recallComm,
        total_commission: d2dComm + recallComm,
        d2d_rate: d2dRate,
        recall_rate: recallRate,
        tier: getTierLabel(cumulativeD2D),
        closes: repCloses,
      };
    }).filter(r => r.d2d_closes > 0 || r.recall_closes > 0);

    const totalCommission = repBreakdown.reduce((s, r) => s + r.total_commission, 0);
    const totalCloses = repBreakdown.reduce((s, r) => s + r.d2d_closes + r.recall_closes, 0);

    return {
      period,
      repBreakdown,
      totalCommission,
      totalCloses,
      jobberRevenue,
      jobberJobs: periodJobber.length,
    };
  });

  // Sync status
  const { data: syncState } = await supabase.from('sync_state').select('key,value');
  const jobberSync = syncState?.find(s => s.key === 'jobber_last_sync')?.value || '2020-01-01';

  return (
    <PayrollClient
      periodPaychecks={periodPaychecks}
      isManager={isManager}
      userId={user.id}
      jobberLastSync={jobberSync}
    />
  );
}
