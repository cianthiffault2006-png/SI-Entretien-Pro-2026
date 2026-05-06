import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { getCommissionRate } from '@/lib/types';

/**
 * Jobber webhook endpoint.
 * Configure in Jobber: Settings → API & Apps → Webhooks
 * URL: https://your-vercel-app.vercel.app/api/webhooks/jobber
 * Events: job.completed
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const admin = createAdminClient();

  // Jobber sends different event types — we only care about job completion
  const event = body.webHookType || body.event_type || body.type;

  if (event !== 'JOB_COMPLETED' && event !== 'job.completed' && event !== 'VISIT_COMPLETED') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const jobberJobId = body.data?.id || body.job?.id || body.id;
  if (!jobberJobId) {
    return NextResponse.json({ error: 'No job ID in payload' }, { status: 400 });
  }

  // Find the booking linked to this Jobber job
  const { data: booking } = await admin
    .from('bookings')
    .select('id, rep_id, status')
    .eq('jobber_job_id', String(jobberJobId))
    .single();

  if (!booking) {
    // Try payroll records directly
    const { data: payrollRecord } = await admin
      .from('payroll_records')
      .select('id, rep_id, status, amount_pre_tax, commission_rate, year_of_close')
      .eq('jobber_job_id', String(jobberJobId))
      .single();

    if (!payrollRecord) {
      return NextResponse.json({ ok: true, message: 'No matching booking/payroll found' });
    }

    if (payrollRecord.status !== 'pending') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    await admin.from('payroll_records')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', payrollRecord.id);

    return NextResponse.json({ ok: true, confirmed: payrollRecord.id });
  }

  // Mark booking as completed
  await admin.from('bookings').update({ status: 'completed' }).eq('id', booking.id);

  // Find and confirm the pending payroll record for this booking
  const { data: payroll } = await admin
    .from('payroll_records')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('status', 'pending')
    .single();

  if (payroll) {
    const year = new Date().getFullYear();

    // Recalculate commission rate based on confirmed closes at the time of confirmation
    const { count: confirmedCount } = await admin
      .from('payroll_records')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', booking.rep_id)
      .eq('year_of_close', year)
      .eq('status', 'confirmed');

    const rate = getCommissionRate(confirmedCount || 0);
    const newCommission = payroll.amount_pre_tax * rate;

    await admin.from('payroll_records')
      .update({
        status: 'confirmed',
        commission_rate: rate,
        commission_amount: newCommission,
        confirmed_at: new Date().toISOString(),
        jobber_job_id: String(jobberJobId),
      })
      .eq('id', payroll.id);
  }

  return NextResponse.json({ ok: true, booking_id: booking.id });
}
