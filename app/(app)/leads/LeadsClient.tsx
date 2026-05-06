'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { PingType } from '@/lib/types';

interface Lead {
  id: string; sr_id: number; first_name: string; last_name: string;
  phone: string; email: string; address: string; city: string; state: string;
  lat: number; lng: number; has_gps: boolean; status_sr: string; ping_type: string;
  notes: string; appointment_date: string; prix: number; services_sr: string[];
  sr_rep_name: string; booking_id: string | null; sr_files?: any[];
}

const TYPES: PingType[] = ['close','not_home','no','follow_up','call_back','never','other'];
const TL: Record<string, {label: string; hex: string}> = {
  close:{label:'Close',hex:'#22C55E'}, not_home:{label:'Pas là',hex:'#9CA3AF'},
  no:{label:'Non',hex:'#EF4444'}, follow_up:{label:'Suivi',hex:'#3B82F6'},
  call_back:{label:'Rappel',hex:'#F59E0B'}, never:{label:'Jamais',hex:'#374151'}, other:{label:'Autre',hex:'#A78BFA'},
};

export default function LeadsClient({ profile, userId, initialLeads, totalCount }: {
  profile: any; userId: string; initialLeads: Lead[]; totalCount: number;
}) {
  const router = useRouter();
  const sb = createClient();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGPS, setFilterGPS] = useState<'all'|'gps'|'no-gps'>('all');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Lead|null>(null);
  const [stimer, setStimer] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [contractLoading, setContractLoading] = useState(false);

  async function doSearch(q: string, type: string, gps: string) {
    setLoading(true);
    let query = sb.from('leads').select('*')
      .order('appointment_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }).limit(100);
    if (q.trim().length >= 2) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%`);
    if (type !== 'all') query = query.eq('ping_type', type);
    if (gps === 'gps') query = query.eq('has_gps', true);
    if (gps === 'no-gps') query = query.eq('has_gps', false);
    const { data } = await query; setLeads(data || []); setLoading(false);
  }

  function onSearch(v: string) { setSearch(v); clearTimeout(stimer); setStimer(setTimeout(() => doSearch(v, filterType, filterGPS), 300)); }
  function onType(t: string) { setFilterType(t); doSearch(search, t, filterGPS); }
  function onGPS(g: 'all'|'gps'|'no-gps') { setFilterGPS(g); doSearch(search, filterType, g); }

  async function open(lead: Lead) {
    const same = selected?.id === lead.id;
    setSelected(same ? null : lead); setContract(null);
    if (!same && lead.ping_type === 'close') {
      setContractLoading(true);
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
      let q = sb.from('contracts').select('*').order('created_at', { ascending: false }).limit(1);
      if (lead.booking_id) q = q.eq('booking_id', lead.booking_id);
      else if (name) q = q.eq('client_nom', name);
      const { data } = await q.maybeSingle();
      setContract(data || null); setContractLoading(false);
    }
  }

  function book(l: Lead) {
    const p = new URLSearchParams();
    const name = [l.first_name, l.last_name].filter(Boolean).join(' ');
    const addr = [l.address, l.city].filter(Boolean).join(', ');
    if (name) p.set('prefillName', name); if (addr) p.set('prefillAddress', addr);
    if (l.lat) p.set('prefillLat', String(l.lat)); if (l.lng) p.set('prefillLng', String(l.lng));
    if (l.phone) p.set('prefillPhone', l.phone); if (l.email) p.set('prefillEmail', l.email);
    router.push(`/book?${p}`);
  }

  function sign(l: Lead) {
    const p = new URLSearchParams();
    const name = [l.first_name, l.last_name].filter(Boolean).join(' ');
    const addr = [l.address, l.city].filter(Boolean).join(', ');
    if (name) p.set('client_nom', name); if (addr) p.set('client_adresse', addr);
    if (l.phone) p.set('client_telephone', l.phone); if (l.email) p.set('client_email', l.email);
    router.push(`/contract?${p}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#070E1A' }}>
      <div style={{ flexShrink: 0, padding: '12px 16px', background: '#0A1628', borderBottom: '1px solid #1E3A5F' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 18, color: 'white', margin: 0 }}>Leads</h1>
            <div style={{ fontSize: 11, color: '#5A8AA8' }}>{totalCount.toLocaleString('fr-CA')} leads SR</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['close','not_home','no'].map(t => (
              <div key={t} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: TL[t].hex }}>{leads.filter(l => l.ping_type === t).length}</div>
                <div style={{ fontSize: 10, color: '#4A6A88' }}>{TL[t].label}</div>
              </div>
            ))}
          </div>
        </div>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Nom, téléphone, adresse..."
               style={{ width: '100%', padding: '7px 12px', borderRadius: 10, border: '1px solid #1E3A5F', background: '#132D45', color: 'white', fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => onType(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#8BAEC8' }}>
            <option value="all">Tous statuts</option>
            {TYPES.map(t => <option key={t} value={t}>{TL[t].label}</option>)}
          </select>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1E3A5F' }}>
            {([['all','Tous'],['gps','📍'],['no-gps','⚠ Sans GPS']] as const).map(([v, l]) => (
              <button key={v} onClick={() => onGPS(v)} style={{ padding: '4px 8px', fontSize: 11, background: filterGPS === v ? '#1B9EF3' : '#132D45', color: filterGPS === v ? 'white' : '#6B8AA8', border: 'none', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          {TYPES.slice(0, 4).map(t => (
            <button key={t} onClick={() => onType(filterType === t ? 'all' : t)}
                    style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1px solid ${filterType === t ? TL[t].hex : '#1E3A5F'}`, background: filterType === t ? TL[t].hex + '22' : '#132D45', color: filterType === t ? TL[t].hex : '#6B8AA8', cursor: 'pointer' }}>
              {TL[t].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#5A8AA8' }}>...</div>}
        {!loading && leads.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#4A6A88' }}>Aucun résultat</div>}
        {!loading && leads.map(lead => {
          const type = TL[lead.ping_type] || { label: lead.ping_type, hex: '#6B8AA8' };
          const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Inconnu';
          const addr = [lead.address, lead.city].filter(Boolean).join(', ');
          const isClose = lead.ping_type === 'close';
          const isOpen = selected?.id === lead.id;
          return (
            <div key={lead.id} style={{ borderBottom: '1px solid #0F1E30', cursor: 'pointer' }} onClick={() => open(lead)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }} className="hover:bg-white/5">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: type.hex, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {name} {isClose && lead.booking_id && <span style={{ fontSize: 10, color: '#22C55E' }}>✓ RDV</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#5A8AA8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{addr || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {lead.appointment_date && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#22C55E22', color: '#22C55E' }}>📅 {lead.appointment_date}</span>}
                  {!lead.has_gps && <span style={{ color: '#EF4444', fontSize: 11 }}>⚠</span>}
                  {lead.prix > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E' }}>${lead.prix}</span>}
                  {lead.sr_rep_name && <span style={{ fontSize: 10, color: '#4A6A88' }}>{lead.sr_rep_name.split(' ')[0]}</span>}
                </div>
              </div>

              {isOpen && (
                <div style={{ background: '#0A1628', borderTop: '1px solid #1E3A5F22', padding: '0 16px 14px' }} onClick={e => e.stopPropagation()}>

                  {/* ── GENERAL INFO (like SR) ── */}
                  <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, padding: '10px 0 6px', letterSpacing: 1 }}>INFORMATIONS GÉNÉRALES</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 10 }}>
                    {[
                      ['Prénom', lead.first_name], ['Nom', lead.last_name],
                      ['Téléphone', lead.phone], ['Email', lead.email],
                      ['Adresse', lead.address], ['Ville', `${lead.city || ''}${lead.state ? ', ' + lead.state : ''}`],
                      ['Vendeur SR', lead.sr_rep_name], ['RDV prévu', lead.appointment_date],
                      ['Statut SR', lead.status_sr], ['GPS', lead.has_gps ? `${lead.lat?.toFixed(4)}, ${lead.lng?.toFixed(4)}` : '⚠ Aucun'],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ padding: '5px 0', borderBottom: '1px solid #1E3A5F15' }}>
                        <div style={{ fontSize: 10, color: '#5A8AA8' }}>{k}</div>
                        <div style={{ fontSize: 12, color: '#E2EEF8', fontWeight: 500 }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── ADDITIONAL INFO (services + prix) ── */}
                  {(lead.services_sr?.length > 0 || lead.prix > 0) && <>
                    <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, padding: '6px 0', letterSpacing: 1 }}>SERVICES DEMANDÉS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {lead.services_sr?.map(s => <span key={s} style={{ padding: '3px 8px', borderRadius: 6, background: '#22C55E22', border: '1px solid #22C55E33', fontSize: 11, color: '#22C55E' }}>✓ {s}</span>)}
                      {lead.prix > 0 && <span style={{ padding: '3px 10px', borderRadius: 6, background: '#1B9EF322', border: '1px solid #1B9EF344', fontSize: 12, fontWeight: 700, color: '#1B9EF3' }}>💰 ${lead.prix}</span>}
                    </div>
                  </>}

                  {/* ── SR FILES ── */}
                  {lead.sr_files && lead.sr_files.length > 0 && <>
                    <div style={{ fontSize: 10, color: '#5A8AA8', fontWeight: 700, padding: '6px 0', letterSpacing: 1 }}>FICHIERS SR</div>
                    {lead.sr_files.map((f: any, i: number) => (
                      <a key={i} href={f.url || f.fileUrl} target="_blank" rel="noopener noreferrer"
                         style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#132D45', border: '1px solid #1E3A5F', color: '#1B9EF3', fontSize: 12, textDecoration: 'none', marginBottom: 4 }}>
                        📄 {f.name || f.fileName || `Fichier ${i + 1}`} <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5A8AA8' }}>↗</span>
                      </a>
                    ))}
                  </>}

                  {/* ── CONTRAT ── */}
                  {isClose && <div style={{ marginBottom: 10 }}>
                    {contractLoading ? <div style={{ fontSize: 12, color: '#5A8AA8' }}>Vérification contrat...</div>
                      : contract ? (
                        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#0F2E1A', border: '1px solid #22C55E44' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#22C55E' }}>✅ Contrat signé</span>
                            <span style={{ fontSize: 10, color: '#4A6A88' }}>{contract.contract_number}</span>
                          </div>
                          {contract.signed_at && <div style={{ fontSize: 11, color: '#6B8AA8', marginTop: 3 }}>Signé le {new Date(contract.signed_at).toLocaleDateString('fr-CA')} · ${contract.prix_final}</div>}
                          {contract.client_signature_data && <img src={contract.client_signature_data} alt="Sig" style={{ marginTop: 6, maxWidth: 180, height: 44, objectFit: 'contain', background: '#F9FAFB', borderRadius: 6, padding: 4 }} />}
                        </div>
                      ) : (
                        <div style={{ padding: '7px 12px', borderRadius: 8, background: '#1E1A0A', border: '1px solid #F59E0B33', fontSize: 12, color: '#F59E0B' }}>
                          ⚠️ Pas encore de contrat dans le système{lead.sr_files?.length ? ' — vérifiez les fichiers SR ci-dessus' : ''}
                        </div>
                      )}
                  </div>}

                  {/* ── ACTIONS ── */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!lead.booking_id && !contract && (
                      <button onClick={() => book(lead)} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#1B9EF3', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', minWidth: 100 }}>+ Créer RDV</button>
                    )}
                    {!contract && (
                      <button onClick={() => sign(lead)} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#22C55E22', color: '#22C55E', fontWeight: 700, fontSize: 12, border: '1px solid #22C55E44', cursor: 'pointer', minWidth: 100 }}>📄 Signer contrat</button>
                    )}
                    {lead.has_gps && (
                      <button onClick={() => router.push(`/map?lat=${lead.lat}&lng=${lead.lng}`)} style={{ padding: '8px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, border: '1px solid #1E3A5F', cursor: 'pointer' }}>📍</button>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} style={{ padding: '8px 12px', borderRadius: 8, background: '#132D45', color: '#8BAEC8', fontSize: 12, border: '1px solid #1E3A5F', textDecoration: 'none' }}>📞</a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && leads.length === 100 && (
          <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: '#4A6A88' }}>100 premiers — utilisez la recherche pour filtrer</div>
        )}
      </div>
    </div>
  );
}
