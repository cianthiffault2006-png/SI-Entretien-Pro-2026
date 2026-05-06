'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: '#1B9EF3' }}>
            <span className="text-white text-2xl font-black">SI</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SI Entretien Pro</h1>
          <p className="text-sm mt-1" style={{ color: '#6B8AA8' }}>Connectez-vous pour continuer</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border" style={{ background: '#0F1E35', borderColor: '#1E3A5F' }}>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg px-3 py-2 text-sm text-center"
                   style={{ background: '#2A0F0F', color: '#EF4444', border: '1px solid #3F1515' }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1"
                     style={{ color: '#6B8AA8' }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1"
                     style={{ color: '#6B8AA8' }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                required
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin(e as any)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white transition-all"
              style={{ background: loading ? '#0E7ACC' : '#1B9EF3', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#3A5F80' }}>
          Mot de passe oublié? Contactez un administrateur.
        </p>
      </div>
    </div>
  );
}
