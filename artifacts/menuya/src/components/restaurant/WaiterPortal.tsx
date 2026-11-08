import { useCallback,useEffect,useState } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Utensils,ShoppingBag,LogOut,Send,RefreshCw,Plus,Minus,ClipboardList } from 'lucide-react';

type Product={id:string;name:string;price:number;image_url:string|null};
type Table={id:string;name:string;capacity:number;status:string};
type Line={product:Product;quantity:number};
const money=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
async function functionErrorMessage(error:any,data:any):Promise<string>{
 if(data?.error)return String(data.error);
 const response=error?.context;
 if(response&&typeof response.clone==='function'){
  try{const payload=await response.clone().json();if(payload?.error)return String(payload.error);if(payload?.message)return String(payload.message);}catch{}
  try{const raw=await response.clone().text();if(raw)return `Respuesta del servidor (${response.status}): ${raw.slice(0,240)}`;}catch{}
  if(response.status)return `La función respondió con estado HTTP ${response.status}. Revisa la conexión e inténtalo de nuevo.`;
 }
 return error?.message||'No fue posible completar la operación.';
}
export default function WaiterPortal(){
 const params=useParams<{slug:string}>(),slug=params.slug||'';
 const [code,setCode]=useState(''),[pin,setPin]=useState(''),[token,setToken]=useState(()=>sessionStorage.getItem('menuya-waiter-token')||'');
 const [waiter,setWaiter]=useState<{id:string;name:string}|null>(null),[products,setProducts]=useState<Product[]>([]),[tables,setTables]=useState<Table[]>([]);
 const [orders,setOrders]=useState<any[]>([]),[cart,setCart]=useState<Line[]>([]),[tableId,setTableId]=useState(''),[notes,setNotes]=useState('');
 const [tab,setTab]=useState<'take'|'orders'>('take'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const call=useCallback(async(action:string,body:Record<string,unknown>={})=>{
  const {data,error}=await supabase.functions.invoke('restaurant-waiter-access',{body:{action,...body},headers:token?{Authorization:'Bearer '+token}:{}});
  if(error)throw new Error(await functionErrorMessage(error,data));if(data?.error)throw new Error(data.error);return data;
 },[token]);
 const load=useCallback(async()=>{
  const [p,t,o]=await Promise.all([call('waiter_catalog'),call('waiter_tables'),call('waiter_orders')]);
  setProducts(p.products||[]);setTables(t.tables||[]);setOrders(o.orders||[]);
  setTableId(current=>current||(t.tables?.find((x:Table)=>x.status==='available')?.id||t.tables?.[0]?.id||''));
 },[call]);
 useEffect(()=>{if(!token)return;void load().catch(e=>{setError(e.message);sessionStorage.removeItem('menuya-waiter-token');setToken('');});},[token,load]);
 const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{
  const {data,error}=await supabase.functions.invoke('restaurant-waiter-access',{body:{action:'login',business_slug:slug,waiter_code:code,pin}});
  if(error)throw new Error(await functionErrorMessage(error,data));if(data?.error)throw new Error(data.error);
  sessionStorage.setItem('menuya-waiter-token',data.token);setToken(data.token);setWaiter(data.waiter);setPin('');
 }catch(e){setError(e instanceof Error?e.message:'No fue posible iniciar sesión.');}finally{setBusy(false);}};
 const add=(p:Product)=>setCart(prev=>{const found=prev.find(x=>x.product.id===p.id);return found?prev.map(x=>x.product.id===p.id?{...x,quantity:x.quantity+1}:x):[...prev,{product:p,quantity:1}];});
 const change=(id:string,delta:number)=>setCart(prev=>prev.map(x=>x.product.id===id?{...x,quantity:x.quantity+delta}:x).filter(x=>x.quantity>0));
 const total=cart.reduce((s,x)=>s+Number(x.product.price)*x.quantity,0);
 const sendOrder=async()=>{if(!tableId||!cart.length)return;setBusy(true);setError('');setNotice('');try{
  const data=await call('create_order',{table_id:tableId,items:cart.map(x=>({product_id:x.product.id,quantity:x.quantity})),notes});
  setNotice('Pedido #'+data.order.order_number+' enviado a cocina.');setCart([]);setNotes('');setTab('orders');await load();
 }catch(e){setError(e instanceof Error?e.message:'No fue posible enviar el pedido.');}finally{setBusy(false);}};
 const logout=async()=>{try{await call('logout');}catch{}sessionStorage.removeItem('menuya-waiter-token');setToken('');setWaiter(null);};
 if(!token)return <main className="waiter-login"><form onSubmit={login}><div className="waiter-mark"><Utensils/></div><span>MENUYA · EQUIPO DE SERVICIO</span><h1>Acceso de mesero</h1><p>Ingresa el código y PIN que te entregó el administrador.</p><label>Código de mesero<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" required placeholder="Ej. 123456"/></label><label>PIN<input value={pin} onChange={e=>setPin(e.target.value)} inputMode="numeric" type="password" minLength={4} maxLength={8} required placeholder="Tu PIN"/></label>{error&&<div className="waiter-error">{error}</div>}<button disabled={busy}>{busy?'Verificando…':'Ingresar'}</button></form></main>;
 return <main className="waiter-app"><header><div><span>MENUYA · MESERO</span><h1>Hola, {waiter?.name||'equipo'}</h1></div><button onClick={()=>void logout()}><LogOut size={17}/> Salir</button></header>
  <nav><button className={tab==='take'?'active':''} onClick={()=>setTab('take')}><ShoppingBag size={16}/> Tomar pedido</button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><ClipboardList size={16}/> Mis pedidos ({orders.length})</button></nav>
  {notice&&<p className="waiter-notice">{notice}</p>}{error&&<p className="waiter-error">{error}</p>}
  {tab==='take'?<div className="waiter-work"><section><div className="waiter-section-head"><h2>Productos</h2><input placeholder="Buscar producto" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="waiter-products">{products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><button key={p.id} onClick={()=>add(p)}><span>{p.image_url?<img src={p.image_url} alt=""/>:<ShoppingBag/>}</span><b>{p.name}</b><strong>{money(Number(p.price))}</strong><small>Agregar al pedido</small></button>)}</div></section>
  <aside><h2>Pedido actual</h2><label>Mesa<select value={tableId} onChange={e=>setTableId(e.target.value)}><option value="">Selecciona una mesa</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status==='occupied'?'Ocupada':'Disponible'}</option>)}</select></label>
  {cart.map(x=><article key={x.product.id}><div><b>{x.product.name}</b><small>{money(Number(x.product.price))}</small></div><div className="waiter-qty"><button onClick={()=>change(x.product.id,-1)}><Minus size={13}/></button>{x.quantity}<button onClick={()=>change(x.product.id,1)}><Plus size={13}/></button></div></article>)}
  <label>Notas para cocina<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sin cebolla, término medio…"/></label><div className="waiter-total"><span>Total</span><b>{money(total)}</b></div><button className="waiter-send" disabled={busy||!cart.length||!tableId} onClick={()=>void sendOrder()}><Send size={16}/>{busy?'Enviando…':'Enviar pedido'}</button></aside></div>:<section className="waiter-orders"><div className="waiter-section-head"><h2>Pedidos enviados</h2><button onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>{orders.length?orders.map(o=><article key={o.id}><div><b>Pedido #{o.order_number} · {o.restaurant_tables?.name||'Mesa'}</b><small>{new Date(o.created_at).toLocaleString('es-CO')} · {o.status}</small>{(o.order_items||[]).map((i:any)=><small key={i.product_name}>{i.quantity} × {i.product_name}</small>)}</div><strong>{money(Number(o.total))}</strong></article>):<p>Aún no tienes pedidos activos.</p>}</section>}
 </main>;
}
