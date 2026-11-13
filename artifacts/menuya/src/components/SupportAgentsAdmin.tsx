import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './SupportAgentsAdmin.css';

type SupportAdmin = { user_id: string; display_name: string; is_active: boolean; created_at?: string };

export default function SupportAgentsAdmin() {
  const [admins, setAdmins] = useState<SupportAdmin[]>([]);
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
      .from('clickok_support_admins')
      .select('user_id,display_name,is_active,created_at')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setAdmins((data || []) as SupportAdmin[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('support-admin-create-manager', {
      body: { displayName: name.trim(), username: username.trim(), password },
    });
    setCreating(false);
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'No fue posible crear el administrador.');
      return;
    }
    setNotice('Administrador de CLICKOK Support creado. Usuario: ' + data.username + '. Comparte la contraseña de forma segura.');
    setName('');
    setUsername('');
    setPassword('');
    await load();
  };

  const toggleAdmin = async (admin: SupportAdmin) => {
    setBusyId(admin.user_id);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase
      .from('clickok_support_admins')
      .update({ is_active: !admin.is_active })
      .eq('user_id', admin.user_id);
    if (updateError) setError(updateError.message);
    else {
      setAdmins(current => current.map(item => item.user_id === admin.user_id ? { ...item, is_active: !admin.is_active } : item));
      setNotice(admin.is_active ? 'Administrador desactivado. Ya no podrá ingresar ni gestionar asesores.' : 'Administrador activado.');
    }
    setBusyId('');
  };

  return <section className="sa-support-agents">
    <div className="sa-panel">
      <div className="sa-panel-heading">
        <div><span className="sa-kicker">CLICKOK SUPPORT</span><h2>Crear administrador de soporte</h2><p>El Súper Admin de Menuya habilita aquí al responsable del equipo. Este administrador creará y gestionará sus propios asesores.</p></div>
        <span className="sa-stat-icon violet"><ShieldCheck size={19}/></span>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      <form className="sa-support-agent-form" onSubmit={createAdmin}>
        <label className="field"><span>Nombre del administrador</span><input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Nombre completo"/></label>
        <label className="field"><span>Usuario único</span><input required minLength={3} maxLength={32} autoComplete="off" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="admin.soporte"/></label>
        <label className="field"><span>Contraseña inicial</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres"/></label>
        <button className="sa-submit" type="submit" disabled={creating || !name.trim() || !username.trim() || password.length < 10}><Plus size={16}/>{creating ? 'Creando administrador…' : 'Crear administrador'}</button>
      </form>
    </div>
    <div className="sa-panel">
      <div className="sa-panel-heading"><div><h2>Administradores registrados</h2><p>Controla quién puede administrar el equipo de CLICKOK Support.</p></div><button className="sa-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
      {loading ? <div className="sa-empty">Cargando administradores…</div> : admins.length === 0 ? <div className="sa-empty">Todavía no hay administradores creados.</div> : <div className="sa-agent-list">{admins.map(admin => <article className="sa-agent-row" key={admin.user_id}><span className="sa-agent-avatar">{(admin.display_name || 'AD').slice(0, 2).toUpperCase()}</span><span className="sa-agent-info"><b>{admin.display_name}</b><small>{admin.is_active ? 'Acceso activo' : 'Acceso desactivado'}</small></span><span className={'sa-agent-status ' + (admin.is_active ? 'is-active' : 'is-disabled')}>{admin.is_active ? 'Activo' : 'Inactivo'}</span><button className={admin.is_active ? 'sa-agent-disable' : 'sa-agent-enable'} disabled={busyId === admin.user_id} onClick={() => void toggleAdmin(admin)}>{admin.is_active ? <><UserX size={15}/> Desactivar</> : <><UserCheck size={15}/> Activar</>}</button></article>)}</div>}
    </div>
  </section>;
}
