import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Activity, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, CreditCard, LayoutDashboard, LogOut, Plus, Search, ShieldCheck, Store, Tag, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MenuyaAuthContext } from '@/lib/menuya-auth';

type BusinessRow={id:string;name:string;slug:string;business_type:string;status:string;is_published:boolean;created_at:string;email:string|null;phone:string|null};
type PlanRow={id:string;code:string;name:string;price:number;billing_period:'month'|'year';max_products:number;features:unknown;is_active:boolean;created_at:string;subscription_count:number};
type SubscriptionRow={id:string;business_id:string;business_name:string;owner_id:string;owner_name:string|null;owner_email:string|null;plan_id:string;plan_name:string;price:number;status:string;starts_at:string|null;ends_at:string|null;external_reference:string|null;created_at:string};
type UserRow={user_id:string;email:string|null;full_name:string|null;phone:string|null;created_at:string;business_count:number};
const nav=[['/admin','Resumen',LayoutDashboard],['/admin/businesses','Comercios',Store],['/admin/requests','Solicitudes',Clock3],['/admin/users','Usuarios',Users],['/admin/plans','Planes',Tag],['/admin/subscriptions','Suscripciones',CreditCard],['/admin/settings','Ajustes',ShieldCheck],['/admin/audit','Auditoría',Activity]] as const;
const cop=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0);
const date=(v:string|null)=>v?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(new Date(v)):'Sin fecha';
export default function PlatformAdminCenter({context,onLogout}:{context:MenuyaAuthContext;onLogout:()=>void}){
 const [path,setPath]=useLocation();
 const [businesses,setBusinesses]=useState<BusinessRow[]>([]); const [plans,setPlans]=useState<PlanRow[]>([]); const [subs,setSubs]=useState<SubscriptionRow[]>([]); const [users,setUsers]=useState<UserRow[]>([]);
 const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [query,setQuery]=useState(''); const [busy,setBusy]=useState('');
 const [editing,setEditing]=useState<PlanRow|null>(null); const [showPlan,setShowPlan]=useState(false);
 const [subEdit,setSubEdit]=useState<SubscriptionRow|null>(null);
 const [settings,setSettings]=useState<any[]>([]); const [settingKey,setSettingKey]=useState(''); const [settingValue,setSettingValue]=useState('{}'); const [settingDescription,setSettingDescription]=useState('');
 const section=path==='/admin'?'overview':path.split('/')[2]||'overview';
 const load=async()=>{
  setLoading(true);setError('');
  const [b,p,s,u]=await Promise.all([
   supabase.rpc('platform_list_businesses'),supabase.rpc('platform_list_plans'),supabase.rpc('platform_list_subscriptions'),supabase.rpc('platform_list_users')
  ]);
  const first=b.error||p.error||s.error||u.error;
  if(first)setError(first.message);
  else {setBusinesses((b.data||[]) as BusinessRow[]);setPlans((p.data||[]) as PlanRow[]);setSubs((s.data||[]) as SubscriptionRow[]);setUsers((u.data||[]) as UserRow[]);}
  if(section==='settings'){const {data,error:settingsError}=await supabase.rpc('platform_list_settings');if(settingsError)setError(settingsError.message);else setSettings(data||[]);}
  setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
  if(section!=='settings')return;
  let cancelled=false;
  const loadSettings=async()=>{
   setLoading(true);setError('');
   const {data,error:settingsError}=await supabase.rpc('platform_list_settings');
   if(cancelled)return;
   if(settingsError)setError(settingsError.message);else setSettings(data||[]);
   setLoading(false);
  };
  void loadSettings();
  return ()=>{cancelled=true;};
 },[section]);
 const filtered=(rows:any[],keys:string[])=>rows.filter(r=>keys.map(k=>String(r[k]??'')).join(' ').toLowerCase().includes(query.toLowerCase()));
 const updateBusiness=async(row:BusinessRow,status:'active'|'rejected'|'suspended')=>{
  if(!window.confirm('¿Confirmas '+(status==='active'?'aprobar':status==='rejected'?'rechazar':'suspender')+' '+row.name+'?'))return;
  setBusy(row.id);setError('');const {error:e}=await supabase.rpc('platform_set_business_status',{p_business_id:row.id,p_status:status,p_note:null});
  if(e)setError(e.message);else{setNotice('Estado del comercio actualizado.');await load();}setBusy('');
 };
 const savePlan=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const f=new FormData(e.currentTarget);setBusy('plan');setError('');
  const features=String(f.get('features')||'').split(',').map(x=>x.trim()).filter(Boolean);
  const {error:e2}=await supabase.rpc('platform_save_plan',{p_plan_id:editing?.id||null,p_code:String(f.get('code')),p_name:String(f.get('name')),p_price:Number(f.get('price')),p_billing_period:String(f.get('billing_period')),p_max_products:Number(f.get('max_products')),p_features:features,p_is_active:f.get('is_active')==='on'});
  if(e2)setError(e2.message);else{setNotice('Plan guardado correctamente.');setShowPlan(false);setEditing(null);await load();}setBusy('');
 };
 const saveSub=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(!subEdit)return;const f=new FormData(e.currentTarget);setBusy(subEdit.id);setError('');
  const end=String(f.get('ends_at')||'');const {error:e2}=await supabase.rpc('platform_update_subscription',{p_subscription_id:subEdit.id,p_plan_id:String(f.get('plan_id')),p_status:String(f.get('status')),p_ends_at:end?new Date(end+'T23:59:59').toISOString():null,p_note:'Actualización desde Superadmin'});
  if(e2)setError(e2.message);else{setNotice('Suscripción actualizada correctamente.');setSubEdit(null);await load();}setBusy('');
 };
 const saveSetting=async(ev:FormEvent<HTMLFormElement>)=>{ev.preventDefault();let parsed:any;try{parsed=JSON.parse(settingValue);}catch{setError('El valor debe ser JSON válido.');return;}setBusy('setting');setError('');const {error:saveError}=await supabase.rpc('platform_save_setting',{p_setting_key:settingKey,p_setting_value:parsed,p_description:settingDescription||null});if(saveError)setError(saveError.message);else{setNotice('Ajuste global guardado y registrado en auditoría.');setSettingKey('');setSettingValue('{}');setSettingDescription('');const {data,error:reloadError}=await supabase.rpc('platform_list_settings');if(reloadError)setError(reloadError.message);else setSettings(data||[]);}setBusy('');};
 const pending=businesses.filter(x=>x.status==='pending').length, active=businesses.filter(x=>x.status==='active').length;
 const initials=(context.profile?.full_name||context.user.email||'AD').slice(0,2).toUpperCase();
 const heading=nav.find(n=>n[0]===path)?.[1]||'Resumen';
 return <div className="sa-shell">
  <aside className="sa-sidebar"><div className="sa-logo"><span className="sa-brand-mark">m.</span><span>menuya<small>CONTROL CENTER</small></span></div><div className="sa-workspace"><span className="sa-workspace-dot"/><span>ATOM LABS<small>Workspace principal</small></span><ChevronDown size={15}/></div><span className="sa-nav-label">PLATAFORMA</span>
   {nav.map(([url,label,Icon])=><button key={url} className={'sa-nav-item '+(path===url?'active':'')} onClick={()=>{setPath(url);setQuery('');}}><Icon size={17}/>{label}{url==='/admin/businesses'&&pending>0?<b>{pending}</b>:null}</button>)}
   <div className="sa-sidebar-bottom"><div className="sa-secure-box"><ShieldCheck size={17}/><b>Entorno protegido</b><span>Las acciones administrativas quedan registradas.</span></div><button className="sa-logout" onClick={onLogout}><LogOut size={17}/> Cerrar sesión</button></div>
  </aside>
  <main className="sa-main"><header className="sa-topbar"><div><span>MENUYA</span><ChevronRight size={14}/><b>{heading}</b></div><div className="sa-profile"><span className="sa-profile-avatar">{initials}</span><span><b>{context.profile?.full_name||'Administrador'}</b><small>Superadministrador</small></span><button onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={17}/></button></div></header>
   <div className="sa-content"><div className="sa-welcome"><div><span className="sa-kicker">CENTRO DE CONTROL · MENUYA</span><h1>{heading==='Resumen'?'Hola, '+(context.profile?.full_name?.split(' ')[0]||'administrador')+'.':heading}</h1><p>Administra los datos reales de la plataforma desde un solo lugar.</p></div><button className="sa-refresh" onClick={()=>void load()} disabled={loading}><Activity size={16}/>{loading?'Actualizando…':'Actualizar datos'}</button></div>
    {error&&<div className="notice notice-error" role="alert">{error}</div>}{notice&&<div className="notice notice-success" role="status">{notice}</div>}
    {loading?<div className="sa-empty"><span className="loader-line"/>Cargando datos de Supabase…</div>:null}
    {section==='overview'&&<><section className="sa-stats">{[[Store,'Comercios',businesses.length,'Registros totales'],[Clock3,'Pendientes',pending,'Solicitudes por revisar'],[CheckCircle2,'Activos',active,'Comercios habilitados'],[CreditCard,'Suscripciones',subs.length,'Planes asignados']].map(([Icon,label,value,desc]:any)=><article className="sa-stat" key={label}><span className="sa-stat-icon violet"><Icon size={19}/></span><small>{label}</small><strong>{value}</strong><span>{desc}</span></article>)}</section><section className="sa-panel"><div className="sa-panel-heading"><div><span className="sa-kicker">ACTIVIDAD RECIENTE</span><h2>Últimos comercios registrados</h2><p>Accesos y solicitudes que requieren seguimiento.</p></div><button className="sa-refresh" onClick={()=>setPath('/admin/businesses')}>Ver comercios <ArrowRight size={15}/></button></div><DataTable headers={['COMERCIO','SECTOR','ESTADO','REGISTRO']} rows={businesses.slice(0,6).map(x=>[x.name,x.business_type||'—',x.status,date(x.created_at)])}/></section></>}
    {section==='businesses'&&<section className="sa-panel"><PanelHead title="Directorio de comercios" subtitle="Aprueba, rechaza o suspende negocios registrados." count={businesses.length}/><SearchBox value={query} change={setQuery}/><DataTable headers={['COMERCIO','SECTOR','ESTADO','REGISTRO','ACCIONES']} rows={filtered(businesses,['name','email','phone','business_type']).map(x=>[<b>{x.name}</b>,x.business_type||'—',x.status,date(x.created_at),<div className="sa-actions"><button className="approve" disabled={busy===x.id} onClick={()=>void updateBusiness(x,'active')}><Check size={13}/> Aprobar</button><button className="reject" disabled={busy===x.id} onClick={()=>void updateBusiness(x,'suspended')}>Suspender</button></div>])}/></section>}
    {section==='requests'&&<section className="sa-panel"><PanelHead title="Solicitudes pendientes" subtitle="Registros que esperan aprobación." count={pending}/><DataTable headers={['COMERCIO','SECTOR','CORREO','REGISTRO','ACCIONES']} rows={businesses.filter(x=>x.status==='pending').map(x=>[<b>{x.name}</b>,x.business_type||'—',x.email||'—',date(x.created_at),<div className="sa-actions"><button className="approve" disabled={busy===x.id} onClick={()=>void updateBusiness(x,'active')}><Check size={13}/> Aprobar</button><button className="reject" disabled={busy===x.id} onClick={()=>void updateBusiness(x,'rejected')}>Rechazar</button></div>])}/></section>}
    {section==='users'&&<section className="sa-panel"><PanelHead title="Usuarios de la plataforma" subtitle="Cuentas registradas y comercios vinculados." count={users.length}/><SearchBox value={query} change={setQuery}/><DataTable headers={['USUARIO','CORREO','TELÉFONO','COMERCIOS','REGISTRO']} rows={filtered(users,['full_name','email','phone']).map(x=>[<b>{x.full_name||'Sin nombre'}</b>,x.email||'—',x.phone||'—',x.business_count,date(x.created_at)])}/></section>}
    {section==='plans'&&<section className="sa-panel"><PanelHead title="Planes y precios" subtitle="Configura precios, límites y características disponibles." count={plans.length} action={<button className="sa-refresh" onClick={()=>{setEditing(null);setShowPlan(true);}}> <Plus size={15}/> Crear plan</button>}/><DataTable headers={['PLAN','PRECIO','PERIODICIDAD','LÍMITE PRODUCTOS','SUSCRIPCIONES','ESTADO','']} rows={plans.map(x=>[<b>{x.name}<small style={{display:'block'}}>{x.code}</small></b>,cop(x.price),x.billing_period==='year'?'Anual':'Mensual',x.max_products,x.subscription_count,x.is_active?'Activo':'Inactivo',<button className="approve" onClick={()=>{setEditing(x);setShowPlan(true);}}>Editar</button>])}/></section>}
    {section==='subscriptions'&&<section className="sa-panel"><PanelHead title="Suscripciones" subtitle="Administra el plan, estado y fecha de vencimiento de cada comercio." count={subs.length}/><SearchBox value={query} change={setQuery}/><DataTable headers={['COMERCIO','TITULAR','PLAN','PRECIO','ESTADO','VENCE','']} rows={filtered(subs,['business_name','owner_name','owner_email','plan_name','status']).map(x=>[<b>{x.business_name}</b>,<span>{x.owner_name||'—'}<small style={{display:'block'}}>{x.owner_email||''}</small></span>,x.plan_name,cop(x.price),x.status,date(x.ends_at),<button className="approve" onClick={()=>setSubEdit(x)}>Administrar</button>])}/></section>}
    {section==='settings'&&<><section className="sa-panel"><PanelHead title="Ajustes globales" subtitle="Configuraciones operativas de Menuya. No guardes claves, tokens ni secretos aquí."/><form className="form-stack" onSubmit={saveSetting}><label className="field"><span>Clave (minúsculas, números, punto, guion)</span><input required pattern="[a-z][a-z0-9_.-]{1,79}" value={settingKey} onChange={e=>setSettingKey(e.target.value)} placeholder="platform.maintenance_mode"/></label><label className="field"><span>Valor en JSON</span><textarea required rows={4} value={settingValue} onChange={e=>setSettingValue(e.target.value)} /></label><label className="field"><span>Descripción</span><input value={settingDescription} onChange={e=>setSettingDescription(e.target.value)} placeholder="Descripción del ajuste"/></label><button className="sa-submit" disabled={busy==='setting'||!settingKey.trim()}>{busy==='setting'?'Guardando…':'Guardar ajuste'}</button></form></section><section className="sa-panel"><PanelHead title="Configuraciones guardadas" subtitle="Los cambios quedan registrados en auditoría." count={settings.length}/><DataTable headers={['CLAVE','VALOR','DESCRIPCIÓN','ACTUALIZADO']} rows={settings.map(x=>[<b>{x.setting_key}</b>,<code>{JSON.stringify(x.setting_value)}</code>,x.description||'—',date(x.updated_at)])}/></section></>}
    {section==='audit'&&<section className="sa-panel"><PanelHead title="Auditoría" subtitle="Historial de cambios de estado en comercios."/><AuditList/></section>}
    <footer className="sa-footer"><span>MENUYA · ATOM LABS</span><span><ShieldCheck size={14}/> Sesión protegida · Operaciones verificadas</span></footer>
   </div>
  </main>
  {showPlan&&<div className="modal-backdrop"><form className="modal" onSubmit={savePlan}><header className="modal-head"><div><span className="eyebrow">GESTIÓN DE PLANES</span><h2>{editing?'Editar plan':'Crear plan'}</h2></div><button type="button" className="icon-btn" onClick={()=>setShowPlan(false)}>×</button></header><div className="form-stack"><label className="field"><span>Código</span><input name="code" required defaultValue={editing?.code||''}/></label><label className="field"><span>Nombre</span><input name="name" required defaultValue={editing?.name||''}/></label><label className="field"><span>Precio COP</span><input name="price" type="number" min="0" required defaultValue={editing?.price??0}/></label><label className="field"><span>Periodicidad</span><select name="billing_period" defaultValue={editing?.billing_period||'month'}><option value="month">Mensual</option><option value="year">Anual</option></select></label><label className="field"><span>Máximo de productos</span><input name="max_products" type="number" min="1" required defaultValue={editing?.max_products??20}/></label><label className="field"><span>Características (separadas por coma)</span><input name="features" defaultValue={Array.isArray(editing?.features)?editing?.features.join(', '):''}/></label><label><input type="checkbox" name="is_active" defaultChecked={editing?.is_active??true}/> Plan activo</label><button className="sa-submit" disabled={busy==='plan'}>{busy==='plan'?'Guardando…':'Guardar plan'}</button></div></form></div>}
  {subEdit&&<div className="modal-backdrop"><form className="modal" onSubmit={saveSub}><header className="modal-head"><div><span className="eyebrow">GESTIÓN DE SUSCRIPCIÓN</span><h2>{subEdit.business_name}</h2></div><button type="button" className="icon-btn" onClick={()=>setSubEdit(null)}>×</button></header><div className="form-stack"><label className="field"><span>Plan</span><select name="plan_id" defaultValue={subEdit.plan_id}>{plans.map(p=><option key={p.id} value={p.id}>{p.name} · {cop(p.price)}</option>)}</select></label><label className="field"><span>Estado</span><select name="status" defaultValue={subEdit.status}>{['pending','active','past_due','cancelled','expired'].map(s=><option key={s} value={s}>{({pending:'Pendiente',active:'Activa',past_due:'En mora',cancelled:'Cancelada',expired:'Vencida'} as any)[s]}</option>)}</select></label><label className="field"><span>Vencimiento</span><input name="ends_at" type="date" defaultValue={subEdit.ends_at?.slice(0,10)||''}/></label><button className="sa-submit" disabled={busy===subEdit.id}>{busy===subEdit.id?'Guardando…':'Guardar cambios'}</button></div></form></div>}
 </div>;
}
function PanelHead({title,subtitle,count,action}:{title:string;subtitle:string;count?:number;action?:ReactNode}){return <div className="sa-panel-heading"><div><span className="sa-kicker">ADMINISTRACIÓN</span><h2>{title}</h2><p>{subtitle}</p></div><div className="sa-total">{action||count!==undefined? action||count+' registros':null}</div></div>}
function SearchBox({value,change}:{value:string;change:(v:string)=>void}){return <div className="sa-toolbar"><div className="sa-search"><Search size={17}/><input value={value} onChange={e=>change(e.target.value)} placeholder="Buscar…"/></div></div>}
function DataTable({headers,rows}:{headers:string[];rows:ReactNode[][]}){return <div className="sa-table-wrap"><table className="sa-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={headers.length}><div className="sa-empty">No hay registros para mostrar.</div></td></tr>}</tbody></table></div>}
function AuditList(){const [rows,setRows]=useState<any[]>([]);const [err,setErr]=useState('');useEffect(()=>{supabase.rpc('platform_list_audit_logs').then(({data,error})=>{if(error)setErr(error.message);else setRows(data||[]);});},[]);return <>{err?<div className="notice notice-error">{err}</div>:<DataTable headers={['COMERCIO','ESTADO ANTERIOR','ESTADO NUEVO','NOTA','FECHA']} rows={rows.map(x=>[x.business_name||'—',x.previous_status||'—',x.new_status||'—',x.note||'—',date(x.created_at)])}/>}</>}
