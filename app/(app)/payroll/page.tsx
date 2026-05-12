import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import PayrollClient from './PayrollClient';
import { getCommissionRate, getTierLabel, getRecallRate } from '@/lib/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro.vercel.app';
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID || '';

function jobberAuthUrl() {
  return `https://api.getjobber.com/api/oauth/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: JOBBER_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/jobber/callback`,
  })}`;
}

// Normalize address for matching: lowercase, remove accents, strip after comma, collapse spaces
function normAddr(a: string | null): string {
  if (!a) return '';
  let s = a.toLowerCase();
  for (const [f, t] of [['é','e'],['è','e'],['ê','e'],['ë','e'],['à','a'],['â','a'],['î','i'],['ô','o'],['û','u'],['ù','u'],['ç','c'],['ã','a']] as [string,string][]) s = s.replaceAll(f, t);
  s = s.replace(/,.*/, '').replace(/\s+/g, ' ').trim();
  return s;
}

// Extract street number + first word of street name for fuzzy matching
function addrKey(a: string): string {
  const parts = normAddr(a).split(' ');
  return parts.slice(0, 3).join(' '); // e.g. "152 rue joseph"
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
    // All closes ever — needed for tier calculation
    supabase.from('leads').select('id, assigned_rep_id, prix, sale_type, appointment_date, first_name, last_name, address, city').eq('ping_type', 'close').not('assigned_rep_id', 'is', null),
    // All Jobber jobs with their visit date and status
    supabase.from('bookings').select('id, jobber_job_id, date, prix_final, status, jobber_status, client_nom, client_adresse').not('jobber_job_id', 'is', null),
    supabase.from('sync_state').select('key,value'),
  ]);

  const periods = periodsRes.data || [];
  const reps = repsRes.data || [];
  const allSRCloses = closesRes.data || [];
  const allJobberJobs = bookingsRes.data || [];
  const jobberSync = syncRes.data?.find(s => s.key === 'jobber_last_sync')?.value || '2020-01-01';

  // Build address → rep lookup from SR closes
  // For each SR close address, store which rep closed it
  const addrToRep: Record<string, { rep_id: string; sale_type: string; prix: number }> = {};
  for (const c of allSRCloses) {
    if (!c.address) continue;
    const key = addrKey(c.address);
    if (key.length > 8) {
      addrToRep[key] = {
        rep_id: c.assigned_rep_id,
        sale_type: c.sale_type || 'd2d',
        prix: parseFloat(c.prix) || 0,
      };
    }
  }

  // For each rep, compute cumulative completed Jobber jobs (for tier)
  // Completed Jobber job matched to a rep via address = counts toward tier
  const repCompletedAllTime: Record<string, number> = {};
  for (const j of allJobberJobs) {
    if (j.status !== 'completed' || !j.client_adresse) continue;
    const key = addrKey(j.client_adresse);
    const match = addrToRep[key];
    if (match) {
      repCompletedAllTime[match.rep_id] = (repCompletedAllTime[match.rep_id] || 0) + 1;
    }
  }

  const periodPaychecks = periods.map(period => {
    // Jobber jobs with visit date in this period
    const periodJobs = allJobberJobs.filter(j =>
      j.date >= period.start_date && j.date <= period.end_date && j.status !== 'cancelled'
    );

    const completedJobs = periodJobs.filter(j => j.status === 'completed');
    const scheduledJobs = periodJobs.filter(j => j.status === 'scheduled');

    // For each rep, find which Jobber jobs in this period are theirs (via address match)
    const repBreakdown = reps.map(rep => {
      // Match completed Jobber jobs to this rep
      const repCompleted = completedJobs.filter(j => {
        if (!j.client_adresse) return false;
        const key = addrKey(j.client_adresse);
        return addrToRep[key]?.rep_id === rep.id;
      });

      // Match scheduled Jobber jobs to this rep
      const repScheduled = scheduledJobs.filter(j => {
        if (!j.client_adresse) return false;
        const key = addrKey(j.client_adresse);
        return addrToRep[key]?.rep_id === rep.id;
      });

      if (!repCompleted.length && !repScheduled.length) return null;

      // Tier = based on cumulative completed jobs UP TO end of this period
      // Count completed jobs matched to this rep up to period end date
      const cumulCompleted = allJobberJobs.filter(j => {
        if (j.status !== 'completed' || !j.client_adresse || j.date > period.end_date) return false;
        return addrToRep[addrKey(j.client_adresse)]?.rep_id === rep.id;
      }).length;

      const d2dRate = getCommissionRate(cumulCompleted);
      const recallRate = getRecallRate(rep.id);

      // Revenue calculations
      const completedRevenue = repCompleted.reduce((s, j) => s + (parseFloat(j.prix_final) || 0), 0);
      const scheduledRevenue = repScheduled.reduce((s, j) => s + (parseFloat(j.prix_final) || 0), 0);

      // For commission, use sale_type from SR match to determine rate
      let confirmedD2DRev = 0, confirmedRecallRev = 0;
      for (const j of repCompleted) {
        const key = addrKey(j.client_adresse || '');
        const srMatch = addrToRep[key];
        const rev = parseFloat(j.prix_final) || 0;
        if (srMatch?.sale_type === 'recall') confirmedRecallRev += rev;
        else confirmedD2DRev += rev;
      }

      let expectedD2DRev = 0, expectedRecallRev = 0;
      for (const j of repScheduled) {
        const key = addrKey(j.client_adresse || '');
        const srMatch = addrToRep[key];
        const rev = parseFloat(j.prix_final) || 0;
        if (srMatch?.sale_type === 'recall') expectedRecallRev += rev;
        else expectedD2DRev += rev;
      }

      const confirmedCommission = confirmedD2DRev * d2dRate + confirmedRecallRev * recallRate;
      const expectedCommission = (confirmedD2DRev + expectedD2DRev) * d2dRate + (confirmedRecallRev + expectedRecallRev) * recallRate;

      return {
        rep_id: rep.id,
        full_name: rep.full_name,
        completed_jobs: repCompleted.length,
        scheduled_jobs: repScheduled.length,
        confirmed_revenue: completedRevenue,
        expected_revenue: completedRevenue + scheduledRevenue,
        confirmed_commission: confirmedCommission,
        expected_commission: expectedCommission,
        d2d_rate: d2dRate,
        recall_rate: recallRate,
        tier: getTierLabel(cumulCompleted),
        cumul_completed: cumulCompleted,
        completed_details: repCompleted.map(j => ({
          ...j,
          sale_type: addrToRep[addrKey(j.client_adresse||'')]?.sale_type || 'd2d',
        })),
        scheduled_details: repScheduled.map(j => ({
          ...j,
          sale_type: addrToRep[addrKey(j.client_adresse||'')]?.sale_type || 'd2d',
        })),
      };
    }).filter(Boolean) as any[];

    // Unmatched Jobber jobs (no SR close found for address)
    const unmatchedCompleted = completedJobs.filter(j => {
      if (!j.client_adresse) return true;
      const key = addrKey(j.client_adresse);
      return !addrToRep[key];
    });

    return {
      period,
      repBreakdown,
      totalConfirmed: repBreakdown.reduce((s, r) => s + r.confirmed_commission, 0),
      totalExpected: repBreakdown.reduce((s, r) => s + r.expected_commission, 0),
      totalConfirmedRevenue: completedJobs.reduce((s, j) => s + (parseFloat(j.prix_final) || 0), 0),
      totalScheduledRevenue: scheduledJobs.reduce((s, j) => s + (parseFloat(j.prix_final) || 0), 0),
      completedJobs: completedJobs.length,
      scheduledJobs: scheduledJobs.length,
      unmatchedCount: unmatchedCompleted.length,
      unmatchedRevenue: unmatchedCompleted.reduce((s, j) => s + (parseFloat(j.prix_final) || 0), 0),
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
