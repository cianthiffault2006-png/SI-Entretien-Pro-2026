import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { lead_id, sale_type } = await req.json();

  if (!lead_id || !['d2d', 'recall'].includes(sale_type)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  // Only managers/admins can change sale type, or the assigned rep
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: lead } = await supabase.from('leads').select('assigned_rep_id').eq('id', lead_id).single();

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || lead?.assigned_rep_id === user.id;
  if (!canEdit) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { error } = await supabase.from('leads').update({ sale_type }).eq('id', lead_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, sale_type });
}
