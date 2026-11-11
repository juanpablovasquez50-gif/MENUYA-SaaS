import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Check, CheckCircle2, Copy, ExternalLink, Handshake, Link2, Plus, RefreshCw, Search, Users, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Partner = {
  id:string; full_name:string; email:string; phone:string|null; partner_type:'influencer'|'commercial';
  city:string; status:'pending'|'active'|'suspended'|'rejected'; referral_code:string; created_at:string;
  referral_count:number; qualified_count:number; pending_commission:number; paid_commission:number;
};
type Referral = {
  id:string; partner_id:string; partner_name:string; business_id:string; business_name:string;
  business_type:string; owner_email:string|null; referral_code:string; status:string;
  created_at:string; qualified_at:string|null; plan_name:string|null; subscription_status:string|null;
};
type Commission = {
  id:string; partner_id:string; partner_name:string; business_name:string; plan_name:string;
  amount:number; status:'pending'|'approved'|'paid'|'reversed'; created_at:string;
  paid_at:string|null; payment_reference:string|null;
};
type Rule = {plan_id:string;plan_name:string;plan_price:number;commission_amount:number;is_active:boolean};
type Tab = 'partners'|'referrals'|'commissions'|'rules';
const cop=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v)||0);
const date=(v:string|null)=>v?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(new Date(v)):'—';
const statusLabel:Record<string,string>={pending:'Pendiente',active:'Activo',suspended:'Suspendido',rejected:'Rechazado',registered:'Registrado',qualified:'Convertido',reversed:'Revertido',approved:'Aprobada',paid:'Pagada'};
const typeLabel:Record<string,string>={influencer:'Influencer',commercial:'Comercial'};
const statusClass=(v:string)=>['active','qualified','paid','approved'].includes(v)?'active':['rejected','suspended','reversed'].includes(v)?'danger':'pending';

export default function PartnersManager(){
 const [tab,setTab]=useState<Tab>('partners');
 const [partners,setPartners]=useState<Partner[]>([]);
 const [referrals,setReferrals]=useState<Referral[]>([]);
 const [commissions,setCommissions]=useState<Commission[]>([]);
 const [rules,setRules]=useState<Rule[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [editing,setEditing]=useState<Partner|null>(null);
 const [showForm,setShowForm]=useState(false);

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  const [p,r,c,ru]=await Promise.all([
   supabase.rpc('platform_list_partners'),
   supabase.rpc('platform_list_partner_referrals'),
   supabase.rpc('platform_list_partner_commissions'),
   supabase.rpc('platform_list_partner_commission_rules'),
  ]);
  const first=p.error||r.error||c.error||ru.error;
  if(first)setError(first.message);
  else {setPartners((p.data||[]) as Partner[]);setReferrals((r.data||[]) as Referral[]);setCommissions((c.data||[]) as Commission[]);setRules((ru.data||[]) as Rule[]);}
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const filteredPartners=useMemo(()=>partners.filter(p=>[p.full_name,p.email,p.phone,p.referral_code,p.city].join(' ').toLowerCase().includes(query.toLowerCase())),[partners,query]);
 const totalPending=commissions.filter(c=>c.status==='pending'||c.status==='approved').reduce((s,c)=>s+Number(c.amount),0);
 const totalPaid=commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount),0);
 const savePartner=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const f=new FormData(e.currentTarget);setBusy('partner');setError('');
  const {error:e2}=await supabase.rpc('platform_save_partner',{
   p_partner_id:editing?.id||null,p_full_name:String(f.get('full_name')),p_email:String(f.get('email')),
   p_phone:String(f.get('phone')||''),p_partner_type:String(f.get('partner_type')),
   p_city:String(f.get('city')||'Montería'),p_status:String(f.get('status')),
  });
  if(e2)setError(e2.message);else{setNotice(editing?'Partner actualizado.':'Partner creado.');setShowForm(false);setEditing(null);await load();}
  setBusy('');
 };
 const setPartnerStatus=async(p:Partner,status:Partner['status'])=>{
  setBusy(p.id);setError('');const {error:e}=await supabase.rpc('platform_set_partner_status',{p_partner_id:p.id,p_status:status});
  if(e)setError(e.message);else{setNotice('Estado del Partner actualizado.');await load();}setBusy('');
 };
 const saveRule=async(rule:Rule)=>{
  setBusy(rule.plan_id);setError('');
  const {error:e}=await supabase.rpc('platform_save_partner_commission_rule',{p_plan_id:rule.plan_id,p_amount:Number(rule.commission_amount)||0,p_is_active:rule.is_active});
  if(e)setError(e.message);else setNotice('Regla de comisión guardada.');setBusy('');
 };
 const setCommissionStatus=async(c:Commission,status:Commission['status'])=>{
  let reference:string|null=null;
  if(status==='paid'){
   reference=window.prompt('Ingresa la referencia del comprobante de pago:')?.trim()||null;
   if(!reference)return;
  }
  setBusy(c.id);setError('');
  const {error:e}=await supabase.rpc('platform_set_partner_commission_status',{p_commission_id:c.id,p_status:status,p_payment_reference:reference});
  if(e)setError(e.message);else{setNotice('Estado de la comisión actualizado.');await load();}setBusy('');
 };
 const copyReferral=(code:string)=>{
  const url=`${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
  void navigator.clipboard.writeText(url).then(()=>setNotice('Enlace de referido copiado.'));
 };
 const moneyInput=(rule:Rule,value:number)=>setRules(prev=>prev.map(r=>r.plan_id===rule.plan_id?{...r,commission_amount:value}:r));
 const toggleRule=(rule:Rule)=>setRules(prev=>prev.map(r=>r.plan_id===rule.plan_id?{...r,is_active:!r.is_active}:r));

 return <div className="partners-manager">
  <section className="sa-stats partners-stats">
   {[[Users,'Partners',partners.length,'Aliados registrados'],[Link2,'Comercios referidos',referrals.length,'Atribuciones registradas'],[Wallet,'Comisiones pendientes',cop(totalPending),'Por aprobar o pagar'],[CheckCircle2,'Comisiones pagadas',cop(totalPaid),'Pagos registrados']].map(([Icon,label,value,desc]:any)=><article className="sa-stat" key={label}><span className="sa-stat-icon violet"><Icon size={19}/></span><small>{label}</small><strong>{value}</strong><span>{desc}</span></article>)}
  </section>
  {error&&<div className="notice notice-error" role="alert">{error}</div>}{notice&&<div className="notice notice-success" role="status">{notice}</div>}
  <section className="sa-panel">
   <div className="sa-panel-heading partners-heading"><div><span className="sa-kicker">CRECIMIENTO COMERCIAL · MONTERÍA</span><h2>CLICKOK Partners</h2><p>Gestiona aliados, referidos y comisiones desde ATOMLABS.</p></div><button className="sa-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Actualizando…':'Actualizar'}</button></div>
   <div className="partners-tabs">
    {([['partners','Aliados'],['referrals','Comercios referidos'],['commissions','Comisiones'],['rules','Reglas de comisión']] as [Tab,string][]).map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setQuery('');}}>{label}</button>)}
   </div>
   {tab==='partners'&&<div className="partners-section">
    <div className="partners-toolbar"><div className="sa-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar aliado, correo o código…"/></div><button className="sa-submit partners-add" onClick={()=>{setEditing(null);setShowForm(true);}}><Plus size={15}/> Nuevo Partner</button></div>
    {loading?<div className="sa-empty">Cargando aliados…</div>:<div className="sa-table-wrap"><table className="sa-table partners-table"><thead><tr><th>PARTNER</th><th>TIPO</th><th>REFERIDOS</th><th>COMISIONES</th><th>ESTADO</th><th>ENLACE</th><th>ACCIONES</th></tr></thead><tbody>{filteredPartners.length?filteredPartners.map(p=><tr key={p.id}><td><b>{p.full_name}</b><small className="partners-sub">{p.email}</small><small className="partners-sub">{p.phone||p.city}</small></td><td>{typeLabel[p.partner_type]}</td><td><b>{p.referral_count}</b><small className="partners-sub">{p.qualified_count} convertidos</small></td><td><b>{cop(Number(p.pending_commission))}</b><small className="partners-sub">Pagado: {cop(Number(p.paid_commission))}</small></td><td><span className={`partners-status ${statusClass(p.status)}`}>{statusLabel[p.status]}</span></td><td><button className="partners-copy" disabled={p.status!=='active'} onClick={()=>copyReferral(p.referral_code)}><Copy size={13}/>{p.referral_code}</button></td><td><div className="sa-actions"><button className="approve" onClick={()=>{setEditing(p);setShowForm(true);}}>Editar</button>{p.status==='active'?<button className="reject" disabled={busy===p.id} onClick={()=>void setPartnerStatus(p,'suspended')}>Suspender</button>:<button className="approve" disabled={busy===p.id} onClick={()=>void setPartnerStatus(p,'active')}>Activar</button>}</div></td></tr>):<tr><td colSpan={7}><div className="sa-empty">Todavía no hay Partners registrados.</div></td></tr>}</tbody></table></div>}
   </div>}
   {tab==='referrals'&&<div className="partners-section"><div className="sa-toolbar"><div className="sa-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar comercio, Partner o código…"/></div></div><div className="sa-table-wrap"><table className="sa-table partners-table"><thead><tr><th>COMERCIO</th><th>PARTNER</th><th>CÓDIGO</th><th>PLAN</th><th>SUSCRIPCIÓN</th><th>ATRIBUCIÓN</th><th>FECHA</th></tr></thead><tbody>{referrals.filter(r=>[r.business_name,r.partner_name,r.owner_email,r.referral_code].join(' ').toLowerCase().includes(query.toLowerCase())).map(r=><tr key={r.id}><td><b>{r.business_name}</b><small className="partners-sub">{r.owner_email||r.business_type||'—'}</small></td><td>{r.partner_name}</td><td><code>{r.referral_code}</code></td><td>{r.plan_name||'—'}</td><td>{r.subscription_status||'—'}</td><td><span className={`partners-status ${statusClass(r.status)}`}>{statusLabel[r.status]||r.status}</span></td><td>{date(r.created_at)}</td></tr>)}</tbody></table>{!referrals.length&&!loading&&<div className="sa-empty">Aún no hay comercios referidos.</div>}</div></div>}
   {tab==='commissions'&&<div className="partners-section"><div className="sa-table-wrap"><table className="sa-table partners-table"><thead><tr><th>PARTNER</th><th>COMERCIO</th><th>PLAN</th><th>COMISIÓN</th><th>ESTADO</th><th>FECHA</th><th>ACCIONES</th></tr></thead><tbody>{commissions.map(c=><tr key={c.id}><td><b>{c.partner_name}</b></td><td>{c.business_name}</td><td>{c.plan_name}</td><td><b>{cop(Number(c.amount))}</b></td><td><span className={`partners-status ${statusClass(c.status)}`}>{statusLabel[c.status]}</span>{c.payment_reference&&<small className="partners-sub">{c.payment_reference}</small>}</td><td>{date(c.created_at)}</td><td><div className="sa-actions">{c.status==='pending'&&<button className="approve" disabled={busy===c.id} onClick={()=>void setCommissionStatus(c,'approved')}>Aprobar</button>}{c.status==='approved'&&<button className="approve" disabled={busy===c.id} onClick={()=>void setCommissionStatus(c,'paid')}>Registrar pago</button>}{c.status!=='paid'&&c.status!=='reversed'&&<button className="reject" disabled={busy===c.id} onClick={()=>void setCommissionStatus(c,'reversed')}>Revertir</button>}</div></td></tr>)}</tbody></table>{!commissions.length&&!loading&&<div className="sa-empty">Todavía no hay comisiones generadas.</div>}</div></div>}
   {tab==='rules'&&<div className="partners-section"><div className="partners-rules-intro"><b>Define cuánto recibe cada Partner por una conversión válida.</b><p>La comisión se genera una sola vez por comercio cuando la suscripción queda activa y registra una referencia externa de pago. No hay tarifas preconfiguradas.</p></div><div className="sa-table-wrap"><table className="sa-table partners-table"><thead><tr><th>PLAN</th><th>PRECIO DEL PLAN</th><th>COMISIÓN POR CONVERSIÓN</th><th>ACTIVA</th><th></th></tr></thead><tbody>{rules.map(rule=><tr key={rule.plan_id}><td><b>{rule.plan_name}</b></td><td>{cop(Number(rule.plan_price))}</td><td><label className="partners-money"><span>$</span><input aria-label={`Comisión para ${rule.plan_name}`} type="number" min="0" step="100" value={rule.commission_amount} onChange={e=>moneyInput(rule,Number(e.target.value))}/></label></td><td><input type="checkbox" checked={rule.is_active} onChange={()=>toggleRule(rule)} aria-label={`Activar comisión ${rule.plan_name}`}/></td><td><button className="approve" disabled={busy===rule.plan_id} onClick={()=>void saveRule(rule)}>{busy===rule.plan_id?'Guardando…':'Guardar regla'}</button></td></tr>)}</tbody></table></div></div>}
  </section>
  <div className="partners-footnote"><Handshake size={15}/> La atribución queda vinculada al primer registro del comercio. Los pagos de comisiones requieren aprobación y referencia de comprobante.</div>
  {showForm&&<div className="modal-backdrop" role="presentation"><form className="modal partners-modal" onSubmit={savePartner}><header className="modal-head"><div><span className="eyebrow">RED DE ALIADOS</span><h2>{editing?'Editar Partner':'Registrar Partner'}</h2></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)}>×</button></header><div className="form-stack"><label className="field"><span>Nombre completo</span><input name="full_name" required minLength={2} defaultValue={editing?.full_name||''}/></label><label className="field"><span>Correo electrónico</span><input name="email" type="email" required defaultValue={editing?.email||''}/></label><label className="field"><span>Teléfono</span><input name="phone" defaultValue={editing?.phone||''}/></label><label className="field"><span>Tipo de Partner</span><select name="partner_type" defaultValue={editing?.partner_type||'commercial'}><option value="commercial">Comercial</option><option value="influencer">Influencer</option></select></label><label className="field"><span>Ciudad</span><input name="city" defaultValue={editing?.city||'Montería'}/></label><label className="field"><span>Estado</span><select name="status" defaultValue={editing?.status||'pending'}><option value="pending">Pendiente</option><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="rejected">Rechazado</option></select></label><button className="sa-submit" disabled={busy==='partner'}>{busy==='partner'?'Guardando…':'Guardar Partner'}</button></div></form></div>}
 </div>;
}
