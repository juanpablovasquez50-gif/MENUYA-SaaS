import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Método no permitido."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return reply({error:"Servicio de pedidos no configurado."},500);
  const db=createClient(url,key,{auth:{persistSession:false}}),body=await req.json();
  const {business_id,customer,items,fulfillment_type,delivery_address,notes,payment_method}=body??{};
  if(!business_id||!customer?.name?.trim()||!customer?.phone?.trim()||!Array.isArray(items)||!items.length||items.length>50)return reply({error:"Datos del pedido incompletos."},400);
  if(!["delivery","pickup"].includes(fulfillment_type)||(fulfillment_type==="delivery"&&!String(delivery_address||"").trim()))return reply({error:"Dirección requerida para domicilio."},400);
  const {data:business}=await db.from("businesses").select("id,status,is_published").eq("id",business_id).maybeSingle();
  const {data:settings}=await db.from("store_settings").select("is_published").eq("business_id",business_id).maybeSingle();
  if(!business||business.status!=="active"||!business.is_published||!settings?.is_published)return reply({error:"La vitrina no está disponible."},409);
  const normalized=[];let subtotal=0;
  for(const item of items){
   const qty=Number(item.quantity);if(!Number.isInteger(qty)||qty<1||qty>99)return reply({error:"Cantidad no válida."},400);
   const {data:p}=await db.from("products").select("id,name,price,is_active,is_available").eq("id",item.product_id).eq("business_id",business_id).maybeSingle();
   if(!p||!p.is_active||!p.is_available)return reply({error:"Producto no disponible."},409);
   let price=Number(p.price),variantName=null;
   if(item.variant_value_id){
    const {data:v}=await db.from("product_option_values").select("id,name,extra_price,product_options!inner(product_id,option_type)").eq("id",item.variant_value_id).eq("business_id",business_id).eq("is_active",true).maybeSingle();
    if(!v||v.product_options?.product_id!==p.id||v.product_options?.option_type!=="variant")return reply({error:"Variante inválida."},400);
    price+=Number(v.extra_price||0);variantName=v.name;
   }
   const addons=[];
   for(const id of (Array.isArray(item.addon_value_ids)?item.addon_value_ids:[])){
    const {data:a}=await db.from("product_option_values").select("id,name,extra_price,product_options!inner(product_id,option_type)").eq("id",id).eq("business_id",business_id).eq("is_active",true).maybeSingle();
    if(!a||a.product_options?.product_id!==p.id||a.product_options?.option_type!=="addon")return reply({error:"Complemento inválido."},400);
    price+=Number(a.extra_price||0);addons.push({name:a.name,extra_price:Number(a.extra_price||0)});
   }
   subtotal+=price*qty;normalized.push({business_id,product_id:p.id,product_name:p.name,unit_price:price,quantity:qty,line_total:price*qty,variant_name:variantName,addons_snapshot:addons});
  }
  const phone=String(customer.phone).trim();
  let {data:saved}=await db.from("customers").select("id,total_orders,total_spent").eq("business_id",business_id).eq("phone",phone).maybeSingle();
  if(saved){const {data,error}=await db.from("customers").update({name:String(customer.name).trim(),total_orders:(saved.total_orders||0)+1,total_spent:Number(saved.total_spent||0)+subtotal,last_order_at:new Date().toISOString()}).eq("id",saved.id).select("id").single();if(error)throw error;saved={...saved,id:data.id};}
  else{const {data,error}=await db.from("customers").insert({business_id,name:String(customer.name).trim(),phone,total_orders:1,total_spent:subtotal,last_order_at:new Date().toISOString()}).select("id,total_orders,total_spent").single();if(error)throw error;saved=data;}
  const {data:last}=await db.from("orders").select("order_number").eq("business_id",business_id).order("order_number",{ascending:false}).limit(1).maybeSingle();
  const number=Number(last?.order_number||0)+1;
  const {data:order,error:oe}=await db.from("orders").insert({business_id,customer_id:saved.id,order_number:number,status:"pending",fulfillment_type,delivery_address:fulfillment_type==="delivery"?String(delivery_address).trim():null,notes:String(notes||"").trim()||null,payment_method:String(payment_method||"Efectivo"),subtotal,delivery_fee:0,total:subtotal}).select("id,created_at").single();
  if(oe)throw oe;
  const {error:ie}=await db.from("order_items").insert(normalized.map(x=>({...x,order_id:order.id})));
  if(ie){await db.from("orders").delete().eq("id",order.id).eq("business_id",business_id);throw ie;}
  return reply({order:{id:order.id,business_id,numero:number,customer_id:saved.id,items:normalized.map(x=>({product_id:x.product_id,nombre:x.product_name,precio:x.unit_price,cantidad:x.quantity,variante:x.variant_name,complementos:x.addons_snapshot})),total:subtotal,estado:"pendiente",entrega:fulfillment_type==="delivery"?"domicilio":"recoger",direccion:delivery_address,observaciones:notes||"",metodo_pago:payment_method||"Efectivo",created_at:order.created_at}});
 }catch(e){console.error("create-store-order",e);return reply({error:"No fue posible registrar el pedido. Intenta nuevamente."},500);}
});