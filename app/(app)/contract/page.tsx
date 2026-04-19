import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ContractClient from './ContractClient';

export default async function ContractPage({
  searchParams
}: {
  searchParams: {
    booking_id?: string;
    client_nom?: string;
    client_adresse?: string;
    client_telephone?: string;
    client_email?: string;
  }
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  // Get next contract number
  const { data: lastContract } = await supabase
    .from('contracts')
    .select('contract_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (lastContract?.contract_number) {
    const match = lastContract.contract_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const year = new Date().getFullYear();
  const nextContractNumber = `${year}-CR-${String(nextNum).padStart(3, '0')}`;

  // Load booking if booking_id provided
  let booking = null;
  if (searchParams.booking_id) {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', searchParams.booking_id)
      .single();
    booking = data;
  }

  return (
    <ContractClient
      profile={profile}
      userId={user.id}
      booking={booking}
      nextContractNumber={nextContractNumber}
      prefillNom={searchParams.client_nom}
      prefillAdresse={searchParams.client_adresse}
      prefillTel={searchParams.client_telephone}
      prefillEmail={searchParams.client_email}
    />
  );
}
