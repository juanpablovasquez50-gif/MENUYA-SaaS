import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Users, Utensils, RefreshCw, UserPlus, AlertCircle, CheckCircle2, Power, KeyRound, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './restaurant-operations.css';

type DiningTable={id:string;name:string;capacity:number;status:string};
type Waiter={id:string;display_name:string;waiter_code:string;is_active:boolean;created_at:string};
export default function RestaurantOperations({businessId}:{businessId:string}){
 const [tab,setTab]=useState<'tables'|'waiters'>('tables');
 const [tables,setTables]=useState<DiningTable[]>([]);
 const [waiters,setWaiters]=useState<Waiter[]>([]);
 const [name,setName]=useState(''),[capacity,setCapacity]=useState('4');
 const [waiterName,setWaiterName]=useState(''),[pin,setPin]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [createdCredentials,setCreatedCredentials]=useState<{name:string;code:string;pin:string}|null>(null);
 const callAccess=async(body:Record<string,unknown>)=>{
  const {data,error}=await supabase.functions.invoke('restaurant-waiter-access',{body:{business_id:businessId,...body}});
  if(error)throw new Error(data?.error||error.message||'No fue posible completar la operación.');
  if(data?.error)throw new Error(data.error);
  return data;
 };
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  const [t,w]=await Promise.all([
   supabase.from('restaurant_tables').select('id,name,capacity,status').eq('business_id',businessId).order('name'),
   callAccess({action:'list'})
  ]);
  if(t.error)setError(t.error.message);
  if(!t.error)setTables((t.data||[]) as DiningTable[]);
  if(w?.waiters)setWaiters(w.waiters as Waiter[]);
  setLoading(false);
 },[businessId]);
 useEffect(()=>{void refresh().catch(e=>{setError(e.message||'No se pudo cargar la operación.');setLoading(false);});},[refresh]);
 const addTable=async(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;setBusy(true);setError('');setNotice('');
  const {error}=await supabase.from('restaurant_tables').insert({business_id:businessId,name:name.trim(),capacity:Math.max(1,Math.min(50,Number(capacity)||4))});
  if(error)setError(error.message);else{setName('');setCapacity('4');setNotice('Mesa creada correctamente.');await refresh();}setBusy(false);
 };
 const toggleTable=async(table:DiningTable)=>{const status=table.status==='inactive'?'available':'inactive';const {error}=await supabase.from('restaurant_tables').update({status,updated_at:new Date().toISOString()}).eq('id',table.id).eq('business_id',businessId);if(error)setError(error.message);else await refresh();};
 const createWaiter=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setNotice('');setCreatedCredentials(null);
  try{const data=await callAccess({action:'create',name:waiterName.trim(),pin});setCreatedCredentials({name:data.waiter.display_name,code:data.waiter.waiter_code,pin});setWaiterName('');setPin('');setNotice('Mesero creado. Entrega estas credenciales directamente al integrante del equipo.');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'No fue posible crear el mesero.');}finally{setBusy(false);}
 };
 const toggleWaiter=async(w:Waiter)=>{setBusy(true);setError('');try{await callAccess({action:'toggle',waiter_id:w.id,is_active:!w.is_active});setNotice(w.is_active?'Acceso del mesero desactivado.':'Acceso del mesero activado.');await refresh();}catch(e){setError(e instanceof Error?e.message:'No fue posible actualizar el mesero.');}finally{setBusy(false);}};
 const resetPin=async(w:Waiter)=>{const next=window.prompt('Asigna un nuevo PIN de 4 a 8 dígitos para '+w.display_name);if(!next)return;if(!/^[0-9]{4,8}$/.test(next)){setError('El PIN debe tener entre 4 y 8 dígitos.');return;}setBusy(true);setError('');try{await callAccess({action:'reset_pin',waiter_id:w.id,pin:next});setNotice('PIN actualizado. Comparte el nuevo PIN directamente con el mesero.');await refresh();}catch(e){setError(e instanceof Error?e.message:'No fue posible cambiar el PIN.');}finally{setBusy(false);}};
 return <section className="restaurant-ops">
  <header className="restaurant-ops-head"><div><span className="eyebrow">OPERACIÓN DEL RESTAURANTE</span><h1>Mesas y meseros</h1><p>Organiza el salón y administra los accesos del equipo de servicio.</p></div><button className="restaurant-refresh" onClick={()=>void refresh()} aria-label="Actualizar"><RefreshCw size={16}/></button></header>
  <nav className="restaurant-ops-tabs"><button className={tab==='tables'?'active':''} onClick={()=>setTab('tables')}><Utensils size={16}/> Mesas <span>{tables.length}</span></button><button className={tab==='waiters'?'active':''} onClick={()=>setTab('waiters')}><Users size={16}/> Meseros <span>{waiters.length}</span></button></nav>
  {notice&&<div className="restaurant-ops-notice"><CheckCircle2 size={16}/>{notice}</div>}{error&&<div className="restaurant-ops-error"><AlertCircle size={16}/>{error}</div>}
  {tab==='tables'?<div className="restaurant-ops-grid">
   <section className="restaurant-ops-panel"><h2>Registrar una mesa</h2><p>Agrega las mesas disponibles en tu restaurante.</p><form onSubmit={addTable}><label>Nombre o número<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Mesa 1" required maxLength={40}/></label><label>Capacidad<select value={capacity} onChange={e=>setCapacity(e.target.value)}>{[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} personas</option>)}</select></label><button className="restaurant-primary" disabled={busy}><Plus size={16}/> Crear mesa</button></form></section>
   <section className="restaurant-ops-panel"><div className="restaurant-ops-panel-head"><div><h2>Salón</h2><p>Estado de las mesas registradas.</p></div><b>{tables.filter(t=>t.status!=='inactive').length} activas</b></div>{loading?<p className="restaurant-ops-muted">Cargando mesas…</p>:tables.length===0?<p className="restaurant-ops-muted">Todavía no hay mesas. Crea la primera para comenzar.</p>:<div className="restaurant-table-list">{tables.map(t=><article key={t.id}><span className="restaurant-table-icon"><Utensils size={18}/></span><div><b>{t.name}</b><small>{t.capacity} personas · {t.status==='inactive'?'Inactiva':'Disponible'}</small></div><button onClick={()=>void toggleTable(t)}>{t.status==='inactive'?'Activar':'Desactivar'}</button></article>)}</div>}</section>
  </div>:<div className="restaurant-ops-grid">
   <section className="restaurant-ops-panel"><h2>Crear acceso de mesero</h2><p>No necesita correo ni crear una cuenta. Entrará con un código y un PIN que tú le entregas.</p><form onSubmit={createWaiter}><label>Nombre del mesero<input value={waiterName} onChange={e=>setWaiterName(e.target.value)} placeholder="Ej. Carlos Pérez" required minLength={2} maxLength={80}/></label><label>PIN de acceso (4 a 8 dígitos)<input inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="••••" required/></label><button className="restaurant-primary" disabled={busy}><UserPlus size={16}/>{busy?'Creando…':'Crear mesero'}</button></form><small className="restaurant-ops-footnote">El cupo se controla automáticamente según el plan. El PIN se almacena cifrado y no se puede consultar después.</small>
   {createdCredentials&&<div className="restaurant-credentials"><b>Credenciales para {createdCredentials.name}</b><div><span>Código</span><strong>{createdCredentials.code}</strong><button onClick={()=>void navigator.clipboard?.writeText(createdCredentials.code)} aria-label="Copiar código"><Copy size={14}/></button></div><div><span>PIN</span><strong>{createdCredentials.pin}</strong><button onClick={()=>void navigator.clipboard?.writeText(createdCredentials.pin)} aria-label="Copiar PIN"><Copy size={14}/></button></div><small>Guarda estos datos ahora y entrégaselos al mesero.</small></div>}</section>
   <section className="restaurant-ops-panel"><div className="restaurant-ops-panel-head"><div><h2>Equipo de servicio</h2><p>Accesos internos del restaurante.</p></div><b>{waiters.filter(w=>w.is_active).length} activos</b></div>{loading?<p className="restaurant-ops-muted">Cargando equipo…</p>:waiters.length===0?<p className="restaurant-ops-muted">Aún no has creado meseros.</p>:<div className="restaurant-table-list">{waiters.map(w=><article key={w.id}><span className="restaurant-table-icon"><Users size={18}/></span><div><b>{w.display_name}</b><small>Código {w.waiter_code} · {w.is_active?'Acceso activo':'Acceso suspendido'}</small></div><button disabled={busy} onClick={()=>void resetPin(w)} title="Cambiar PIN"><KeyRound size={15}/></button><button disabled={busy} onClick={()=>void toggleWaiter(w)} title={w.is_active?'Desactivar':'Activar'}><Power size={15}/></button></article>)}</div>}</section>
  </div>}
 </section>;
}
