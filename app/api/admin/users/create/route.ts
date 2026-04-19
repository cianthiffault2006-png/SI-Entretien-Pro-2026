import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { full_name, email, role, team } = await req.json();
  if (!full_name || !email || !role) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  const admin = createAdminClient();

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'si123',
    email_confirm: true,
  });

  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

  const { data: newProfile, error: profErr } = await admin
    .from('profiles')
    .insert({ id: authUser.user.id, full_name, email, role, team: team || null, language: 'fr' })
    .select()
    .single();

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

  return NextResponse.json({ profile: newProfile });
}
