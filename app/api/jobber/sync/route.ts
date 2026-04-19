import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { SERVICES } from '@/lib/types';

const JOBBER_API = 'https://api.getjobber.com/api/graphql';

async function jobberQuery(query: string, variables: Record<string, any>) {
  const res = await fetch(JOBBER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.JOBBER_API_KEY}`,
      'X-JOBBER-GRAPHQL-VERSION': '2024-01-26',
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { booking_id } = await req.json();
  if (!booking_id) return NextResponse.json({ error: 'booking_id requis' }, { status: 400 });

  const admin = createAdminClient();
  const { data: booking } = await admin.from('bookings').select('*').eq('id', booking_id).single();
  if (!booking) return NextResponse.json({ error: 'Booking introuvable' }, { status: 404 });

  const serviceLabels = booking.services.map((id: string) => {
    if (id.startsWith('ex-autre:')) return id.replace('ex-autre:', 'Autre: ');
    return SERVICES.find(s => s.id === id)?.label || id;
  }).join(', ');

  try {
    // 1. Create or find client in Jobber
    const clientMutation = `
      mutation CreateClient($input: ClientCreateInput!) {
        clientCreate(input: $input) {
          client { id }
          userErrors { message path }
        }
      }
    `;

    const clientRes = await jobberQuery(clientMutation, {
      input: {
        firstName: booking.client_nom.split(' ')[0],
        lastName: booking.client_nom.split(' ').slice(1).join(' ') || '.',
        phones: booking.client_telephone ? [{ number: booking.client_telephone, primary: true }] : [],
        emails: booking.client_email ? [{ address: booking.client_email, primary: true }] : [],
        billingAddress: booking.client_adresse ? {
          street: booking.client_adresse,
          city: 'Québec',
          province: 'QC',
          country: 'CA',
        } : undefined,
      },
    });

    const clientId = clientRes?.data?.clientCreate?.client?.id;
    if (!clientId) {
      return NextResponse.json({ error: 'Failed to create Jobber client', detail: clientRes }, { status: 500 });
    }

    // 2. Create job in Jobber
    const jobMutation = `
      mutation CreateJob($input: JobCreateInput!) {
        jobCreate(input: $input) {
          job { id jobNumber }
          userErrors { message path }
        }
      }
    `;

    const jobRes = await jobberQuery(jobMutation, {
      input: {
        clientId,
        title: `Nettoyage — ${booking.client_nom}`,
        description: `Services: ${serviceLabels}\n\nAdresse: ${booking.client_adresse}\nVendeur: ${booking.rep_id}\n${booking.notes ? '\nNotes: ' + booking.notes : ''}`,
        startAt: `${booking.date}T${booking.slot_start.split(' ')[0].replace('h', ':')}00:00`,
        total: booking.prix_final,
      },
    });

    const jobId = jobRes?.data?.jobCreate?.job?.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create Jobber job', detail: jobRes }, { status: 500 });
    }

    // 3. Update booking with Jobber IDs
    await admin.from('bookings').update({
      jobber_job_id: String(jobId),
      jobber_client_id: String(clientId),
    }).eq('id', booking_id);

    // 4. Update payroll record with Jobber job ID
    await admin.from('payroll_records').update({ jobber_job_id: String(jobId) }).eq('booking_id', booking_id);

    return NextResponse.json({ ok: true, jobber_job_id: jobId, jobber_client_id: clientId });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
