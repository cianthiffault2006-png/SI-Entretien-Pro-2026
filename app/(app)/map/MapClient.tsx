'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PING_CONFIG, type Ping, type Territory, type Profile, type PingType } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Props { profile: Profile; initialPings: Ping[]; territories: Territory[]; userId: string; }
const TYPES: PingType[] = ['not_home','no','close','follow_up','call_back','other','never'];

export default function MapClient({ profile, initialPings, territories, userId }: Props) {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<'browse'|'ping'>('browse');
  const markers = useRef<Record<string,any>>({});
  const initDone = useRef(false); // CRITICAL: prevents double-init in StrictMode
  const [modePing, setModePing] = useState(false);
  const [pings, setPings] = useState<Ping[]>(initialPings);
  const [selType, setSelType] = useState<PingType>('not_home');
  const [pLL, setPLL] = useState<{lat:number;lng:number}|null>(null);
  const [pAddr, setPAddr] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [addrLoading, setAddrLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [filter, setFilter] = useState<PingType|'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editPing, setEditPing] = useState<Ping|null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editType, setEditType] = useState<PingType>('not_home');
  const [showEdit, setShowEdit] = useState(false);
  const sb = createClient();
  const isMgr = profile.role === 'admin' || profile.role === 'manager';

  function mode(m: 'browse'|'ping') { modeRef.current=m; setModePing(m==='ping'); if(mapRef.current) mapRef.current.getContainer().style.cursor=m==='ping'?'crosshair':''; }

  function mkIcon(t: PingType, L: any) {
    const {hex}=PING_CONFIG[t]; const chk=t==='close'?`<text x="13" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">✓</text>`:'';
    return L.divIcon({html:`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="${hex}" stroke="white" stroke-width="2.5"/>${chk}</svg>`,className:'',iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-16]});
  }
  function mkGps(L: any) { return L.divIcon({html:`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#1B9EF3" stroke="white" stroke-width="2.5" opacity=".3"/><circle cx="12" cy="12" r="6" fill="#1B9EF3" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`,className:'',iconSize:[24,24],iconAnchor:[12,12]}); }

  async function revGeo(lat: number, lng: number) {
    try { const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`); const d=await r.json(); const a=d.address||{}; return `${a.house_number?a.house_number+' ':''}${a.road||''}${(a.city||a.town||a.village)?', '+(a.city||a.town||a.village):''}`.trim()||`${lat.toFixed(4)},${lng.toFixed(4)}`; }
    catch { return `${lat.toFixed(4)},${lng.toFixed(4)}`; }
  }

  function addMarker(p: Ping, L: any, map: any) {
    markers.current[p.id]?.remove();
    const {hex,label}=PING_CONFIG[p.ping_type]; const isCl=p.ping_type==='close';
    const name=p.notes?.match(/👤 ([^|📞📅\n]+)/)?.[1]?.trim()||'';
    const phone=p.notes?.match(/📞 ([^|📅\n]+)/)?.[1]?.trim()||'';
    const appt=p.notes?.match(/📅 RDV: ([^|\n]+)/)?.[1]?.trim()||'';
    const html=`<div style="font:13px sans-serif;min-width:200px;line-height:1.5"><b style="color:#111">${p.address||'Adresse inconnue'}</b><br/><span style="color:${hex};font-weight:600;font-size:12px">● ${label}</span>${name?`<div style="color:#555;font-size:12px">👤 ${name}</div>`:''}${phone?`<div style="color:#555;font-size:12px">📞 ${phone}</div>`:''}${appt?`<div style="color:#555;font-size:12px">📅 ${appt}</div>`:''}<div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">${isCl?`<button onclick="window.__pb('${p.id}','${encodeURIComponent(p.address||'')}','${p.lat}','${p.lng}')" style="padding:6px;background:#d1fae5;border:1px solid #22C55E;border-radius:7px;color:#065f46;font-size:12px;font-weight:700;cursor:pointer">📝 Convertir en RDV</button>`:''}<div style="display:flex;gap:5px"><button onclick="window.__pe('${p.id}')" style="flex:1;padding:4px;background:#dbeafe;border:1px solid #3b82f6;border-radius:6px;color:#1e40af;font-size:11px;font-weight:600;cursor:pointer">✏️ Modifier</button>${(p.rep_id===userId||isMgr)?`<button onclick="window.__pd('${p.id}')" style="flex:1;padding:4px;background:#fee2e2;border:1px solid #ef4444;border-radius:6px;color:#991b1b;font-size:11px;font-weight:600;cursor:pointer">🗑 Suppr.</button>`:''}</div></div></div>`;
    markers.current[p.id]=L.marker([p.lat,p.lng],{icon:mkIcon(p.ping_type,L)}).bindPopup(html,{maxWidth:260}).addTo(map);
  }

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      const L=(await import('leaflet')).default;
      if (!document.querySelector('link[href*="leaflet"]')) { const lk=document.createElement('link'); lk.rel='stylesheet'; lk.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(lk); await new Promise(r=>setTimeout(r,200)); }
      if (!divRef.current) return;
      // Clear stale leaflet state (React StrictMode unmount residue)
      if ((divRef.current as any)._leaflet_id) { delete (divRef.current as any)._leaflet_id; divRef.current.innerHTML=''; }
      const map=L.map(divRef.current,{center:[46.8139,-71.2080],zoom:13,dragging:true,touchZoom:true,scrollWheelZoom:true,doubleClickZoom:true,keyboard:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19}).addTo(map);
      mapRef.current=map;
      setTimeout(()=>map.invalidateSize(true),150); setTimeout(()=>map.invalidateSize(true),600);
      if (typeof ResizeObserver!=='undefined') new ResizeObserver(()=>map.invalidateSize(true)).observe(divRef.current!);
      map.on('click',async(e:any)=>{
        if (modeRef.current!=='ping') return;
        setShowEdit(false); setPLL({lat:e.latlng.lat,lng:e.latlng.lng}); setPAddr('Recherche...'); setPNotes(''); setShowNew(true); setAddrLoading(true);
        setPAddr(await revGeo(e.latlng.lat,e.latlng.lng)); setAddrLoading(false);
      });
      initialPings.forEach(p=>addMarker(p,L,map));
      territories.forEach(t=>{ if(t.polygon_coordinates?.length>=3) L.polygon(t.polygon_coordinates.map((c:any)=>[c.lat,c.lng]),{color:'#1B9EF3',fillColor:'#1B9EF322',weight:2}).addTo(map); });
      navigator.geolocation?.getCurrentPosition(pos=>{
        map.setView([pos.coords.latitude,pos.coords.longitude],15);
        L.marker([pos.coords.latitude,pos.coords.longitude],{icon:mkGps(L),zIndexOffset:1000}).addTo(map);
        L.circle([pos.coords.latitude,pos.coords.longitude],{radius:15,color:'#1B9EF3',fillColor:'#1B9EF3',fillOpacity:0.15,weight:1}).addTo(map);
      },()=>{},{enableHighAccuracy:true,timeout:8000});
    })();
    return ()=>{ mapRef.current?.remove(); mapRef.current=null; initDone.current=false; };
  },[]);

  useEffect(()=>{
    (window as any).__pb=(id:string,addr:string,lat:string,lng:string)=>{mapRef.current?.closePopup();router.push(`/book?from_ping=${id}&addr=${addr}&lat=${lat}&lng=${lng}`);};
    (window as any).__pe=(id:string)=>{const p=pings.find(x=>x.id===id);if(!p)return;setEditPing(p);setEditType(p.ping_type);setEditNotes(p.notes||'');setShowEdit(true);setShowNew(false);mapRef.current?.closePopup();};
    (window as any).__pd=async(id:string)=>{if(!confirm('Supprimer ce ping?'))return;await sb.from('pings').delete().eq('id',id);markers.current[id]?.remove();delete markers.current[id];setPings(prev=>prev.filter(p=>p.id!==id));mapRef.current?.closePopup();};
  },[pings,userId,isMgr]);

  useEffect(()=>{
    let ch:RealtimeChannel;
    (async()=>{const L=(await import('leaflet')).default;ch=sb.channel(`pr-${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'pings'},p=>{if(p.eventType==='INSERT'||p.eventType==='UPDATE'){setPings(prev=>[p.new as Ping,...prev.filter(x=>x.id!==p.new.id)]);if(mapRef.current)addMarker(p.new as Ping,L,mapRef.current);}else if(p.eventType==='DELETE'){setPings(prev=>prev.filter(x=>x.id!==p.old.id));markers.current[p.old.id]?.remove();delete markers.current[p.old.id];}}).subscribe();})();
    return ()=>{ch?.unsubscribe();};
  },[]);

  useEffect(()=>{(async()=>{const L=(await import('leaflet')).default;if(!mapRef.current)return;pings.forEach(p=>{const m=markers.current[p.id];if(!m){addMarker(p,L,mapRef.current);return;}(filter==='all'||p.ping_type===filter)?m.addTo(mapRef.current):m.remove();});})();},[filter,pings]);

  async function saveNew(){if(!pLL)return;setSaving(true);await sb.from('pings').insert({lat:pLL.lat,lng:pLL.lng,address:addrLoading?null:pAddr,ping_type:selType,notes:pNotes||null,rep_id:userId});setPLL(null);setPNotes('');setShowNew(false);setSaving(false);mode('browse');}
  async function saveEdit(){if(!editPing)return;setSaving(true);await sb.from('pings').update({ping_type:editType,notes:editNotes||null}).eq('id',editPing.id);setShowEdit(false);setEditPing(null);setSaving(false);}

  const cnts=TYPES.reduce((a,t)=>{a[t]=pings.filter(p=>p.ping_type===t).length;return a;},{} as Record<string,number>);
  const PS: React.CSSProperties={position:'absolute',bottom:0,left:0,right:0,background:'#0A1628',borderTop:'1px solid #1E3A5F',borderRadius:'16px 16px 0 0',padding:16,zIndex:30,boxShadow:'0 -4px 32px rgba(0,0,0,.6)'};

  return (
    <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column',minHeight:0,height:'100%'}}>
      {/* Toolbar */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#0A1628',borderBottom:'1px solid #1E3A5F',flexWrap:'wrap',zIndex:20}}>
        <div style={{display:'flex',borderRadius:10,overflow:'hidden',border:'1px solid #1E3A5F'}}>
          <button onClick={()=>{mode('browse');setShowNew(false);}} style={{padding:'6px 12px',fontSize:12,fontWeight:700,background:!modePing?'#1B9EF3':'#132D45',color:!modePing?'white':'#6B8AA8',border:'none',cursor:'pointer'}}>🖐 Naviguer</button>
          <button onClick={()=>mode('ping')} style={{padding:'6px 12px',fontSize:12,fontWeight:700,background:modePing?'#22C55E':'#132D45',color:modePing?'white':'#6B8AA8',border:'none',cursor:'pointer'}}>📍 Pinger</button>
        </div>
        <button onClick={async()=>{setGpsLoading(true);navigator.geolocation.getCurrentPosition(async pos=>{const L=(await import('leaflet')).default;mapRef.current?.flyTo([pos.coords.latitude,pos.coords.longitude],17);L.marker([pos.coords.latitude,pos.coords.longitude],{icon:mkGps(L),zIndexOffset:1000}).addTo(mapRef.current);setGpsLoading(false);},()=>setGpsLoading(false),{enableHighAccuracy:true,timeout:10000});}} disabled={gpsLoading} style={{padding:'6px 10px',borderRadius:8,fontSize:12,fontWeight:700,background:'#1B9EF322',color:'#1B9EF3',border:'1px solid #1B9EF355',cursor:'pointer'}}>{gpsLoading?'⌛':'◎'} GPS</button>
        {modePing&&TYPES.map(t=><button key={t} onClick={()=>setSelType(t)} title={PING_CONFIG[t].label} style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${selType===t?'white':'transparent'}`,background:PING_CONFIG[t].hex,cursor:'pointer',flexShrink:0,transform:selType===t?'scale(1.25)':'scale(1)'}}/>)}
        <div style={{flex:1}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} style={{fontSize:12,padding:'5px 8px',borderRadius:8,background:'#132D45',border:'1px solid #1E3A5F',color:'#8BAEC8'}}>
          <option value="all">Tous ({pings.length})</option>
          {TYPES.map(t=><option key={t} value={t}>{PING_CONFIG[t].label} ({cnts[t]})</option>)}
        </select>
      </div>
      {modePing&&<div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 16px',background:'#22C55E22',color:'#22C55E',borderBottom:'1px solid #22C55E33',fontSize:12,fontWeight:600}}>
        <span>Mode ping actif — cliquez sur la carte</span><button onClick={()=>mode('browse')} style={{background:'none',border:'none',color:'#22C55E',cursor:'pointer',fontWeight:700,fontSize:16}}>✕</button>
      </div>}
      <div ref={divRef} style={{flex:1,minHeight:0}}/>
      {/* Legend */}
      <div style={{position:'absolute',bottom:20,left:12,zIndex:10,pointerEvents:'none',background:'rgba(10,22,40,.88)',backdropFilter:'blur(8px)',borderRadius:12,padding:'8px 10px',border:'1px solid #1E3A5F',fontSize:12}}>
        {TYPES.map(t=><div key={t} style={{display:'flex',alignItems:'center',gap:6,padding:'2px 0'}}><div style={{width:10,height:10,borderRadius:'50%',background:PING_CONFIG[t].hex}}/><span style={{color:'#8BAEC8'}}>{PING_CONFIG[t].label}</span><span style={{marginLeft:'auto',paddingLeft:8,color:'#4A6A88'}}>{cnts[t]}</span></div>)}
      </div>
      {/* New ping panel */}
      {showNew&&pLL&&<div style={PS}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><span style={{fontWeight:700,fontSize:14,color:'white'}}>Nouveau ping</span><button onClick={()=>setShowNew(false)} style={{background:'none',border:'none',color:'#6B8AA8',fontSize:22,cursor:'pointer'}}>×</button></div>
        <div style={{fontSize:12,padding:'6px 10px',background:'#132D45',borderRadius:8,color:'#8BAEC8',marginBottom:12}}>📍 {addrLoading?'...':pAddr}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
          {TYPES.map(t=><button key={t} onClick={()=>setSelType(t)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 4px',borderRadius:10,border:`1px solid ${selType===t?PING_CONFIG[t].hex:'#1E3A5F'}`,background:selType===t?PING_CONFIG[t].hex+'22':'#132D45',color:selType===t?PING_CONFIG[t].hex:'#6B8AA8',fontSize:11,cursor:'pointer'}}><div style={{width:14,height:14,borderRadius:'50%',background:PING_CONFIG[t].hex}}/>{PING_CONFIG[t].label}</button>)}
        </div>
        <input value={pNotes} onChange={e=>setPNotes(e.target.value)} placeholder="Notes..." style={{width:'100%',padding:'8px 12px',borderRadius:10,border:'1px solid #1E3A5F',background:'#132D45',color:'white',fontSize:13,boxSizing:'border-box',marginBottom:10}}/>
        {selType==='close'&&<button onClick={async()=>{setSaving(true);const{data:np}=await sb.from('pings').insert({lat:pLL.lat,lng:pLL.lng,address:addrLoading?null:pAddr,ping_type:'close',notes:pNotes||null,rep_id:userId}).select().single();setSaving(false);setShowNew(false);mode('browse');router.push(`/book?from_ping=${np?.id||''}&addr=${encodeURIComponent(pAddr)}&lat=${pLL.lat}&lng=${pLL.lng}`);}} style={{width:'100%',padding:10,borderRadius:10,background:'#22C55E',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',marginBottom:8}}>✓ Close + Créer RDV</button>}
        <button onClick={saveNew} disabled={saving} style={{width:'100%',padding:8,borderRadius:10,background:'#132D45',color:'#8BAEC8',fontSize:13,border:'1px solid #1E3A5F',cursor:'pointer'}}>{saving?'...': `Sauvegarder — ${PING_CONFIG[selType].label}`}</button>
      </div>}
      {/* Edit panel */}
      {showEdit&&editPing&&<div style={PS}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><span style={{fontWeight:700,fontSize:14,color:'white'}}>Modifier ping</span><button onClick={()=>setShowEdit(false)} style={{background:'none',border:'none',color:'#6B8AA8',fontSize:22,cursor:'pointer'}}>×</button></div>
        <div style={{fontSize:12,padding:'6px 10px',background:'#132D45',borderRadius:8,color:'#8BAEC8',marginBottom:12}}>📍 {editPing.address||`${editPing.lat.toFixed(4)},${editPing.lng.toFixed(4)}`}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
          {TYPES.map(t=><button key={t} onClick={()=>setEditType(t)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 4px',borderRadius:10,border:`1px solid ${editType===t?PING_CONFIG[t].hex:'#1E3A5F'}`,background:editType===t?PING_CONFIG[t].hex+'22':'#132D45',color:editType===t?PING_CONFIG[t].hex:'#6B8AA8',fontSize:11,cursor:'pointer'}}><div style={{width:14,height:14,borderRadius:'50%',background:PING_CONFIG[t].hex}}/>{PING_CONFIG[t].label}</button>)}
        </div>
        <input value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder="Notes..." style={{width:'100%',padding:'8px 12px',borderRadius:10,border:'1px solid #1E3A5F',background:'#132D45',color:'white',fontSize:13,boxSizing:'border-box',marginBottom:10}}/>
        {editType==='close'&&<button onClick={()=>router.push(`/book?from_ping=${editPing.id}&addr=${encodeURIComponent(editPing.address||'')}&lat=${editPing.lat}&lng=${editPing.lng}`)} style={{width:'100%',padding:8,borderRadius:10,background:'#22C55E',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',marginBottom:8}}>📝 Créer RDV</button>}
        <button onClick={saveEdit} disabled={saving} style={{width:'100%',padding:8,borderRadius:10,background:'#1B9EF3',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>{saving?'...':'Enregistrer'}</button>
      </div>}
    </div>
  );
}
