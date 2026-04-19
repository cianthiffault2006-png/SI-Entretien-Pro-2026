'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface Props {
  userId: string;
  currentSession: { id: string; clocked_in: string; clocked_out: string | null } | null;
}

export default function ClockWidget({ userId, currentSession }: Props) {
  const supabase = createClient();
  const [session, setSession] = useState(currentSession);
  const [elapsed, setElapsed] = useState('');
  const [loading, setLoading] = useState(false);

  // Live elapsed timer
  useEffect(() => {
    if (!session || session.clocked_out) { setElapsed(''); return; }
    function update() {
      const ms = Date.now() - new Date(session!.clocked_in).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(`${h}h${m.toString().padStart(2, '0')}`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [session]);

  const isClockedIn = session && !session.clocked_out;

  async function clockIn() {
    setLoading(true);
    const { data } = await supabase.from('timeclock').insert({
      rep_id: userId, clocked_in: new Date().toISOString(), auto_in: false,
    }).select().single();
    setSession(data);
    setLoading(false);
  }

  async function clockOut() {
    if (!session) return;
    setLoading(true);
    const now = new Date().toISOString();
    await supabase.from('timeclock').update({ clocked_out: now, auto_out: false }).eq('id', session.id);
    setSession({ ...session, clocked_out: now });
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1px solid ${isClockedIn ? '#22C55E44' : '#1E3A5F'}`, background: isClockedIn ? '#0F2E1A' : '#0F1E35' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isClockedIn ? '#22C55E' : '#6B8AA8' }}>
          {isClockedIn ? `🟢 Pointé — ${elapsed}` : '⚫ Non pointé'}
        </div>
        {isClockedIn && (
          <div style={{ fontSize: 10, color: '#4A6A88', marginTop: 1 }}>
            Depuis {new Date(session!.clocked_in).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      <button
        onClick={isClockedIn ? clockOut : clockIn}
        disabled={loading}
        style={{
          padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, border: 'none', cursor: loading ? 'default' : 'pointer',
          background: isClockedIn ? '#EF4444' : '#22C55E',
          color: 'white', opacity: loading ? 0.7 : 1,
        }}>
        {loading ? '...' : isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
    </div>
  );
}
