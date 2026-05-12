import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID!;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro-2026.vercel.app';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new Response(`<html><body style="background:#0A1628;color:white;font-family:sans-serif;padding:40px">
      <h2 style="color:#EF4444">❌ Erreur Jobber OAuth</h2>
      <p>${error}</p>
      <a href="/payroll" style="color:#1B9EF3">← Retour à la paie</a>
    </body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/payroll?error=no_code`);
  }

  // Exchange code for tokens
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
    return new Response(`<html><body style="background:#0A1628;color:white;font-family:sans-serif;padding:40px">
      <h2 style="color:#EF4444">❌ Token exchange failed</h2>
      <pre style="color:#EF4444">${JSON.stringify(tokenData, null, 2)}</pre>
      <a href="/payroll" style="color:#1B9EF3">← Retour à la paie</a>
    </body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  // Store tokens in DB
  const sb = createClient(SB_URL, SB_SVC);
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await sb.from('oauth_tokens').upsert({
    id: 'jobber',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  return new Response(`<html><body style="background:#0A1628;color:white;font-family:sans-serif;padding:40px">
    <h2 style="color:#22C55E">✅ Jobber connecté!</h2>
    <p>Token enregistré. Vous pouvez fermer cette page et synchroniser Jobber depuis la page Paie.</p>
    <script>setTimeout(() => window.close(), 2000);</script>
    <a href="/payroll" style="color:#1B9EF3">← Retour à la paie</a>
  </body></html>`, { headers: { 'Content-Type': 'text/html' } });
}
