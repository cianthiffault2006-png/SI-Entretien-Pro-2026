import { NextResponse } from 'next/server';

const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://si-entretien-pro-2026.vercel.app';

export async function GET() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: JOBBER_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/jobber/callback`,
  });

  return NextResponse.redirect(
    `https://api.getjobber.com/api/oauth/authorize?${params}`
  );
}
