import { useCallback, useEffect, useState } from 'react';
import { Plus, Users, Utensils, RefreshCw, UserPlus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './restaurant-operations.css';

type DiningTable = { id:string; name:string; capacity:number; status:string };
type Waiter = { id:string; user_id:string; role:string; status:string; created_at:string };

export default function RestaurantOperations({businessId}:{businessId:string}) {
  const [tab,setTab]=useState<'tables'|'waiters'>('tables');
  const [tables,setTables]=useState<DiningTable[]>([]);
  const [waiters,setWaiters]=useState<Waiter[]>([]);
  const [name,setName]=useState('');
  const [capacity,setCapacity]=useState('4');
  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    const [t,m]=await Promise.all([
      supabase.from('restaurant_tables').select('id,name,capacity,status').eq('business_id',businessId).order('name'),
      supabase.from('business_memberships').select('id,user_id,role,status,created_at').eq('business_id',businessId).eq('role','waiter').order('created_at',{ascending:false})
    ]);
    if(t.error||m.error)setError((t.error||m.error)?.message||'No se pudo cargar la operación.');
    setTables((t.data||[]) as DiningTable[]);
    setWaiters((m.data||[]) as Waiter[]);
    setLoading(false);
  },[businessId]);
  useEffect(()=>{void refresh();},[refresh]);

  const addTable=async(e:React.FormEvent)=>{
    e.preventDefault();if(!name.trim())return;
    setBusy(true);setError('');setNotice('');
    const {error}=await supabase.from('restaurant_tables').insert({business_id:businessId,name:name.trim(),capacity:Math.max(1,Math.min(50,Number(capacity)||4))});
    if(error)setError(error.message);else{setName('');setCapacity('4');setNotice('Mesa creada correctamente.');await refresh();}
    setBusy(false);
  };
  const toggleTable=async(table:DiningTable)=>{
    const status=table.status==='inactive'?'available':'inactive';
    const {error}=await supabase.from('restaurant_tables').update({status,updated_at:new Date().toISOString()}).eq('id',table.id).eq('business_id',businessId);
    if(error)setError(error.message);else await refresh();
  };
  const inviteWaiter=async(e:React.FormEvent)=>{
    e.preventDefault();if(!email.trim())return;
    setBusy(true);setError('');setNotice('');
    const {data,error}=await supabase.functions.invoke('invite-restaurant-waiter',{body:{business_id:businessId,email:email.trim().toLowerCase()}});
    if(error)setError(error.message);else if(data?.error)setError(data.error);else{setEmail('');setNotice('Invitación enviada. El mesero debe aceptar el correo para activar su acceso.');await refresh();}
    setBusy(false);
  };

  return <section className="restaurant-ops">
    <header className="restaurant-ops-head"><div><span className="eyebrow">OPERACIÓN DEL RESTAURANTE</span><h1>Mesas y meseros</h1><p>Organiza el salón y administra los accesos del equipo de servicio.</p></div><button className="restaurant-refresh" onClick={()=>void refresh()} aria-label="Actualizar"><RefreshCw size={16}/></button></header>
    <nav className="restaurant-ops-tabs"><button className={tab==='tables'?'active':''} onClick={()=>setTab('tables')}><Utensils size={16}/> Mesas <span>{tables.length}</span></button><button className={tab==='waiters'?'active':''} onClick={()=>setTab('waiters')}><Users size={16}/> Meseros <span>{waiters.length}</span></button></nav>
    {notice&&<div className="restaurant-ops-notice"><CheckCircle2 size={16}/>{notice}</div>}
    {error&&<div className="restaurant-ops-error"><AlertCircle size={16}/>{error}</div>}
    {tab==='tables'?<div className="restaurant-ops-grid">
      <section className="restaurant-ops-panel"><h2>Registrar una mesa</h2><p>Agrega las mesas disponibles en tu restaurante.</p><form onSubmit={addTable}><label>Nombre o número<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Mesa 1" required maxLength={40}/></label><label>Capacidad<select value={capacity} onChange={e=>setCapacity(e.target.value)}>{[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} personas</option>)}</select></label><button className="restaurant-primary" disabled={busy}><Plus size={16}/> Crear mesa</button></form></section>
      <section className="restaurant-ops-panel"><div className="restaurant-ops-panel-head"><div><h2>Salón</h2><p>Estado de las mesas registradas.</p></div><b>{tables.filter(t=>t.status!=='inactive').length} activas</b></div>
        {loading?<p className="restaurant-ops-muted">Cargando mesas…</p>:tables.length===0?<p className="restaurant-ops-muted">Todavía no hay mesas. Crea la primera para comenzar.</p>:<div className="restaurant-table-list">{tables.map(t=><article key={t.id}><span className="restaurant-table-icon"><Utensils size={18}/></span><div><b>{t.name}</b><small>{t.capacity} personas · {t.status==='inactive'?'Inactiva':'Disponible'}</small></div><button onClick={()=>void toggleTable(t)}>{t.status==='inactive'?'Activar':'Desactivar'}</button></article>)}</div>}
      </section>
    </div>:<div className="restaurant-ops-grid">
      <section className="restaurant-ops-panel"><h2>Invitar mesero</h2><p>Cada integrante tendrá su propio correo y contraseña. No compartas el acceso del propietario.</p><form onSubmit={inviteWaiter}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="mesero@restaurante.com" required/></label><button className="restaurant-primary" disabled={busy}><UserPlus size={16}/>{busy?'Enviando…':'Enviar invitación'}</button></form><small className="restaurant-ops-footnote">El sistema verificará el cupo de meseros del plan antes de enviar la invitación.</small></section>
      <section className="restaurant-ops-panel"><div className="restaurant-ops-panel-head"><div><h2>Equipo de servicio</h2><p>Usuarios con rol de mesero.</p></div><b>{waiters.filter(w=>w.status==='active').length} activos</b></div>
        {loading?<p className="restaurant-ops-muted">Cargando equipo…</p>:waiters.length===0?<p className="restaurant-ops-muted">Aún no has invitado meseros.</p>:<div className="restaurant-table-list">{waiters.map(w=><article key={w.id}><span className="restaurant-table-icon"><Users size={18}/></span><div><b>Mesero</b><small>{w.user_id.slice(0,8)}… · {w.status==='active'?'Activo':'Invitación pendiente'}</small></div><span className={'restaurant-member-status '+(w.status==='active'?'active':'')}>{w.status==='active'?'Activo':'Pendiente'}</span></article>)}</div>}
      </section>
    </div>}
  </section>;
}
