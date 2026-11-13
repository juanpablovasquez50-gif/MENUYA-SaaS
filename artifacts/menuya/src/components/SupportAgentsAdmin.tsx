import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './SupportAgentsAdmin.css';

type Agent = { user_id: string; display_name: string | null; is_active: boolean; created_at?: string };

export default function SupportAgentsAdmin() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('clickok_support_agents')
      .select('user_id,display_name,is_active,created_at')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setAgents((data || []) as Agent[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('support-admin-create-agent', {
      body: { displayName: name.trim(), username: username.trim(), password },
    });
    setCreating(false);
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'No fue posible crear el asesor.');
      return;
    }
    setNotice('Asesor creado. Usuario: ' + data.username + '. Comparte con él la contraseña asignada.');
    setName('');
    setUsername('');
    setPassword('');
    await load();
  };

  const toggleAgent = async (agent: Agent) => {
    setBusyId(agent.user_id);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase
      .from('clickok_support_agents')
      .update({ is_active: !agent.is_active })
      .eq('user_id', agent.user_id);
    if (updateError) setError(updateError.message);
    else {
      setAgents(current => current.map(item => item.user_id === agent.user_id ? { ...item, is_active: !agent.is_active } : item));
      setNotice(agent.is_active ? 'Asesor desactivado. Ya no podrá ingresar.' : 'Asesor activado. Ya puede ingresar.');
    }
    setBusyId('');
  };

  return <section className="sa-support-agents">
    <div className="sa-panel">
      <div className="sa-panel-heading">
        <div><span className="sa-kicker">CLICKOK SUPPORT</span><h2>Crear asesor</h2><p>Asigna un usuario y una contraseña únicos. El asesor ingresará desde su propio acceso.</p></div>
        <span className="sa-stat-icon violet"><ShieldCheck size={19}/></span>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      <form className="sa-support-agent-form" onSubmit={createAgent}>
        <label className="field"><span>Nombre del asesor</span><input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Nombre completo"/></label>
        <label className="field"><span>Usuario único</span><input required minLength={3} maxLength={32} autoComplete="off" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="asesor.monteria"/></label>
        <label className="field"><span>Contraseña inicial</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres"/></label>
        <button className="sa-submit" type="submit" disabled={creating || !name.trim() || !username.trim() || password.length < 10}><Plus size={16}/>{creating ? 'Creando asesor…' : 'Crear asesor'}</button>
      </form>
    </div>
    <div className="sa-panel">
      <div className="sa-panel-heading"><div><h2>Asesores registrados</h2><p>Administra los accesos individuales del equipo de soporte.</p></div><button className="sa-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
      {loading ? <div className="sa-empty">Cargando asesores…</div> : agents.length === 0 ? <div className="sa-empty">Todavía no hay asesores creados.</div> : <div className="sa-agent-list">{agents.map(agent => <article className="sa-agent-row" key={agent.user_id}><span className="sa-agent-avatar">{(agent.display_name || 'AS').slice(0, 2).toUpperCase()}</span><span className="sa-agent-info"><b>{agent.display_name || 'Asesor'}</b><small>{agent.is_active ? 'Acceso activo' : 'Acceso desactivado'}</small></span><span className={'sa-agent-status ' + (agent.is_active ? 'is-active' : 'is-disabled')}>{agent.is_active ? 'Activo' : 'Inactivo'}</span><button className={agent.is_active ? 'sa-agent-disable' : 'sa-agent-enable'} disabled={busyId === agent.user_id} onClick={() => void toggleAgent(agent)}>{agent.is_active ? <><UserX size={15}/> Desactivar</> : <><UserCheck size={15}/> Activar</>}</button></article>)}</div>}
    </div>
  </section>;
}
