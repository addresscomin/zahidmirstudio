import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  }

  if (!isSupabaseConfigured) {
    return <>{children}<div className="auth-preview-note">Preview mode · Supabase is not configured. Data is not saved to a database.</div></>;
  }
  if (loading) return <div className="auth-screen"><div className="auth-card">Loading secure session…</div></div>;
  if (session) return <>{children}<button className="auth-signout" onClick={() => supabase?.auth.signOut()}>Sign out</button></>;

  return <div className="auth-screen">
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-brand"><span className="mark">B</span><span><b>BENCIA</b><small>CONTROL</small></span></div>
      <p className="eyebrow">SECURE WORKSPACE</p>
      <h1>{mode === 'signin' ? 'Welcome back.' : 'Create your workspace login.'}</h1>
      <p className="sub">Sign in to access your agent governance workspace.</p>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
        {mode === 'signin' ? 'New to Bencia Control? Create an account' : 'Already registered? Sign in'}
      </button>
      <p className="hint">Use a strong, unique password. Email confirmation may be required.</p>
    </form>
  </div>;
}
