import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import PayrollClient from './PayrollClient';
import { getCommissionRate, getTierLabel, getRecallRate } from '@/lib/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro-2026.vercel.app';
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID || '';

function jobberAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: JOBBER_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/jobber/callback`,
  });
  return `https://api.getjobber.com/api/oauth/authorize?${params}`;
}

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/dashboard');

  const today = new Date().toISOString().split('T')[0];

  const [periodsRes, repsRes, closesRes, bookingsRes, syncRes] = await Promise.all([
    supabase.from('pay_periods').select('*').gte('end_date', '2026-01-01').order('start_date', { ascending: false }).limit(20),
    supabase.from('profiles').select('id, full_name, role').in('role', ['rep', 'manager']).eq('is_active', true).order('full_name'),
    supabase.from('leads').select('id, assigned_rep_id, prix, sale_type, appointment_date, first_name, last_name, address, city, client_adresse').eq('ping_type', 'close').not('assigned_rep_id', 'is', null),
    supabase.from('bookings').select('date, prix_final, status, client_nom, client_adresse').not('jobber_job_id', 'is', null).eq('status', 'completed'),
    supabase.from('sync_state').select('key,value'),
  ]);

  const periods = periodsRes.data || [];
  const reps = repsRes.data || [];
  const allCloses = closesRes.data || [];
  const jobberCompleted = bookingsRes.data || [];
  const jobberSync = syncRes.data?.find(s => s.key === 'jobber_last_sync')?.value || '2020-01-01';

  // Helper: normalize address for matching
  function normAddr(a: string | null) {
    if (!a) return '';
    return a.toLowerCase()
      .replace(/[éèêë]/g,'e').replace(/[àâ]/g,'a').replace(/[îï]/g,'i')
      .replace(/[ôö]/g,'o').replace(/[ûùü]/g,'u').replace(/ç/g,'c')
      .replace(/,.*/, '').replace(/\s+/g,' ').trim();
  }

  const periodPaychecks = periods.map(period => {
    const periodCloses = allCloses.filter(c =>
      c.appointment_date && c.appointment_date >= period.start_date && c.appointment_date <= period.end_date
    );
    const periodJobber = jobberCompleted.filter(b => b.date >= period.start_date && b.date <= period.end_date);

    const repBreakdown = reps.map(rep => {
      const repCloses = periodCloses.filter(c => c.assigned_rep_id === rep.id);
      if (!repCloses.length) return null;

      const d2d = repCloses.filter(c => c.sale_type !== 'recall');
      const recall = repCloses.filter(c => c.sale_type === 'recall');

      const cumulD2D = allCloses.filter(c =>
        c.assigned_rep_id === rep.id && c.sale_type !== 'recall' &&
        c.appointment_date && c.appointment_date < period.start_date
      ).length + d2d.length;

      const d2dRate = getCommissionRate(cumulD2D);
      const recallRate = getRecallRate(rep.id);
      const d2dRevenue = d2d.reduce((s, c) => s + (parseFloat(c.prix) || 0), 0);
      const recallRevenue = recall.reduce((s, c) => s + (parseFloat(c.prix) || 0), 0);

      // Confirmed: match SR closes to Jobber completed jobs by address
      let confirmedRevenue = 0;
      const closesWithMatch = repCloses.map(c => {
        const addr = normAddr(c.address || c.client_adresse);
        const matched = addr.length > 5 && periodJobber.some(j => normAddr(j.client_adresse).includes(addr.split(' ').slice(0,2).join(' ')));
        if (matched) {
          const jobberJob = periodJobber.find(j => normAddr(j.client_adresse).includes(addr.split(' ').slice(0,2).join(' ')));
          confirmedRevenue += jobberJob?.prix_final || parseFloat(c.prix) || 0;
        }
        return { ...c, jobber_matched: matched };
      });

      const confirmedCommission = confirmedRevenue > 0
        ? confirmedRevenue * d2dRate
        : 0;

      return {
        rep_id: rep.id, full_name: rep.full_name,
        d2d_closes: d2d.length, recall_closes: recall.length,
        d2d_revenue: d2dRevenue, recall_revenue: recallRevenue,
        d2d_commission: d2dRevenue * d2dRate,
        recall_commission: recallRevenue * recallRate,
        total_commission: d2dRevenue * d2dRate + recallRevenue * recallRate,
        confirmed_commission: confirmedCommission,
        d2d_rate: d2dRate, recall_rate: recallRate,
        tier: getTierLabel(cumulD2D),
        closes: closesWithMatch,
        null_prix_closes: repCloses.filter(c => !c.prix || parseFloat(c.prix) === 0).length,
        jobber_matched: closesWithMatch.filter(c => c.jobber_matched).length,
      };
    }).filter(Boolean) as any[];

    return {
      period,
      repBreakdown,
      totalExpected: repBreakdown.reduce((s, r) => s + r.total_commission, 0),
      totalConfirmed: repBreakdown.reduce((s, r) => s + r.confirmed_commission, 0),
      totalCloses: repBreakdown.reduce((s, r) => s + r.d2d_closes + r.recall_closes, 0),
      jobberJobs: periodJobber.length,
    };
  });

  const currentPeriodIndex = periods.findIndex(p => p.start_date <= today && p.end_date >= today);

  return (
    <PayrollClient
      periodPaychecks={periodPaychecks}
      userId={user.id}
      jobberLastSync={jobberSync}
      currentPeriodIndex={currentPeriodIndex >= 0 ? currentPeriodIndex : 0}
      jobberAuthUrl={jobberAuthUrl()}
    />
  );
}
