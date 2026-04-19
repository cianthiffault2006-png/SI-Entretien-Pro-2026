// lib/types.ts — FULL REPLACEMENT — fixes min vs min_price, adds checkLowball

export type PingType = 'not_home' | 'no' | 'close' | 'follow_up' | 'call_back' | 'other' | 'never';

export const PING_CONFIG: Record<PingType, { label: string; hex: string }> = {
  not_home:  { label: 'Pas là',   hex: '#9CA3AF' },
  no:        { label: 'Non',      hex: '#EF4444' },
  close:     { label: 'Close ✓',  hex: '#22C55E' },
  follow_up: { label: 'Suivi',    hex: '#3B82F6' },
  call_back: { label: 'Rappel',   hex: '#F59E0B' },
  other:     { label: 'Autre',    hex: '#A78BFA' },
  never:     { label: 'Jamais',   hex: '#374151' },
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'rep' | 'cleaner';
  team?: string;
  language: string;
  phone?: string;
  signature_data?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: number;
  heure: string;
  actif: boolean;
  sort_order: number;
}

export interface Booking {
  id: string;
  date: string;
  slot_start: string;
  slot_start_index: number;
  duration_hours: number;
  client_nom: string;
  client_telephone?: string;
  client_email?: string;
  client_adresse: string;
  client_adresse_lat?: number;
  client_adresse_lng?: number;
  services: string[];
  prix_avant_rabais?: number;
  prix_final?: number;
  am_pm?: 'AM' | 'PM';
  notes?: string;
  rep_id: string;
  cleaner_ids: string[];
  status: 'scheduled' | 'completed' | 'cancelled';
  contract_id?: string;
  jobber_job_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Ping {
  id: string;
  lat: number;
  lng: number;
  address?: string;
  ping_type: PingType;
  notes?: string;
  rep_id: string;
  territory_id?: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string };
}

export interface Territory {
  id: string;
  name: string;
  region?: string;
  polygon_coordinates: { lat: number; lng: number }[];
  assigned_rep_id?: string;
  status: 'active' | 'in_progress' | 'completed';
  created_by: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  booking_id?: string;
  rep_id: string;
  rep_name: string;
  client_nom: string;
  client_adresse?: string;
  client_telephone?: string;
  client_email?: string;
  services: string[];
  prix_avant_rabais?: number;
  prix_final: number;
  date_service: string;
  am_pm: 'AM' | 'PM';
  client_signature_data?: string;
  pdf_url?: string;
  signed_at?: string;
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  rep_id: string;
  booking_id?: string;
  contract_id?: string;
  amount_pre_tax: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  year_of_close: number;
  confirmed_at?: string;
  created_at: string;
  profiles?: { full_name: string };
}

export interface SalesLog {
  id: string;
  rep_id: string;
  log_date: string;
  revenue_value: number;
  closes_count: number;
  hours_worked: number;
  is_deleted: boolean;
  notes?: string;
  created_at: string;
}

// ─── SERVICES ────────────────────────────────────────────────────────────────
// min_price: lowball floor (null = no minimum / extras)
// minor: true = doesn't count toward 4h job detection

export interface Service {
  id: string;
  label: string;
  cat: string;
  minor: boolean;
  min_price: number | null;
}

export const SERVICES: Service[] = [
  // VITRES
  { id: 'vit-ext',    label: 'Vitres Ext.',          cat: 'VITRES',     minor: false, min_price: 175 },
  { id: 'vit-int',    label: 'Vitres Int.',           cat: 'VITRES',     minor: false, min_price: 175 },
  // NETTOYAGE
  { id: 'frot',       label: 'Frottage gouttières',   cat: 'NETTOYAGE',  minor: false, min_price: 125 },
  { id: 'vid',        label: 'Vidage gouttières',     cat: 'NETTOYAGE',  minor: false, min_price: 175 },
  // REVÊTEMENT
  { id: 'rev-mur',    label: 'Revêtement / mur',      cat: 'REVÊTEMENT', minor: false, min_price: 100 },
  { id: 'rev-spot',   label: 'Revêtement spot',       cat: 'REVÊTEMENT', minor: false, min_price: 50  },
  // PRESSION
  { id: 'pres-mur',   label: 'Pression mur',          cat: 'PRESSION',   minor: false, min_price: null },
  { id: 'pres-ent',   label: 'Pression entrée',       cat: 'PRESSION',   minor: false, min_price: null },
  { id: 'pres-sol',   label: 'Pression sol',          cat: 'PRESSION',   minor: false, min_price: null },
  // AUTO
  { id: 'auto-int',     label: 'Auto Int.',           cat: 'AUTO',       minor: false, min_price: 125 },
  { id: 'auto-extint',  label: 'Auto Ext+Int',        cat: 'AUTO',       minor: false, min_price: 175 },
  // EXTRAS — no minimum, don't trigger 4h
  { id: 'ex-garage',    label: 'Porte de garage',     cat: 'EXTRAS',     minor: true,  min_price: null },
  { id: 'ex-barriere',  label: 'Barrière vitrée',     cat: 'EXTRAS',     minor: true,  min_price: null },
  { id: 'ex-cabanon',   label: 'Cabanon',             cat: 'EXTRAS',     minor: true,  min_price: null },
  { id: 'ex-solarium',  label: 'Solarium',            cat: 'EXTRAS',     minor: true,  min_price: null },
  { id: 'ex-bacs',      label: 'Bacs à ordures',      cat: 'EXTRAS',     minor: true,  min_price: null },
  { id: 'ex-autre',     label: 'Autre',               cat: 'EXTRAS',     minor: true,  min_price: null },
];

export const MINOR_SERVICE_IDS = SERVICES.filter(s => s.minor).map(s => s.id);

export function is4HourJob(serviceIds: string[]): boolean {
  const main = serviceIds.filter(id => !MINOR_SERVICE_IDS.includes(id.split(':')[0]));
  return main.length >= 2;
}

// ─── LOWBALL DETECTION ───────────────────────────────────────────────────────
export interface LowballWarning {
  service: string;
  minimum: number;
}

export function checkLowball(serviceIds: string[], totalPrice: number): LowballWarning[] {
  if (!totalPrice || totalPrice <= 0) return [];
  let totalMin = 0;
  const relevant: LowballWarning[] = [];
  for (const id of serviceIds) {
    const baseId = id.split(':')[0];
    const svc = SERVICES.find(s => s.id === baseId);
    if (svc?.min_price) {
      totalMin += svc.min_price;
      relevant.push({ service: svc.label, minimum: svc.min_price });
    }
  }
  return totalMin > 0 && totalPrice < totalMin ? relevant : [];
}

// ─── COMMISSION HELPERS ───────────────────────────────────────────────────────
export function getCommissionRate(confirmedCloses: number): number {
  if (confirmedCloses >= 450) return 0.25;
  if (confirmedCloses >= 300) return 0.20;
  if (confirmedCloses >= 150) return 0.175;
  return 0.15;
}

export function getTierLabel(confirmedCloses: number): string {
  if (confirmedCloses >= 450) return 'Élite';
  if (confirmedCloses >= 300) return 'Tier 3';
  if (confirmedCloses >= 150) return 'Tier 2';
  return 'Débutant';
}

export function getNextTierInfo(confirmedCloses: number): { closes: number; rate: number } | null {
  if (confirmedCloses >= 450) return null;
  if (confirmedCloses >= 300) return { closes: 450 - confirmedCloses, rate: 0.25 };
  if (confirmedCloses >= 150) return { closes: 300 - confirmedCloses, rate: 0.20 };
  return { closes: 150 - confirmedCloses, rate: 0.175 };
}
