import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID!;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro.vercel.app';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/payroll?jobber_error=${error || 'no_code'}`);
  }

  const tokenRes = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${APP_URL}/api/jobber/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.redirect(`${APP_URL}/payroll?jobber_error=token_exchange_failed`);
  }

  const sb = createClient(SB_URL, SB_SVC);
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString(); // default 60min

  await sb.from('oauth_tokens').upsert({
    id: 'jobber',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  // Redirect back to payroll with success flag
  return NextResponse.redirect(`${APP_URL}/payroll?jobber_connected=1`);
}
