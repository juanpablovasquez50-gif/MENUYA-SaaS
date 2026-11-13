import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Headset, LockKeyhole, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './ClickokSupport.css';

const accountEmail = (username: string) => `${username.trim().toLowerCase()}@agents.clickok.internal`;

export default function ClickokSupportLogin() {
  const [, go] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: accountEmail(username),
      password,
    });
    if (authError) {
      setError('Usuario o contraseña incorrectos. Verifica tus credenciales.');
      setBusy(false);
      return;
    }
    const { data: agent, error: agentError } = await supabase
      .from('clickok_support_agents')
      .select('user_id,is_active')
      .eq('user_id', data.user.id)
      .maybeSingle();
    const { data: admin } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (agentError || (!admin && !agent?.is_active)) {
      await supabase.auth.signOut();
      setError(agentError?.message || 'Esta cuenta no tiene acceso activo al panel de soporte.');
      setBusy(false);
      return;
    }
    go('/support');
  };

  return <main className="cks-page cks-login-page">
    <header className="cks-topbar"><a className="cks-brand" href="/"><span className="cks-mark">C</span><b>CLICKOK <span>SUPPORT</span></b></a><span className="cks-preview"><i/>Acceso seguro</span></header>
    <section className="cks-login-card">
      <span className="cks-login-icon"><Headset size={23}/></span>
      <span className="cks-kicker">PORTAL DEL EQUIPO</span>
      <h1>Iniciar sesión</h1>
      <p>Ingresa con el usuario y la contraseña asignados por el Súper Admin.</p>
      <form onSubmit={submit}>
        <label>Usuario<span className="cks-login-input"><UserRound size={17}/><input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="Tu usuario"/></span></label>
        <label>Contraseña<span className="cks-login-input"><LockKeyhole size={17}/><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></span></label>
        {error&&<div className="cks-error">{error}</div>}
        <button className="cks-primary" disabled={busy||!username.trim()||!password}>{busy?'Validando acceso…':'Entrar al panel'}</button>
      </form>
      <small className="cks-login-foot"><LockKeyhole size={13}/> Acceso privado para personal autorizado</small>
    </section>
  </main>;
}
