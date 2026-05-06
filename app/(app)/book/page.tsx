import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import BookContractClient from './BookContractClient';

export default async function BookPage({
  searchParams
}: {
  searchParams: {
    from_ping?: string;
    addr?: string;
    lat?: string;
    lng?: string;
    prefillName?: string;
    prefillPhone?: string;
    prefillEmail?: string;
    prefillAddress?: string;
    prefillLat?: string;
    prefillLng?: string;
    lead_id?: string;
  }
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: timeSlots } = await supabase
    .from('time_slots').select('*').eq('actif', true).order('sort_order');

  // Get next contract number
  const { data: lastContract } = await supabase
    .from('contracts').select('contract_number').order('created_at', { ascending: false }).limit(1).single();

  let nextNum = 1;
  if (lastContract?.contract_number) {
    const m = lastContract.contract_number.match(/(\d+)$/);
    if (m) nextNum = parseInt(m[1]) + 1;
  }
  const nextContractNumber = `${new Date().getFullYear()}-CR-${String(nextNum).padStart(3, '0')}`;

  // Prefill from ping
  let pingAddr = searchParams.addr ? decodeURIComponent(searchParams.addr) : undefined;
  let pingLat = searchParams.lat ? parseFloat(searchParams.lat) : undefined;
  let pingLng = searchParams.lng ? parseFloat(searchParams.lng) : undefined;

  return (
    <BookContractClient
      profile={profile}
      userId={user.id}
      timeSlots={timeSlots || []}
      nextContractNumber={nextContractNumber}
      prefillName={searchParams.prefillName}
      prefillPhone={searchParams.prefillPhone}
      prefillEmail={searchParams.prefillEmail}
      prefillAddress={searchParams.prefillAddress || pingAddr}
      prefillLat={searchParams.prefillLat ? parseFloat(searchParams.prefillLat) : pingLat}
      prefillLng={searchParams.prefillLng ? parseFloat(searchParams.prefillLng) : pingLng}
      fromPingId={searchParams.from_ping}
      fromLeadId={searchParams.lead_id}
    />
  );
}
