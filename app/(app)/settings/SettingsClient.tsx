'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function SettingsClient({ profile, userId }: { profile: Profile; userId: string }) {
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    // Capture Android/Chrome install prompt
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function saveProfile() {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', userId);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    if (!newPass || newPass.length < 6) { setPassMsg('Minimum 6 caractères'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setPassMsg('Erreur: ' + error.message); }
    else { setPassMsg('Mot de passe changé!'); setNewPass(''); }
  }

  async function installPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-6">Paramètres</h1>

      {/* Install PWA */}
      <div className="rounded-2xl p-4 border mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>
          📱 Installer l'application
        </div>
        {isInstalled ? (
          <div className="text-sm text-center py-3" style={{ color: '#22C55E' }}>
            ✓ Application déjà installée sur cet appareil
          </div>
        ) : isIOS ? (
          <div>
            <p className="text-sm mb-3" style={{ color: '#8BAEC8' }}>
              Pour ajouter à l'écran d'accueil sur iPhone/iPad:
            </p>
            <ol className="text-sm space-y-2" style={{ color: '#6B8AA8' }}>
              <li>1. Tap the <strong style={{ color: '#1B9EF3' }}>Share</strong> button (⬆️) in Safari</li>
              <li>2. Scroll down and tap <strong style={{ color: '#1B9EF3' }}>Add to Home Screen</strong></li>
              <li>3. Tap <strong style={{ color: '#1B9EF3' }}>Add</strong> — done!</li>
            </ol>
            <div className="mt-3 px-3 py-2 rounded-xl text-xs text-center" style={{ background: '#132D45', color: '#5A8AA8' }}>
              Fonctionne sur iPhone, iPad, et Android Chrome
            </div>
          </div>
        ) : deferredPrompt ? (
          <div>
            <p className="text-sm mb-3" style={{ color: '#8BAEC8' }}>
              Installez l'app directement sur votre écran d'accueil pour une expérience native.
            </p>
            <button onClick={installPWA}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm"
                    style={{ background: '#1B9EF3' }}>
              📲 Installer SI Entretien Pro
            </button>
          </div>
        ) : (
          <div className="text-sm" style={{ color: '#6B8AA8' }}>
            <p className="mb-2">Pour installer sur votre appareil:</p>
            <p>• <strong style={{ color: '#8BAEC8' }}>Android Chrome</strong>: Menu ⋮ → "Ajouter à l'écran d'accueil"</p>
            <p>• <strong style={{ color: '#8BAEC8' }}>iPhone Safari</strong>: ⬆️ → "Sur l'écran d'accueil"</p>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="rounded-2xl p-4 border mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Profil</div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Nom complet</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="418-555-0123" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Email</label>
            <input type="email" value={profile.email} disabled style={{ opacity: 0.5 }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6B8AA8' }}>Rôle</label>
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: '#132D45', color: '#6B8AA8' }}>
              {profile.role}
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: saving ? '#0E7ACC' : '#1B9EF3' }}>
            {saved ? '✓ Sauvegardé!' : saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-2xl p-4 border mb-4" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#6B8AA8' }}>Mot de passe</div>
        <div className="space-y-3">
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                 placeholder="Nouveau mot de passe (min. 6 caractères)" />
          {passMsg && (
            <div className="text-xs px-2 py-1.5 rounded-lg"
                 style={{ color: passMsg.includes('changé') ? '#22C55E' : '#EF4444', background: passMsg.includes('changé') ? '#0F2E1A' : '#2A0F0F' }}>
              {passMsg}
            </div>
          )}
          <button onClick={changePassword}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: '#A78BFA' }}>
            Changer le mot de passe
          </button>
        </div>
      </div>
    </div>
  );
}
