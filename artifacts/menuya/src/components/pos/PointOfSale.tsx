import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, CheckCircle2, Clock3, CreditCard, Minus, Plus, Receipt, Search, ShoppingCart, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/menuya-data';
import './pos.css';

type PosProduct = Pick<Product, 'id'|'nombre'|'precio'|'imagen'|'stock'|'activo'|'disponible'>;
type CashSession = { id:string; opening_amount:number; status:string; opened_at:string; branch_id:string|null };
type Sale = { id:string; total:number; subtotal:number; discount:number; payment_method:string; created_at:string };

const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const dateTime=(s:string)=>new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(new Date(s));

export default function PointOfSale({businessId}:{businessId:string}) {
  const [products,setProducts]=useState<PosProduct[]>([]);
  const [session,setSession]=useState<CashSession|null>(null);
  const [sales,setSales]=useState<Sale[]>([]);
  const [cart,setCart]=useState<Record<string,number>>({});
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState<'sale'|'history'|'cash'>('sale');
  const [opening,setOpening]=useState('0');
  const [closing,setClosing]=useState('');
  const [payment,setPayment]=useState('cash');
  const [discount,setDiscount]=useState('0');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    const [p,c,s]=await Promise.all([
      supabase.from('products').select('id,name,price,image_url,stock,is_active,is_available').eq('business_id',businessId).eq('is_active',true).eq('is_available',true).order('name'),
      supabase.from('cash_sessions').select('id,opening_amount,status,opened_at,branch_id').eq('business_id',businessId).eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('sales').select('id,total,subtotal,discount,payment_method,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(50)
    ]);
    if(p.error||c.error||s.error) throw p.error||c.error||s.error;
    setProducts((p.data||[]).map(x=>({id:x.id,nombre:x.name,precio:Number(x.price),imagen:x.image_url||undefined,stock:x.stock===null?undefined:Number(x.stock),activo:x.is_active,disponible:x.is_available})));
    setSession(c.data?{...c.data,opening_amount:Number(c.data.opening_amount)}:null);
    setSales((s.data||[]).map(x=>({...x,total:Number(x.total),subtotal:Number(x.subtotal),discount:Number(x.discount)})));
  },[businessId]);

  useEffect(()=>{load().catch(e=>setError(e.message||'No se pudo cargar el punto de venta.'));},[load]);
  const cartLines=useMemo(()=>products.filter(p=>(cart[p.id]||0)>0).map(p=>({...p,quantity:cart[p.id]})),[products,cart]);
  const subtotal=cartLines.reduce((sum,p)=>sum+p.precio*p.quantity,0);
  const discountValue=Math.max(0,Math.min(subtotal,Number(discount)||0));
  const total=subtotal-discountValue;
  const filtered=products.filter(p=>p.nombre.toLowerCase().includes(search.toLowerCase()));

  const changeQty=(id:string,delta:number)=>{
    const product=products.find(p=>p.id===id); if(!product)return;
    setCart(prev=>{const next=(prev[id]||0)+delta;if(next<=0){const copy={...prev};delete copy[id];return copy;}if(product.stock!==undefined&&next>product.stock)return prev;return {...prev,[id]:next};});
  };
  const openCash=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const {data:userResult,error:userError}=await supabase.auth.getUser();if(userError)throw userError;
      if(!userResult.user)throw new Error('Inicia sesión para abrir la caja.');
      const {data,error}=await supabase.from('cash_sessions').insert({business_id:businessId,opened_by:userResult.user.id,opening_amount:Math.max(0,Number(opening)||0),status:'open'}).select('id,opening_amount,status,opened_at,branch_id').single();
      if(error)throw error;setSession({...data,opening_amount:Number(data.opening_amount)});setNotice('Caja abierta correctamente.');
    }catch(e){setError(e instanceof Error?e.message:'No fue posible abrir la caja.');}
    finally{setBusy(false);}
  };
  const checkout=async()=>{
    if(!session){setError('Abre la caja antes de registrar ventas.');return;}
    if(!cartLines.length){setError('Agrega productos a la venta.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const {data,error}=await supabase.rpc('pos_register_sale',{p_business_id:businessId,p_cash_session_id:session.id,p_payment_method:payment,p_discount:discountValue,p_items:cartLines.map(p=>({product_id:p.id,quantity:p.quantity})),p_branch_id:session.branch_id});
      if(error)throw error;
      setCart({});setDiscount('0');setNotice('Venta registrada. Inventario actualizado.');await load();
    }catch(e){setError(e instanceof Error?e.message:'No fue posible registrar la venta.');}
    finally{setBusy(false);}
  };
  const closeCash=async()=>{
    if(!session)return;
    setBusy(true);setError('');setNotice('');
    try{
      const amount=Math.max(0,Number(closing)||0);
      const {data:cashSales,error:salesError}=await supabase.from('sales').select('total,payment_method').eq('business_id',businessId).eq('cash_session_id',session.id);
      if(salesError)throw salesError;
      const cashCollected=(cashSales||[]).filter(s=>['cash','efectivo'].includes(String(s.payment_method).toLowerCase())).reduce((sum,s)=>sum+Number(s.total||0),0);
      const expected=session.opening_amount+cashCollected;
      const {data:userResult,error:userError}=await supabase.auth.getUser();if(userError)throw userError;
      const {error}=await supabase.from('cash_sessions').update({status:'closed',closed_at:new Date().toISOString(),closed_by:userResult.user?.id,closing_amount:amount,expected_amount:expected}).eq('id',session.id).eq('business_id',businessId);
      if(error)throw error;setSession(null);setClosing('');setNotice('Caja cerrada correctamente.');await load();
    }catch(e){setError(e instanceof Error?e.message:'No fue posible cerrar la caja.');}
    finally{setBusy(false);}
  };

  return <section className="pos-root">
    <header className="pos-heading"><div><span className="eyebrow">OPERACIÓN DEL COMERCIO</span><h1>Punto de venta</h1><p>Vende en mostrador y mantén el inventario sincronizado con tu tienda.</p></div><div className={`pos-cash-state ${session?'is-open':''}`}><span/>{session?'Caja abierta':'Caja cerrada'}</div></header>
    <nav className="pos-tabs">
      <button className={tab==='sale'?'active':''} onClick={()=>setTab('sale')}><ShoppingCart size={16}/> Nueva venta</button>
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><Receipt size={16}/> Historial</button>
      <button className={tab==='cash'?'active':''} onClick={()=>setTab('cash')}><Wallet size={16}/> Caja</button>
    </nav>
    {notice&&<div className="pos-notice"><CheckCircle2 size={16}/>{notice}</div>}
    {error&&<div className="pos-error"><AlertCircle size={16}/>{error}</div>}
    {tab==='sale'&&<div className="pos-layout">
      <div className="pos-catalog panel"><div className="pos-catalog-head"><div><h2>Productos</h2><small>Selecciona para agregar a la venta</small></div><label className="pos-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto"/></label></div>
        <div className="pos-products">{filtered.map(p=><button className="pos-product" key={p.id} onClick={()=>changeQty(p.id,1)} disabled={p.stock!==undefined&&p.stock<=0}><span className="pos-product-image">{p.imagen?<img src={p.imagen} alt=""/>:<ShoppingCart size={22}/>}</span><b>{p.nombre}</b><strong>{money(p.precio)}</strong><small>{p.stock===undefined?'Stock no controlado':`${p.stock} disponibles`}</small></button>)}</div>
      </div>
      <aside className="pos-cart panel"><div className="pos-cart-title"><div><h2>Venta actual</h2><small>{cartLines.reduce((n,p)=>n+p.quantity,0)} unidades</small></div><ShoppingCart size={19}/></div>
        {!session&&<div className="pos-callout"><AlertCircle size={17}/> Debes abrir la caja para cobrar.</div>}
        <div className="pos-cart-lines">{cartLines.map(p=><div className="pos-cart-line" key={p.id}><div><b>{p.nombre}</b><small>{money(p.precio)} c/u</small></div><div className="pos-qty"><button onClick={()=>changeQty(p.id,-1)} aria-label="Restar"><Minus size={13}/></button><b>{p.quantity}</b><button onClick={()=>changeQty(p.id,1)} aria-label="Sumar"><Plus size={13}/></button></div><strong>{money(p.precio*p.quantity)}</strong></div>)}
        {!cartLines.length&&<div className="pos-empty">Aún no agregas productos.</div>}</div>
        <label className="pos-field">Descuento en pesos<input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
        <label className="pos-field">Método de pago<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="nequi">Nequi</option><option value="other">Otro</option></select></label>
        <div className="pos-total-row"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="pos-total-row"><span>Descuento</span><b>-{money(discountValue)}</b></div><div className="pos-grand-total"><span>Total a pagar</span><b>{money(total)}</b></div>
        <button className="pos-checkout" disabled={busy||!session||!cartLines.length} onClick={()=>void checkout()}>{busy?'Procesando…':<>Cobrar {money(total)} <CreditCard size={17}/></>}</button>
      </aside>
    </div>}
    {tab==='history'&&<section className="panel pos-history"><div className="pos-section-head"><div><h2>Ventas recientes</h2><small>Últimos 50 movimientos</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{sales.length?sales.map(s=><div className="pos-sale-row" key={s.id}><span className="pos-sale-icon"><Receipt size={17}/></span><div><b>{money(s.total)}</b><small>{dateTime(s.created_at)} · {s.payment_method}</small></div><strong>{s.id.slice(0,8).toUpperCase()}</strong></div>):<div className="pos-empty">Todavía no hay ventas de mostrador.</div>}</section>}
    {tab==='cash'&&<section className="panel pos-cash-panel"><span className="eyebrow">CONTROL DE CAJA</span><h2>{session?'Tu caja está abierta':'Abre una caja para comenzar'}</h2>{session?<><div className="pos-cash-summary"><div><small>Base inicial</small><b>{money(session.opening_amount)}</b></div><div><small>Abierta desde</small><b>{dateTime(session.opened_at)}</b></div></div><label className="pos-field">Dinero contado al cierre<input type="number" min="0" value={closing} onChange={e=>setClosing(e.target.value)} placeholder="Total contado en caja"/></label><button className="pos-checkout" disabled={busy||closing==='' } onClick={()=>void closeCash()}>{busy?'Procesando…':'Cerrar caja'}</button></>:<><p>Registra el dinero inicial disponible en el cajón.</p><label className="pos-field">Base inicial en efectivo<input type="number" min="0" value={opening} onChange={e=>setOpening(e.target.value)}/></label><button className="pos-checkout" disabled={busy} onClick={()=>void openCash()}>{busy?'Abriendo…':'Abrir caja'} <Banknote size={17}/></button></>}</section>}
  </section>;
}
