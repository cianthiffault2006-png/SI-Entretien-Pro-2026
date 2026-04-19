import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { SERVICES } from '@/lib/types';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { contract_id } = await req.json();
  const admin = createAdminClient();

  const { data: contract } = await admin
    .from('contracts')
    .select('*')
    .eq('id', contract_id)
    .single();

  if (!contract || !contract.client_email) {
    return NextResponse.json({ error: 'Contrat ou email introuvable' }, { status: 404 });
  }

  const serviceLabels = (contract.services || []).map((id: string) => {
    if (id.startsWith('ex-autre:')) return `Autre: ${id.replace('ex-autre:', '')}`;
    const svc = SERVICES.find(s => s.id === id);
    return svc?.label || id;
  });

  const dateFormatted = new Date(contract.date_service + 'T12:00:00').toLocaleDateString('fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
  .header { background: #0A1628; padding: 24px; text-align: center; }
  .logo { color: #1B9EF3; font-size: 28px; font-weight: 900; }
  .content { padding: 32px; }
  h2 { color: #111827; margin: 0 0 8px; }
  .meta { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  .section-title { font-weight: 700; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .label { color: #6B7280; }
  .value { color: #111827; font-weight: 500; }
  .price { color: #059669; font-size: 20px; font-weight: 700; }
  .services { display: flex; flex-wrap: wrap; gap: 6px; }
  .service-tag { background: #EFF6FF; color: #1D4ED8; padding: 4px 10px; border-radius: 20px; font-size: 13px; }
  .footer { background: #F9FAFB; padding: 20px 32px; font-size: 12px; color: #9CA3AF; text-align: center; }
  .clause { font-size: 12px; color: #6B7280; line-height: 1.6; margin-bottom: 12px; padding: 12px; background: #F9FAFB; border-radius: 8px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">SI ENTRETIEN</div>
    <div style="color: #93C5FD; font-size: 14px; margin-top: 4px;">Contrat de service confirmé</div>
  </div>
  <div class="content">
    <h2>Bonjour ${contract.client_nom},</h2>
    <p class="meta">Voici votre copie du contrat de service — ${contract.contract_number}</p>

    <div class="section">
      <div class="section-title">Détails du service</div>
      <div class="row"><span class="label">Date prévue</span><span class="value">${dateFormatted} ${contract.am_pm}</span></div>
      <div class="row"><span class="label">Adresse</span><span class="value">${contract.client_adresse || ''}</span></div>
      <div class="row"><span class="label">Vendeur</span><span class="value">${contract.rep_name}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Services inclus</div>
      <div class="services">
        ${serviceLabels.map((s: string) => `<span class="service-tag">${s}</span>`).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Tarification</div>
      ${contract.prix_avant_rabais ? `<div class="row"><span class="label">Prix avant rabais</span><span class="value" style="text-decoration:line-through">$${contract.prix_avant_rabais.toLocaleString('fr-CA')}</span></div>` : ''}
      <div class="row"><span class="label">Prix final</span><span class="price">$${contract.prix_final.toLocaleString('fr-CA')}</span></div>
      <div style="font-size:12px;color:#9CA3AF;margin-top:8px;">+ taxes applicables (TPS/TVQ)</div>
    </div>

    <div class="clause">
      <strong>Annulation:</strong> Vous disposez de 24 heures pour annuler sans frais. Après ce délai, des frais de 50% du montant total s'appliquent.
    </div>
    <div class="clause">
      <strong>Garantie:</strong> Satisfaction garantie 7 jours suivant le nettoyage. Contactez-nous à si.entretien@hotmail.com pour toute question.
    </div>
  </div>
  <div class="footer">
    <strong>SI Entretien</strong> · 80 Rue Giroux · (418) 350-7585 · si.entretien@hotmail.com<br/>
    TPS: 792 556 631 RT 0001 · TVQ: 1232 816 577 TQ 0001
  </div>
</div>
</body>
</html>`;

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SI Entretien <contrats@si-entretien.ca>',
      to: [contract.client_email],
      subject: `Contrat de service confirmé — ${contract.contract_number}`,
      html: emailHtml,
    }),
  });

  if (!resendRes.ok) {
    const e = await resendRes.text();
    return NextResponse.json({ error: `Email failed: ${e}` }, { status: 500 });
  }

  await admin.from('contracts').update({ emailed_to_client_at: new Date().toISOString() }).eq('id', contract_id);
  return NextResponse.json({ ok: true });
}
