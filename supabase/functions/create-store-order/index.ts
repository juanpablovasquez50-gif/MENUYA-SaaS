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
  const {business_id,customer,items,fulfillment_type,delivery_address,notes,payment_method,privacy_consent,privacy_policy_version}=body??{};
  if(!business_id||!customer?.name?.trim()||!customer?.phone?.trim()||!Array.isArray(items)||!items.length||items.length>50)return reply({error:"Datos del pedido incompletos."},400);
  if(privacy_consent!==true||privacy_policy_version!=="1.0")return reply({error:"Debes aceptar la política de tratamiento de datos vigente para enviar el pedido."},400);
  if(!["delivery","pickup"].includes(fulfillment_type)||(fulfillment_type==="delivery"&&!String(delivery_address||"").trim()))return reply({error:"Dirección requerida para domicilio."},400);
  const {data:business}=await db.from("businesses").select("id,status,is_published").eq("id",business_id).maybeSingle();
  const {data:settings}=await db.from("store_settings").select("is_published").eq("business_id",business_id).maybeSingle();
  if(!business||business.status!=="active"||!business.is_published||!settings?.is_published)return reply({error:"La vitrina no está disponible."},409);
  const normalized=[];let subtotal=0;

  // Load all requested products and option values in two bounded queries,
  // instead of issuing one request per cart line/variant/add-on.
  const productIds=[...new Set(items.map((item:any)=>String(item.product_id||"")))];
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(productIds.some((id:string)=>!uuidPattern.test(id)))return reply({error:"Producto no válido."},400);

  const optionValueIds:string[]=[];
  for(const item of items){
   if(Array.isArray(item.variant_selections)){
    for(const selected of item.variant_selections){
     if(!uuidPattern.test(String(selected?.value_id||"")))return reply({error:"Variante no válida."},400);
     optionValueIds.push(String(selected.value_id));
    }
   }
   if(item.variant_value_id){
    if(!uuidPattern.test(String(item.variant_value_id)))return reply({error:"Variante no válida."},400);
    optionValueIds.push(String(item.variant_value_id));
   }
   if(Array.isArray(item.addon_value_ids)){
    for(const id of item.addon_value_ids){
     if(!uuidPattern.test(String(id)))return reply({error:"Complemento no válido."},400);
     optionValueIds.push(String(id));
    }
   }
  }

  const [{data:products,error:productsError},{data:optionValues,error:optionsError}]=await Promise.all([
   db.from("products").select("id,name,price,is_active,is_available").eq("business_id",business_id).in("id",productIds),
   optionValueIds.length
    ? db.from("product_option_values").select("id,name,extra_price,product_options!inner(product_id,option_type)").eq("business_id",business_id).eq("is_active",true).in("id",[...new Set(optionValueIds)])
    : Promise.resolve({data:[],error:null})
  ]);
  if(productsError||optionsError)throw productsError||optionsError;
  const productsById=new Map((products||[]).map((product:any)=>[product.id,product]));
  const optionsById=new Map((optionValues||[]).map((value:any)=>[value.id,value]));

  for(const item of items){
   const qty=Number(item.quantity);
   if(!Number.isInteger(qty)||qty<1||qty>99)return reply({error:"Cantidad no válida."},400);
   const p:any=productsById.get(String(item.product_id));
   if(!p||!p.is_active||!p.is_available)return reply({error:"Producto no disponible."},409);
   let price=Number(p.price),variantName=null;
   const selectedVariants=[];
   for(const selected of (Array.isArray(item.variant_selections)?item.variant_selections:[])){
    const variantQty=Number(selected.quantity);
    if(!Number.isInteger(variantQty)||variantQty<1||variantQty>99)return reply({error:"Cantidad de extra no válida."},400);
    const v:any=optionsById.get(String(selected.value_id));
    if(!v||v.product_options?.product_id!==p.id||v.product_options?.option_type!=="variant")return reply({error:"Variante inválida."},400);
    price+=Number(v.extra_price||0)*variantQty;
    selectedVariants.push(`${v.name} ×${variantQty}`);
   }
   if(item.variant_value_id){
    const v:any=optionsById.get(String(item.variant_value_id));
    if(!v||v.product_options?.product_id!==p.id||v.product_options?.option_type!=="variant")return reply({error:"Variante inválida."},400);
    price+=Number(v.extra_price||0);selectedVariants.push(v.name);
   }
   variantName=selectedVariants.length?selectedVariants.join(", "):null;
   const addons=[];
   for(const id of (Array.isArray(item.addon_value_ids)?item.addon_value_ids:[])){
    const a:any=optionsById.get(String(id));
    if(!a||a.product_options?.product_id!==p.id||a.product_options?.option_type!=="addon")return reply({error:"Complemento inválido."},400);
    price+=Number(a.extra_price||0);addons.push({name:a.name,extra_price:Number(a.extra_price||0)});
   }
   subtotal+=price*qty;
   normalized.push({business_id,product_id:p.id,product_name:p.name,unit_price:price,quantity:qty,line_total:price*qty,variant_name:variantName,addons_snapshot:addons});
  }
  const trackingToken=crypto.randomUUID();
  const consentAt=new Date().toISOString();
  const {data:created,error:createError}=await db.rpc("create_storefront_order_atomic",{
   p_business_id:business_id,
   p_customer_name:String(customer.name).trim(),
   p_customer_phone:String(customer.phone).trim(),
   p_order_data:{
    fulfillment_type,
    delivery_address:fulfillment_type==="delivery"?String(delivery_address).trim():null,
    notes:String(notes||"").trim()||null,
    payment_method:String(payment_method||"Efectivo"),
    privacy_policy_version,
    privacy_consent_at:consentAt,
    subtotal,
    delivery_fee:0,
    total:subtotal,
    tracking_token:trackingToken
   },
   p_items:normalized
  });
  if(createError)throw createError;
  if(!created?.id||!created?.customer_id||!created?.order_number)throw new Error("La base de datos no devolvió la confirmación del pedido.");
  const order={id:created.id,created_at:created.created_at};
  const number=Number(created.order_number);
  const customerId=created.customer_id;
  const pushSecret=Deno.env.get("CLICKOK_PUSH_DISPATCH_SECRET");
  if(pushSecret){
   try{
    EdgeRuntime.waitUntil(fetch(`${url}/functions/v1/send-store-order-push`,{method:"POST",headers:{"Content-Type":"application/json","apikey":key,"Authorization":`Bearer ${key}`,"x-clickok-push-secret":pushSecret},body:JSON.stringify({business_id,order_number:number,customer_name:String(customer.name).trim(),total:new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(subtotal)})}).then(response=>{if(!response.ok)console.error("Push delivery returned",response.status);}).catch(pushError=>console.error("No se pudo despachar el aviso push; el pedido quedó registrado.",pushError)));
   }catch(pushError){console.error("No se pudo despachar el aviso push; el pedido quedó registrado.",pushError);}
  }
  return reply({order:{id:order.id,business_id,numero:number,customer_id:customerId,tracking_token:trackingToken,items:normalized.map(x=>({product_id:x.product_id,nombre:x.product_name,precio:x.unit_price,cantidad:x.quantity,variante:x.variant_name,complementos:x.addons_snapshot})),total:subtotal,estado:"pendiente",entrega:fulfillment_type==="delivery"?"domicilio":"recoger",direccion:delivery_address,observaciones:notes||"",metodo_pago:payment_method||"Efectivo",created_at:order.created_at}});
 }catch(e){console.error("create-store-order",e);return reply({error:"No fue posible registrar el pedido. Intenta nuevamente."},500);}
});