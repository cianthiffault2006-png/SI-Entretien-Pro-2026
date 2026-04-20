'use client';
import { useState } from 'react';
import type { Profile } from '@/lib/types';
type Role = Profile['role'];

const ROLES: { value: Role; label: string; color: string }[] = [
  { value: 'admin',   label: 'Admin',   color: '#EF4444' },
  { value: 'manager', label: 'Manager', color: '#1B9EF3' },
  { value: 'rep',     label: 'Vendeur', color: '#22C55E' },
  { value: 'cleaner', label: 'Tech',    color: '#F97316' },
];

export default function AdminUsersClient({ currentUser, profiles }: { currentUser: Profile; profiles: Profile[] }) {
  const [users, setUsers] = useState<Profile[]>(profiles);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('rep');
  const [newTeam, setNewTeam] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');

  async function addUser() {
    if (!newName || !newEmail) { setErr('Nom et email requis.'); return; }
    setAdding(true); setErr('');
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: newName, email: newEmail, role: newRole, team: newTeam || null }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Erreur'); setAdding(false); return; }
    setUsers(prev => [...prev, data.profile].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setNewName(''); setNewEmail(''); setNewRole('rep'); setNewTeam('');
    setShowAdd(false); setAdding(false);
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    });
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u));
  }

  async function changeRole(id: string, role: Role) {
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    });
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  }

  async function resetPassword(id: string, email: string) {
    if (!confirm(`Réinitialiser le mot de passe de ${email}? Il sera remis à si123.`)) return;
    await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Équipe ({users.length})</h1>
        <button onClick={() => setShowAdd(!showAdd)}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm"
                style={{ background: '#1B9EF3' }}>
          + Ajouter
        </button>
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="rounded-2xl p-4 border mb-5" style={{ background: '#0F1E35', borderColor: '#1B9EF344' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1B9EF3' }}>Nouvel employé</div>
          {err && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>{err}</div>}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Nom complet *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jean Tremblay" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Email *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jean@exemple.com" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Rôle</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Équipe</label>
              <input value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="ex. Équipe A" />
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: '#3A6B8A' }}>Mot de passe initial: <strong style={{ color: '#1B9EF3' }}>si123</strong></p>
          <div className="flex gap-2">
            <button onClick={addUser} disabled={adding}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm"
                    style={{ background: adding ? '#0E7ACC' : '#1B9EF3' }}>
              {adding ? 'Création...' : 'Créer le compte'}
            </button>
            <button onClick={() => setShowAdd(false)}
                    className="px-4 py-2.5 rounded-xl text-sm border"
                    style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Role filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([{ value: 'all', label: `Tous (${users.length})`, color: '#6B8AA8' }, ...ROLES.map(r => ({ ...r, label: `${r.label} (${users.filter(u => u.role === r.value).length})` }))]).map(r => (
          <button key={r.value} onClick={() => setFilterRole(r.value as any)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: filterRole === r.value ? r.color + '22' : 'transparent',
                    borderColor: filterRole === r.value ? r.color : '#1E3A5F',
                    color: filterRole === r.value ? r.color : '#6B8AA8',
                  }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map(u => {
          const roleInfo = ROLES.find(r => r.value === u.role);
          return (
            <div key={u.id} className="rounded-2xl p-4 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F', opacity: u.is_active ? 1 : 0.5 }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                       style={{ background: roleInfo?.color + '22', color: roleInfo?.color }}>
                    {u.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">{u.full_name}</div>
                    <div className="text-xs" style={{ color: '#6B8AA8' }}>{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={u.role} onChange={e => changeRole(u.id, e.target.value as Role)}
                          disabled={u.id === currentUser.id}
                          className="text-xs py-1 px-2 rounded-lg"
                          style={{ background: '#132D45', border: '1px solid #1E3A5F', color: roleInfo?.color, width: 'auto' }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button onClick={() => resetPassword(u.id, u.email)}
                          className="text-xs px-2 py-1 rounded-lg border"
                          style={{ borderColor: '#1E3A5F', color: '#6B8AA8' }}>
                    Reset mdp
                  </button>
                  {u.id !== currentUser.id && (
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                            className="text-xs px-2 py-1 rounded-lg border"
                            style={{ borderColor: u.is_active ? '#3F1515' : '#0F3A2A', color: u.is_active ? '#EF4444' : '#22C55E' }}>
                      {u.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
