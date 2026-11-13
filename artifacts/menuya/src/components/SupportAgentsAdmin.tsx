import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, ShieldCheck, UserCheck, UserX, Headset } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './SupportAgentsAdmin.css';

type SupportAdmin = { user_id: string; display_name: string; is_active: boolean; created_at?: string };
type SupportAgent = { user_id: string; display_name: string | null; is_active: boolean; created_at?: string };

export default function SupportAgentsAdmin() {
  const [admins, setAdmins] = useState<SupportAdmin[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentUsername, setAgentUsername] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [a, g] = await Promise.all([
      supabase.from('clickok_support_admins').select('user_id,display_name,is_active,created_at').order('created_at', { ascending: false }),
      supabase.from('clickok_support_agents').select('user_id,display_name,is_active,created_at').order('created_at', { ascending: false }),
    ]);
    if (a.error || g.error) setError((a.error || g.error)!.message);
    else { setAdmins((a.data || []) as SupportAdmin[]); setAgents((g.data || []) as SupportAgent[]); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setCreating(true); setError(''); setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('support-admin-create-manager', { body: { displayName: name.trim(), username: username.trim(), password } });
    setCreating(false);
    if (invokeError || data?.error) { setError(data?.error || invokeError?.message || 'No fue posible crear el administrador.'); return; }
    setNotice('Administrador de soporte creado. Usuario: ' + data.username + '. Comparte la contraseña de forma segura.');
    setName(''); setUsername(''); setPassword(''); await load();
  };

  const createAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setCreatingAgent(true); setError(''); setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('support-admin-create-agent', { body: { displayName: agentName.trim(), username: agentUsername.trim(), password: agentPassword } });
    setCreatingAgent(false);
    if (invokeError || data?.error) { setError(data?.error || invokeError?.message || 'No fue posible crear el asesor.'); return; }
    setNotice('Asesor de tercer nivel creado. Usuario: ' + data.username + '. Entrega la contraseña inicial de forma segura.');
    setAgentName(''); setAgentUsername(''); setAgentPassword(''); await load();
  };

  const toggleAdmin = async (admin: SupportAdmin) => {
    setBusyId(admin.user_id); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('clickok_support_admins').update({ is_active: !admin.is_active }).eq('user_id', admin.user_id);
    if (updateError) setError(updateError.message);
    else { setAdmins(current => current.map(item => item.user_id === admin.user_id ? { ...item, is_active: !admin.is_active } : item)); setNotice(admin.is_active ? 'Administrador desactivado.' : 'Administrador activado.'); }
    setBusyId('');
  };

  const toggleAgent = async (agent: SupportAgent) => {
    setBusyId(agent.user_id); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('clickok_support_agents').update({ is_active: !agent.is_active }).eq('user_id', agent.user_id);
    if (updateError) setError(updateError.message);
    else { setAgents(current => current.map(item => item.user_id === agent.user_id ? { ...item, is_active: !agent.is_active } : item)); setNotice(agent.is_active ? 'Acceso del asesor desactivado.' : 'Acceso del asesor activado.'); }
    setBusyId('');
  };

  return <section className="sa-support-agents">
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    <div className="sa-panel">
      <div className="sa-panel-heading">
        <div><span className="sa-kicker">NIVEL 2 · CLICKOK SUPPORT</span><h2>Administradores de soporte</h2><p>El Súper Admin crea y controla a los responsables que supervisan la operación.</p></div>
        <span className="sa-stat-icon violet"><ShieldCheck size={19}/></span>
      </div>
      <form className="sa-support-agent-form" onSubmit={createAdmin}>
        <label className="field"><span>Nombre del administrador</span><input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo"/></label>
        <label className="field"><span>Usuario único</span><input required minLength={3} maxLength={32} autoComplete="off" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="admin.soporte"/></label>
        <label className="field"><span>Contraseña inicial</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/></label>
        <button className="sa-submit" type="submit" disabled={creating || !name.trim() || !username.trim() || password.length < 10}><Plus size={16}/>{creating ? 'Creando…' : 'Crear administrador'}</button>
      </form>
      <div className="sa-panel-heading"><div><h2>Administradores registrados</h2><p>Control de acceso al panel de supervisión.</p></div><button className="sa-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
      {loading ? <div className="sa-empty">Cargando…</div> : admins.length === 0 ? <div className="sa-empty">Todavía no hay administradores creados.</div> : <div className="sa-agent-list">{admins.map(a => <article className="sa-agent-row" key={a.user_id}><span className="sa-agent-avatar">{(a.display_name || 'AD').slice(0,2).toUpperCase()}</span><span className="sa-agent-info"><b>{a.display_name}</b><small>{a.is_active ? 'Acceso activo' : 'Acceso desactivado'}</small></span><span className={'sa-agent-status ' + (a.is_active ? 'is-active' : 'is-disabled')}>{a.is_active ? 'Activo' : 'Inactivo'}</span><button className={a.is_active ? 'sa-agent-disable' : 'sa-agent-enable'} disabled={busyId === a.user_id} onClick={() => void toggleAdmin(a)}>{a.is_active ? <><UserX size={15}/> Desactivar</> : <><UserCheck size={15}/> Activar</>}</button></article>)}</div>}
    </div>
    <div className="sa-panel">
      <div className="sa-panel-heading"><div><span className="sa-kicker">NIVEL 3 · ACCESO DIRECTO</span><h2>Crear asesores de soporte</h2><p>Desde este mismo panel puedes asignar usuario y contraseña a cada asesor, sin tener que crear primero un administrador de nivel 2.</p></div><span className="sa-stat-icon violet"><Headset size={19}/></span></div>
      <form className="sa-support-agent-form" onSubmit={createAgent}>
        <label className="field"><span>Nombre del asesor</span><input required minLength={2} maxLength={80} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Nombre completo"/></label>
        <label className="field"><span>Usuario único</span><input required minLength={3} maxLength={32} autoComplete="off" value={agentUsername} onChange={e => setAgentUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="asesor.nombre"/></label>
        <label className="field"><span>Contraseña inicial</span><input required minLength={10} type="password" autoComplete="new-password" value={agentPassword} onChange={e => setAgentPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/></label>
        <button className="sa-submit" type="submit" disabled={creatingAgent || !agentName.trim() || !agentUsername.trim() || agentPassword.length < 10}>{creatingAgent ? 'Creando asesor…' : <><Plus size={16}/> Crear asesor de nivel 3</>}</button>
      </form>
      <div className="sa-panel-heading"><div><h2>Asesores registrados</h2><p>Activa o desactiva el acceso individual de cada asesor.</p></div><span className="sa-total">{agents.length} asesores</span></div>
      {loading ? <div className="sa-empty">Cargando asesores…</div> : agents.length === 0 ? <div className="sa-empty">Todavía no hay asesores registrados.</div> : <div className="sa-agent-list">{agents.map(a => <article className="sa-agent-row" key={a.user_id}><span className="sa-agent-avatar">{(a.display_name || 'AS').slice(0,2).toUpperCase()}</span><span className="sa-agent-info"><b>{a.display_name || 'Asesor'}</b><small>{a.is_active ? 'Acceso activo' : 'Acceso desactivado'}</small></span><span className={'sa-agent-status ' + (a.is_active ? 'is-active' : 'is-disabled')}>{a.is_active ? 'Activo' : 'Inactivo'}</span><button className={a.is_active ? 'sa-agent-disable' : 'sa-agent-enable'} disabled={busyId === a.user_id} onClick={() => void toggleAgent(a)}>{a.is_active ? <><UserX size={15}/> Desactivar</> : <><UserCheck size={15}/> Activar</>}</button></article>)}</div>}
    </div>
  </section>;
}
