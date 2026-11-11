import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, CheckCircle2, Clock3, CreditCard, Minus, Plus, Receipt, Search, ShoppingCart, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/menuya-data';
import './pos.css';

type PosVariant = {id:string;sku:string|null;size:string;color:string;stock:number;price_adjustment:number};
type PosProduct = Pick<Product, 'id'|'nombre'|'precio'|'imagen'|'stock'|'activo'|'disponible'> & {inventario_variantes:PosVariant[]};
type CashSession = { id:string; opening_amount:number; status:string; opened_at:string; branch_id:string|null };
type Sale = { id:string; total:number; subtotal:number; discount:number; payment_method:string; created_at:string };
type CashMovement = { total:number; payment_method:string };
type CashHistory = {id:string;opening_amount:number;closing_amount:number|null;expected_amount:number|null;cash_sales_amount:number|null;transfer_sales_amount:number|null;card_sales_amount:number|null;other_sales_amount:number|null;cash_difference:number|null;opened_at:string;closed_at:string|null};
type PosOption = {id:string;product_id:string;name:string;option_type:string;is_required:boolean;values:{id:string;name:string;extra_price:number}[]};
type CartLine = {key:string;product:PosProduct;quantity:number;selections:{option_id:string;value_id:string}[];extrasTotal:number;variantId:string|null;variantName:string|null};
type StorefrontOrder = {id:string;order_number:number;status:string;total:number;created_at:string;fulfillment_type:string;delivery_address:string|null;notes:string|null;subtotal:number;delivery_fee:number;customer_id:string|null;customers:{name:string;phone:string|null}|null;order_items:{order_id:string;product_id:string|null;product_name:string;quantity:number;unit_price:number;line_total:number;variant_name:string|null;addons_snapshot:any}[]};
type ServiceOrder = {id:string;service_name:string;quantity:number;unit_price:number;total:number;customer_name:string|null;scheduled_at:string|null;notes:string|null;created_at:string};

const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const dateTime=(s:string)=>new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(new Date(s));

export default function PointOfSale({businessId,businessType,servicesEnabled=false}:{businessId:string;businessType:string;servicesEnabled?:boolean}) {
  const normalizedBusinessType = businessType.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const foodBusiness = /restaurante|panaderia|cafeteria|comida|reposteria|pasteleria|bar\b/.test(normalizedBusinessType);
  const optionInstruction = /ropa|calzado|zapater|moda/.test(normalizedBusinessType) ? 'Selecciona la talla o el color solicitado.' : /tecnolog|electron|comput/.test(normalizedBusinessType) ? 'Selecciona el modelo o la especificación del equipo.' : /barber|belleza|peluquer|servicio/.test(normalizedBusinessType) ? 'Selecciona la modalidad o característica del servicio.' : foodBusiness ? 'Selecciona las variantes y adicionales del producto.' : 'Selecciona las características o variantes del producto.';
  const [products,setProducts]=useState<PosProduct[]>([]);
  const [session,setSession]=useState<CashSession|null>(null);
  const [sales,setSales]=useState<Sale[]>([]);
  const [tableOrders,setTableOrders]=useState<any[]>([]);
  const [storefrontOrders,setStorefrontOrders]=useState<StorefrontOrder[]>([]);
  const [selectedStorefrontOrder,setSelectedStorefrontOrder]=useState<StorefrontOrder|null>(null);
  const [serviceOrders,setServiceOrders]=useState<ServiceOrder[]>([]);
  const [selectedServiceOrder,setSelectedServiceOrder]=useState<ServiceOrder|null>(null);
  const [selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
  const [cashMovements,setCashMovements]=useState<CashMovement[]>([]);
  const [cashHistory,setCashHistory]=useState<CashHistory[]>([]);
  const [cart,setCart]=useState<CartLine[]>([]);
  const [productOptions,setProductOptions]=useState<PosOption[]>([]);
  const [selectedVariantId,setSelectedVariantId]=useState('');
  const [configuring,setConfiguring]=useState<PosProduct|null>(null);
  const [optionSelections,setOptionSelections]=useState<Record<string,string[]>>({});
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState<'sale'|'table-orders'|'storefront-orders'|'service-orders'|'history'|'cash'|'cash-history'>('sale');
  const [opening,setOpening]=useState('0');
  const [closing,setClosing]=useState('');
  const [payment,setPayment]=useState('cash');
  const [discount,setDiscount]=useState('0');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    const [p,c,s,o,v,variantInventory,ch,orders,storefront,services]=await Promise.all([
      supabase.from('products').select('id,name,price,image_url,stock,is_active,is_available').eq('business_id',businessId).eq('is_active',true).eq('is_available',true).order('name'),
      supabase.from('cash_sessions').select('id,opening_amount,status,opened_at,branch_id').eq('business_id',businessId).eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('sales').select('id,total,subtotal,discount,payment_method,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(50),
      supabase.from('product_options').select('id,product_id,name,option_type,is_required').eq('business_id',businessId).order('sort_order'),
      supabase.from('product_option_values').select('id,option_id,name,extra_price').eq('business_id',businessId).eq('is_active',true).order('sort_order'),
      supabase.from('product_variant_inventory').select('id,business_id,product_id,sku,size,color,stock,price_adjustment,is_active').eq('business_id',businessId).eq('is_active',true).order('size'),
      supabase.from('cash_sessions').select('id,opening_amount,closing_amount,expected_amount,cash_sales_amount,transfer_sales_amount,card_sales_amount,other_sales_amount,cash_difference,opened_at,closed_at').eq('business_id',businessId).eq('status','closed').order('closed_at',{ascending:false}).limit(50),
      supabase.from('orders').select('id,order_number,status,total,created_at,table_id,restaurant_tables(name)').eq('business_id',businessId).not('table_id','is',null).in('status',['pending','confirmed','preparing','ready']).order('created_at',{ascending:true}).limit(100),
      supabase.from('orders').select('id,order_number,status,total,created_at,fulfillment_type,delivery_address,notes,subtotal,delivery_fee,customer_id,customers!orders_customer_id_fkey(name,phone)').eq('business_id',businessId).is('table_id',null).is('waiter_user_id',null).is('restaurant_waiter_id',null).in('status',['pending','confirmed','preparing','ready']).order('created_at',{ascending:true}).limit(100),
      supabase.from('service_orders').select('id,service_name,quantity,unit_price,total,customer_name,scheduled_at,notes,created_at').eq('business_id',businessId).eq('status','pending').is('sale_id',null).order('created_at',{ascending:true}).limit(100)
    ]);
    if(p.error||c.error||s.error||o.error||v.error||variantInventory.error||ch.error||orders.error||storefront.error||services.error) throw p.error||c.error||s.error||o.error||v.error||variantInventory.error||ch.error||orders.error||storefront.error||services.error;
    const orderIds=[...(orders.data||[]),...(storefront.data||[])].map(order=>order.id);
    let orderItems:any[]=[];
    if(orderIds.length){
      const {data:items,error:itemsError}=await supabase.from('order_items').select('order_id,product_id,product_name,quantity,unit_price,line_total,variant_name,addons_snapshot').in('order_id',orderIds);
      if(itemsError) throw itemsError;
      orderItems=items||[];
    }
    setProductOptions((o.data||[]).map(option=>({...option,values:(v.data||[]).filter(value=>value.option_id===option.id).map(value=>({...value,extra_price:Number(value.extra_price||0)}))})));
    setProducts((p.data||[]).map(x=>({id:x.id,nombre:x.name,precio:Number(x.price),imagen:x.image_url||undefined,stock:x.stock===null?undefined:Number(x.stock),activo:x.is_active,disponible:x.is_available,inventario_variantes:(variantInventory.data||[]).filter(row=>row.product_id===x.id).map(row=>({id:row.id,sku:row.sku,size:row.size,color:row.color,stock:Number(row.stock||0),price_adjustment:Number(row.price_adjustment||0)}))})));
    setSession(c.data?{...c.data,opening_amount:Number(c.data.opening_amount)}:null);
    setSales((s.data||[]).map(x=>({...x,total:Number(x.total),subtotal:Number(x.subtotal),discount:Number(x.discount)})));
    setTableOrders((orders.data||[]).map(order=>({...order,order_items:orderItems.filter(item=>item.order_id===order.id)})));
    setStorefrontOrders((storefront.data||[]).map(order=>({...order,total:Number(order.total||0),subtotal:Number(order.subtotal||0),delivery_fee:Number(order.delivery_fee||0),customers:Array.isArray(order.customers)?order.customers[0]||null:order.customers,order_items:orderItems.filter(item=>item.order_id===order.id)})));
    setServiceOrders((services.data||[]).map(item=>({...item,quantity:Number(item.quantity||0),unit_price:Number(item.unit_price||0),total:Number(item.total||0)})));
    setCashHistory((ch.data||[]).map(x=>({...x,opening_amount:Number(x.opening_amount||0),closing_amount:x.closing_amount===null?null:Number(x.closing_amount),expected_amount:x.expected_amount===null?null:Number(x.expected_amount),cash_sales_amount:x.cash_sales_amount===null?null:Number(x.cash_sales_amount),transfer_sales_amount:x.transfer_sales_amount===null?null:Number(x.transfer_sales_amount),card_sales_amount:x.card_sales_amount===null?null:Number(x.card_sales_amount),other_sales_amount:x.other_sales_amount===null?null:Number(x.other_sales_amount),cash_difference:x.cash_difference===null?null:Number(x.cash_difference)})));
    if(c.data){const {data:movements,error:movementError}=await supabase.from('sales').select('total,payment_method').eq('business_id',businessId).eq('cash_session_id',c.data.id);if(movementError)throw movementError;setCashMovements((movements||[]).map(x=>({total:Number(x.total||0),payment_method:x.payment_method||''})));}else setCashMovements([]);
  },[businessId]);

  useEffect(()=>{load().catch(e=>setError(e.message||'No se pudo cargar el punto de venta.'));},[load]);
  useEffect(()=>{
    const channel=supabase.channel(`pos-storefront-orders-${businessId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`business_id=eq.${businessId}`},()=>{
        void load().catch(e=>setError(e.message||'No se pudieron actualizar los pedidos recibidos.'));
      })
      .subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[businessId,load]);
  const cartLines=cart;
  const subtotal=selectedServiceOrder?selectedServiceOrder.total:selectedStorefrontOrder?selectedStorefrontOrder.subtotal:cartLines.reduce((sum,line)=>sum+(line.product.precio+line.extrasTotal)*line.quantity,0);
  const discountValue=Math.max(0,Math.min(subtotal,Number(discount)||0));
  const total=selectedStorefrontOrder?selectedStorefrontOrder.total:subtotal-discountValue;
  const filtered=products.filter(p=>p.nombre.toLowerCase().includes(search.toLowerCase()));
  const paymentTotals=useMemo(()=>cashMovements.reduce((acc,sale)=>{const method=String(sale.payment_method||'').toLowerCase();const amount=Number(sale.total||0);if(['cash','efectivo'].includes(method))acc.cash+=amount;else if(['transfer','transferencia','nequi'].includes(method))acc.transfer+=amount;else if(['card','tarjeta'].includes(method))acc.card+=amount;else acc.other+=amount;return acc;},{cash:0,transfer:0,card:0,other:0}),[cashMovements]);
  const expectedCash=(session?.opening_amount||0)+paymentTotals.cash;
  const countedCash=Math.max(0,Number(closing)||0);
  const cashDifference=countedCash-expectedCash;

  const addConfiguredProduct=(product:PosProduct)=>{if(selectedServiceOrder||selectedStorefrontOrder||selectedOrderId){setError('Quita el pedido o servicio seleccionado antes de iniciar una venta nueva.');return;}const availableOptions=productOptions.filter(option=>option.product_id===product.id&&option.values.length>0);if(availableOptions.length||product.inventario_variantes.length){setConfiguring(product);setOptionSelections({});setSelectedVariantId('');return;}addCartLine(product,[]);};
  const addCartLine=(product:PosProduct,selections:{option_id:string;value_id:string}[],variantId:string|null=null)=>{const variant=product.inventario_variantes.find(row=>row.id===variantId);const extrasTotal=selections.reduce((sum,selection)=>{const option=productOptions.find(item=>item.id===selection.option_id);const value=option?.values.find(item=>item.id===selection.value_id);return sum+(value?.extra_price||0);},0)+(variant?.price_adjustment||0);const variantName=variant?`${variant.size} · ${variant.color}`:null;const key=product.id+':'+(variantId||'')+':'+selections.map(item=>item.option_id+'='+item.value_id).sort().join(',');setCart(prev=>{const existing=prev.find(line=>line.key===key);const quantity=(existing?.quantity||0)+1;const productQty=prev.filter(line=>line.product.id===product.id).reduce((n,line)=>n+line.quantity,0);if(variant&&quantity>variant.stock)return prev;if(!variant&&product.stock!==undefined&&productQty+1>product.stock)return prev;if(existing)return prev.map(line=>line.key===key?{...line,quantity}:line);return [...prev,{key,product,quantity,selections,extrasTotal,variantId,variantName}];});};
  const confirmOptions=()=>{if(!configuring)return;const options=productOptions.filter(option=>option.product_id===configuring.id&&option.values.length>0);const missing=options.find(option=>option.is_required&&!(optionSelections[option.id]||[]).length);if(missing){setError(`Selecciona una opción obligatoria: ${missing.name}.`);return;}if(configuring.inventario_variantes.length&&!selectedVariantId){setError('Selecciona la talla y el color.');return;}const selections=options.flatMap(option=>(optionSelections[option.id]||[]).map(value_id=>({option_id:option.id,value_id})));addCartLine(configuring,selections,selectedVariantId||null);setConfiguring(null);setOptionSelections({});setSelectedVariantId('');setError('');};
  const changeQty=(key:string,delta:number)=>{setCart(prev=>prev.flatMap(line=>{if(line.key!==key)return [line];const next=line.quantity+delta;if(next<=0)return [];const productQty=prev.filter(item=>item.product.id===line.product.id).reduce((n,item)=>n+item.quantity,0);const variantStock=line.variantId?line.product.inventario_variantes.find(row=>row.id===line.variantId)?.stock:undefined;if(delta>0&&variantStock!==undefined&&next>variantStock)return [line];if(delta>0&&!line.variantId&&line.product.stock!==undefined&&productQty>=line.product.stock)return [line];return [{...line,quantity:next}];}));};
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
    if(!cartLines.length&&!selectedStorefrontOrder&&!selectedServiceOrder){setError('Agrega productos o selecciona un pedido o servicio pendiente.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const {data,error}=selectedServiceOrder
        ? await supabase.rpc('pos_register_service_order_sale',{p_business_id:businessId,p_service_order_id:selectedServiceOrder.id,p_cash_session_id:session.id,p_payment_method:payment,p_discount:discountValue,p_branch_id:session.branch_id})
        : selectedStorefrontOrder
        ? await supabase.rpc('pos_register_storefront_order_sale',{p_business_id:businessId,p_order_id:selectedStorefrontOrder.id,p_cash_session_id:session.id,p_payment_method:payment,p_branch_id:session.branch_id})
        : selectedOrderId
        ? await supabase.rpc('pos_register_order_sale',{p_business_id:businessId,p_order_id:selectedOrderId,p_cash_session_id:session.id,p_payment_method:payment,p_discount:discountValue,p_branch_id:session.branch_id})
        : await supabase.rpc('pos_register_sale',{p_business_id:businessId,p_cash_session_id:session.id,p_payment_method:payment,p_discount:discountValue,p_items:cartLines.map(line=>({product_id:line.product.id,quantity:line.quantity,variant_id:line.variantId,selected_options:line.selections})),p_branch_id:session.branch_id});
      if(error)throw error;
      setCart([]);setSelectedOrderId(null);setSelectedStorefrontOrder(null);setSelectedServiceOrder(null);setDiscount('0');setNotice('Venta registrada. Inventario actualizado.');await load();
    }catch(e){const detail=e as {message?:string;details?:string;hint?:string;code?:string};setError([detail?.message,detail?.details,detail?.hint].filter(Boolean).join(' · ')||'No fue posible registrar la venta.');}
    finally{setBusy(false);}
  };
  const closeCash=async()=>{
    if(!session)return;
    setBusy(true);setError('');setNotice('');
    try{
      const amount=Math.max(0,Number(closing)||0);
      const expected=expectedCash;
      const {data:userResult,error:userError}=await supabase.auth.getUser();if(userError)throw userError;
      const {error}=await supabase.from('cash_sessions').update({status:'closed',closed_at:new Date().toISOString(),closed_by:userResult.user?.id,closing_amount:amount,expected_amount:expected,cash_sales_amount:paymentTotals.cash,transfer_sales_amount:paymentTotals.transfer,card_sales_amount:paymentTotals.card,other_sales_amount:paymentTotals.other,cash_difference:amount-expected}).eq('id',session.id).eq('business_id',businessId);
      if(error)throw error;setSession(null);setClosing('');setNotice('Caja cerrada correctamente.');await load();
    }catch(e){setError(e instanceof Error?e.message:'No fue posible cerrar la caja.');}
    finally{setBusy(false);}
  };

  return <section className="pos-root">
    <header className="pos-heading"><div><span className="eyebrow">OPERACIÓN DEL COMERCIO</span><h1>Punto de venta</h1><p>Vende en mostrador y mantén el inventario sincronizado con tu tienda.</p></div><div className={`pos-cash-state ${session?'is-open':''}`}><span/>{session?'Caja abierta':'Caja cerrada'}</div></header>
    <nav className="pos-tabs">
      <button className={tab==='sale'?'active':''} onClick={()=>setTab('sale')}><ShoppingCart size={16}/> Nueva venta</button>
      {foodBusiness&&<button className={tab==='table-orders'?'active':''} onClick={()=>setTab('table-orders')}><Receipt size={16}/> Pedidos de mesa ({tableOrders.length})</button>}
      <button className={tab==='storefront-orders'?'active':''} onClick={()=>setTab('storefront-orders')}><Receipt size={16}/> Pedidos recibidos ({storefrontOrders.length})</button>
      {servicesEnabled&&<button className={tab==='service-orders'?'active':''} onClick={()=>setTab('service-orders')}><CheckCircle2 size={16}/> Servicios ({serviceOrders.length})</button>}
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><Receipt size={16}/> Historial</button>
      <button className={tab==='cash'?'active':''} onClick={()=>setTab('cash')}><Wallet size={16}/> Caja</button>
      <button className={tab==='cash-history'?'active':''} onClick={()=>setTab('cash-history')}><Clock3 size={16}/> Arqueos</button>
    </nav>
    {notice&&<div className="pos-notice"><CheckCircle2 size={16}/>{notice}</div>}
    {error&&<div className="pos-error"><AlertCircle size={16}/>{error}</div>}
    {servicesEnabled&&tab==='service-orders'&&<section className="panel pos-history"><div className="pos-section-head"><div><h2>Servicios pendientes</h2><small>Solicitudes de servicios que aún no se han cobrado.</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{serviceOrders.length?serviceOrders.map(item=><article className="pos-sale-row" key={item.id}><span className="pos-sale-icon"><CheckCircle2 size={17}/></span><div><b>{item.service_name}</b><small>{item.customer_name||'Sin cliente'} · {item.quantity} unidad(es){item.scheduled_at?' · '+dateTime(item.scheduled_at):''}</small>{item.notes&&<small>{item.notes}</small>}</div><strong>{money(item.total)}</strong><button className="pos-refresh" onClick={()=>{setCart([]);setSelectedOrderId(null);setSelectedStorefrontOrder(null);setSelectedServiceOrder(item);setDiscount('0');setTab('sale');setNotice('Servicio cargado. Confirma el medio de pago y cobra.');setError('');}}>Cobrar servicio</button></article>):<div className="pos-empty">No hay servicios pendientes de cobro.</div>}</section>}
    {tab==='table-orders'&&<section className="panel pos-history"><div className="pos-section-head"><div><h2>Pedidos de meseros</h2><small>Pedidos activos listos para cobrar en esta caja.</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{tableOrders.length?tableOrders.map(order=><article className="pos-sale-row" key={order.id}><span className="pos-sale-icon"><Receipt size={17}/></span><div><b>Pedido #{order.order_number} · {order.restaurant_tables?.name||'Mesa'}</b><small>{dateTime(order.created_at)} · {order.status} · {order.order_items?.length||0} productos</small></div><strong>{money(Number(order.total))}</strong><button className="pos-refresh" onClick={()=>{const lines=(order.order_items||[]).map((item:any)=>{const p=products.find(x=>x.id===item.product_id);if(!p)return null;return {key:p.id+':table:'+order.id,product:p,quantity:Number(item.quantity),selections:[],extrasTotal:0};}).filter(Boolean) as CartLine[];if(!lines.length){setError('No se pudieron cargar los productos de este pedido.');return;}setCart(lines);setSelectedOrderId(order.id);setSelectedStorefrontOrder(null);setSelectedServiceOrder(null);setDiscount('0');setTab('sale');setNotice('Pedido de mesa cargado. Abre la caja y cobra para cerrar la mesa.');}}>Cobrar pedido</button></article>):<div className="pos-empty">No hay pedidos de mesa pendientes de cobro.</div>}</section>}
    {tab==='storefront-orders'&&<section className="panel pos-history"><div className="pos-section-head"><div><h2>Pedidos recibidos</h2><small>Pedidos de clientes y de todos los canales que todavía no han sido cobrados en el POS.</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{storefrontOrders.length?storefrontOrders.map(order=><article className="pos-sale-row" key={order.id}><span className="pos-sale-icon"><ShoppingCart size={17}/></span><div><b>Pedido #{order.order_number} · {order.customers?.name||'Cliente'}</b><small>{dateTime(order.created_at)} · {order.fulfillment_type==='delivery'?'Domicilio':'Recoger en tienda'} · {order.order_items.length} producto(s)</small>{order.delivery_address&&<small>Dirección: {order.delivery_address}</small>}{order.notes&&<small>Nota: {order.notes}</small>}</div><strong>{money(order.total)}</strong><button className="pos-refresh" onClick={()=>{setCart([]);setSelectedOrderId(null);setSelectedStorefrontOrder(order);setSelectedServiceOrder(null);setDiscount('0');setTab('sale');setNotice('Pedido cargado. Confirma el medio de pago y cobra.');setError('');}}>Cobrar pedido</button></article>):<div className="pos-empty">No hay pedidos pendientes de cobro.</div>}</section>}
    {tab==='sale'&&<div className="pos-layout">
      <div className="pos-catalog panel"><div className="pos-catalog-head"><div><h2>Productos</h2><small>Selecciona para agregar a la venta</small></div><label className="pos-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto"/></label></div>
        {configuring&&<div className="pos-inline-config"><div className="pos-section-head"><div><h3>{configuring.nombre}</h3><small>{optionInstruction}</small></div><button className="pos-refresh" onClick={()=>{setConfiguring(null);setOptionSelections({});setSelectedVariantId('');}}>Cancelar</button></div>{configuring.inventario_variantes.length>0&&<fieldset className="pos-option-group"><legend>Talla y color · Obligatorio</legend>{configuring.inventario_variantes.map(variant=><label key={variant.id}><input type="radio" name="clothing-variant" checked={selectedVariantId===variant.id} disabled={variant.stock<=0} onChange={()=>setSelectedVariantId(variant.id)}/><span>{variant.size} · {variant.color}{variant.sku?' · '+variant.sku:''}</span><b>{variant.stock} disp. {variant.price_adjustment>0?' · +'+money(variant.price_adjustment):''}</b></label>)}</fieldset>}{productOptions.filter(option=>option.product_id===configuring.id&&option.values.length>0).map(option=><fieldset className="pos-option-group" key={option.id}><legend>{option.name} · {option.is_required?"Obligatorio":"Opcional"}</legend>{option.values.map(value=><label key={value.id}><input type={option.option_type==="variant"?"radio":"checkbox"} name={option.id} checked={(optionSelections[option.id]||[]).includes(value.id)} onChange={event=>setOptionSelections(prev=>({...prev,[option.id]:option.option_type==="variant"?[value.id]:event.target.checked?[...(prev[option.id]||[]),value.id]:(prev[option.id]||[]).filter(id=>id!==value.id)}))}/><span>{value.name}</span><b>{value.extra_price>0?"+"+money(value.extra_price):"Incluido"}</b></label>)}</fieldset>)}<div className="pos-option-actions">{!productOptions.some(option=>option.product_id===configuring.id&&option.values.length>0&&option.is_required)&&<button className="pos-add-base" onClick={()=>{if(configuring){addCartLine(configuring,[]);setConfiguring(null);setOptionSelections({});setError('');}}}>Agregar sin variantes</button>}<button className="pos-checkout" onClick={confirmOptions}>Agregar con selección</button></div></div>}
        <div className="pos-products">{filtered.map(p=><button className="pos-product" key={p.id} onClick={()=>addConfiguredProduct(p)} disabled={p.stock!==undefined&&p.stock<=0}><span className="pos-product-image">{p.imagen?<img src={p.imagen} alt=""/>:<ShoppingCart size={22}/>}</span><b>{p.nombre}</b><strong>{money(p.precio)}</strong><small>{p.stock===undefined?'Stock no controlado':`${p.stock} disponibles`}</small></button>)}</div>
      </div>
      <aside className="pos-cart panel"><div className="pos-cart-title"><div><h2>Venta actual</h2><small>{selectedServiceOrder?selectedServiceOrder.quantity:selectedStorefrontOrder?selectedStorefrontOrder.order_items.reduce((n,item)=>n+Number(item.quantity),0):cartLines.reduce((n,line)=>n+line.quantity,0)} unidades</small></div><ShoppingCart size={19}/></div>
        {!session&&<div className="pos-callout"><AlertCircle size={17}/> Debes abrir la caja para cobrar.</div>}
        <div className="pos-cart-lines">{selectedServiceOrder&&<div className="pos-cart-line"><div><b>{selectedServiceOrder.service_name}</b><small>Servicio · {selectedServiceOrder.customer_name||'Sin cliente'}{selectedServiceOrder.scheduled_at?' · '+dateTime(selectedServiceOrder.scheduled_at):''}</small>{selectedServiceOrder.notes&&<small>{selectedServiceOrder.notes}</small>}</div><strong>{money(selectedServiceOrder.total)}</strong><button className="pos-refresh" onClick={()=>setSelectedServiceOrder(null)}>Quitar</button></div>}{selectedStorefrontOrder&&<div className="pos-storefront-order-summary"><b>Pedido #{selectedStorefrontOrder.order_number} · {selectedStorefrontOrder.customers?.name||'Cliente'}</b><small>{selectedStorefrontOrder.fulfillment_type==='delivery'?'Domicilio':'Recoger en tienda'}{selectedStorefrontOrder.delivery_address?' · '+selectedStorefrontOrder.delivery_address:''}</small>{selectedStorefrontOrder.order_items.map((item,index)=><div className="pos-cart-line" key={selectedStorefrontOrder.id+':'+index}><div><b>{item.product_name}</b><small>{item.variant_name||''}{item.addons_snapshot&&Array.isArray(item.addons_snapshot)&&item.addons_snapshot.length?' · '+item.addons_snapshot.map((x:any)=>x.name||x.nombre).filter(Boolean).join(', '):''}</small></div><span>{item.quantity} × {money(Number(item.unit_price))}</span><strong>{money(Number(item.line_total))}</strong></div>)}{selectedStorefrontOrder.delivery_fee>0&&<div className="pos-total-row"><span>Domicilio</span><b>{money(selectedStorefrontOrder.delivery_fee)}</b></div>}{selectedStorefrontOrder.notes&&<small>Nota del cliente: {selectedStorefrontOrder.notes}</small>}</div>}{cartLines.map(line=><div className="pos-cart-line" key={line.key}><div><b>{line.product.nombre}</b><small>{money(line.product.precio+line.extrasTotal)} c/u{line.variantName?" · "+line.variantName:""}{line.selections.length?" · Extras: "+line.selections.map(selection=>{const option=productOptions.find(item=>item.id===selection.option_id);return option?.values.find(value=>value.id===selection.value_id)?.name;}).filter(Boolean).join(", "):""}</small></div><div className="pos-qty"><button onClick={()=>changeQty(line.key,-1)} aria-label="Restar"><Minus size={13}/></button><b>{line.quantity}</b><button onClick={()=>changeQty(line.key,1)} aria-label="Sumar"><Plus size={13}/></button></div><strong>{money((line.product.precio+line.extrasTotal)*line.quantity)}</strong></div>)}
        {!cartLines.length&&!selectedStorefrontOrder&&!selectedServiceOrder&&<div className="pos-empty">Aún no agregas productos.</div>}</div>
        {!selectedStorefrontOrder&&<label className="pos-field">Descuento en pesos<input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(e.target.value)}/></label>}
        <label className="pos-field">Método de pago<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="nequi">Nequi</option><option value="other">Otro</option></select></label>
        <div className="pos-total-row"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="pos-total-row"><span>Descuento</span><b>-{money(discountValue)}</b></div><div className="pos-grand-total"><span>Total a pagar</span><b>{money(total)}</b></div>
        <button className="pos-checkout" disabled={busy||!session||(!cartLines.length&&!selectedStorefrontOrder&&!selectedServiceOrder)} onClick={()=>void checkout()}>{busy?'Procesando…':<>Cobrar {money(total)} <CreditCard size={17}/></>}</button>
      </aside>
    </div>}
    {tab==='history'&&<section className="panel pos-history"><div className="pos-section-head"><div><h2>Ventas recientes</h2><small>Últimos 50 movimientos</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{sales.length?sales.map(s=><div className="pos-sale-row" key={s.id}><span className="pos-sale-icon"><Receipt size={17}/></span><div><b>{money(s.total)}</b><small>{dateTime(s.created_at)} · {s.payment_method}</small></div><strong>{s.id.slice(0,8).toUpperCase()}</strong></div>):<div className="pos-empty">Todavía no hay ventas de mostrador.</div>}</section>}
    {tab==='cash-history'&&<section className="panel pos-cash-history"><div className="pos-section-head"><div><h2>Historial de arqueos</h2><small>Últimos 50 cierres de caja</small></div><button className="pos-refresh" onClick={()=>void load()}>Actualizar</button></div>{cashHistory.length?cashHistory.map(item=><article className="pos-cash-history-row" key={item.id}><div className="pos-cash-history-head"><div><b>Cierre de caja</b><small>Abrió: {dateTime(item.opened_at)}</small><small>Cerró: {item.closed_at?dateTime(item.closed_at):'Sin hora de cierre'}</small></div><strong>{money(item.closing_amount??0)}</strong></div><div className="pos-cash-history-grid"><div><small>Base inicial</small><b>{money(item.opening_amount)}</b></div><div><small>Efectivo esperado</small><b>{money(item.expected_amount??0)}</b></div><div><small>Ventas en efectivo</small><b>{money(item.cash_sales_amount??0)}</b></div><div><small>Transferencias</small><b>{money(item.transfer_sales_amount??0)}</b></div><div><small>Tarjetas</small><b>{money(item.card_sales_amount??0)}</b></div><div><small>Otros medios</small><b>{money(item.other_sales_amount??0)}</b></div><div><small>Diferencia</small><b className={(item.cash_difference??0)<0?'is-negative':(item.cash_difference??0)>0?'is-positive':''}>{money(item.cash_difference??0)}</b></div></div></article>):<div className="pos-empty">Todavía no hay arqueos cerrados.</div>}</section>}
    {tab==='cash'&&<section className="panel pos-cash-panel"><span className="eyebrow">CONTROL DE CAJA</span><h2>{session?'Tu caja está abierta':'Abre una caja para comenzar'}</h2>{session?<><div className="pos-cash-summary"><div><small>Base inicial</small><b>{money(session.opening_amount)}</b></div><div><small>Abierta desde</small><b>{dateTime(session.opened_at)}</b></div></div><div className="pos-cash-summary"><div><small>Ventas en efectivo</small><b>{money(paymentTotals.cash)}</b></div><div><small>Efectivo esperado</small><b>{money(expectedCash)}</b></div><div><small>Transferencias / Nequi</small><b>{money(paymentTotals.transfer)}</b></div><div><small>Tarjetas</small><b>{money(paymentTotals.card)}</b></div><div><small>Otros medios</small><b>{money(paymentTotals.other)}</b></div><div><small>Total vendido</small><b>{money(paymentTotals.cash+paymentTotals.transfer+paymentTotals.card+paymentTotals.other)}</b></div></div><label className="pos-field">Dinero contado físicamente<input type="number" min="0" value={closing} onChange={e=>setClosing(e.target.value)} placeholder="Total de efectivo en caja"/></label>{closing!==''&&<div className="pos-cash-summary"><div><small>Diferencia de efectivo</small><b>{money(cashDifference)}</b></div><div><small>Transferencias registradas</small><b>{money(paymentTotals.transfer)}</b></div></div>}<p className="pos-cash-hint">Las transferencias y pagos digitales se muestran aparte; no se suman al efectivo físico.</p><button className="pos-checkout" disabled={busy||closing==='' } onClick={()=>void closeCash()}>{busy?'Procesando…':'Cerrar caja y guardar arqueo'}</button></>:<><p>Registra el dinero inicial disponible en el cajón.</p><label className="pos-field">Base inicial en efectivo<input type="number" min="0" value={opening} onChange={e=>setOpening(e.target.value)}/></label><button className="pos-checkout" disabled={busy} onClick={()=>void openCash()}>{busy?'Abriendo…':'Abrir caja'} <Banknote size={17}/></button></>}</section>}
  </section>;
}
