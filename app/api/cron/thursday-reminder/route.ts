import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

/**
 * Thursday weekly reminder to set availability.
 * Set up in Vercel as a cron job:
 *   Schedule: 0 14 * * 4   (every Thursday at 14:00 UTC = ~10am ET)
 *   Path: /api/cron/thursday-reminder
 *
 * OR call manually from the admin panel.
 */
export async function GET(req: NextRequest) {
  // Simple auth — Vercel cron sends CRON_SECRET in header
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('is_active', true)
    .neq('role', 'admin');

  if (!profiles?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Calculate next week label
  const now = new Date();
  const day = now.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilNextMonday);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const weekLabel = `${fmt(nextMonday)} au ${fmt(nextSunday)}`;

  let sent = 0;
  for (const p of profiles) {
    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:20px;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0A1628;padding:20px;text-align:center;">
    <span style="color:#1B9EF3;font-size:24px;font-weight:900;">SI ENTRETIEN</span>
  </div>
  <div style="padding:28px;">
    <h2 style="color:#111827;margin:0 0 8px;">Bonjour ${p.full_name.split(' ')[0]}!</h2>
    <p style="color:#6B7280;margin:0 0 20px;">N'oublie pas de remplir ton horaire pour la semaine du <strong>${weekLabel}</strong>.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro.vercel.app'}/schedule"
       style="display:block;background:#1B9EF3;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;">
      Remplir mon horaire →
    </a>
    <p style="color:#9CA3AF;font-size:12px;margin-top:20px;text-align:center;">
      SI Entretien Pro · Chaque jeudi
    </p>
  </div>
</div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SI Entretien <horaires@si-entretien.ca>',
        to: [p.email],
        subject: `⏰ Remplis ton horaire — semaine du ${weekLabel}`,
        html: emailHtml,
      }),
    });

    if (res.ok) sent++;
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  return NextResponse.json({ ok: true, sent, total: profiles.length });
}
