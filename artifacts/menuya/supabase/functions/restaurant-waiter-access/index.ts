import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://menuya-pruebas-v2.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hex=(bytes:Uint8Array)=>Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
const unhex=(value:string)=>new Uint8Array(value.match(/.{2}/g)?.map(x=>parseInt(x,16))||[]);
async function hashToken(value:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));}
async function pinHash(pin:string){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iterations=210000;
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},material,256);
  return `pbkdf2$${iterations}$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}
async function verifyPin(pin:string,stored:string){
  const [scheme,it,saltHex,hashHex]=stored.split("$");if(scheme!=="pbkdf2"||!it||!saltHex||!hashHex)return false;
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:unhex(saltHex),iterations:Number(it)},material,256));
  const expected=unhex(hashHex);if(bits.length!==expected.length)return false;
  let diff=0;for(let i=0;i<bits.length;i++)diff|=bits[i]^expected[i];return diff===0;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Método no permitido."},405);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return reply({error:"Configuración incompleta del servidor."},500);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  let body:any;try{body=await req.json();}catch{return reply({error:"Solicitud inválida."},400);}
  const action=String(body.action||"");
  if(action==="login"){
    const slug=String(body.business_slug||"").trim().toLowerCase(),businessIdInput=String(body.business_id||""),code=String(body.waiter_code||"").trim().toUpperCase(),pin=String(body.pin||"");
    if((!businessIdInput&&!slug)||!code||!/^[0-9]{4,8}$/.test(pin))return reply({error:"Ingresa el código del mesero y un PIN de 4 a 8 dígitos."},400);
    let businessId=businessIdInput;if(!businessId&&slug){const {data:b}=await admin.from("businesses").select("id,business_type").eq("slug",slug).maybeSingle();if(!b||!/restaurante/i.test(b.business_type))return reply({error:"No encontramos ese restaurante."},404);businessId=b.id;}
    const {data:w,error}=await admin.from("restaurant_waiters").select("id,business_id,display_name,pin_hash,is_active").eq("business_id",businessId).eq("waiter_code",code).maybeSingle();
    if(error)return reply({error:"No fue posible validar el acceso."},500);
    if(!w||!w.is_active||!(await verifyPin(pin,w.pin_hash)))return reply({error:"Código o PIN incorrectos."},401);
    const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await hashToken(token);
    const {error:sessionError}=await admin.from("restaurant_waiter_sessions").insert({waiter_id:w.id,business_id:w.business_id,token_hash:tokenHash,expires_at:new Date(Date.now()+12*60*60*1000).toISOString()});
    if(sessionError)return reply({error:"No fue posible iniciar la sesión."},500);
    return reply({ok:true,token,waiter:{id:w.id,name:w.display_name},business_id:w.business_id,expires_in:43200});
  }
  const authorization=req.headers.get("Authorization");
  if(authorization?.startsWith("Bearer ")){
    const token=authorization.slice(7),tokenHash=await hashToken(token);
    const {data:session}=await admin.from("restaurant_waiter_sessions").select("id,waiter_id,business_id,expires_at").eq("token_hash",tokenHash).gt("expires_at",new Date().toISOString()).maybeSingle();
    if(session){
      const {data:waiter}=await admin.from("restaurant_waiters").select("id,display_name,is_active").eq("id",session.waiter_id).eq("business_id",session.business_id).maybeSingle();
      if(!waiter?.is_active)return reply({error:"El acceso de este mesero está suspendido."},403);
      if(action==="waiter_catalog"){
        const {data,error}=await admin.from("products").select("id,name,price,image_url").eq("business_id",session.business_id).eq("is_active",true).eq("is_available",true).order("name").limit(300);
        if(error){console.error("waiter_catalog query failed",error.message,error.code);return reply({error:"Catálogo: "+error.message},500);}return reply({products:data||[]});
      }
      if(action==="waiter_tables"){
        const {data,error}=await admin.from("restaurant_tables").select("id,name,capacity,status").eq("business_id",session.business_id).neq("status","inactive").order("name");
        if(error){console.error("waiter_tables query failed",error.message,error.code);return reply({error:"Mesas: "+error.message},500);}return reply({tables:data||[]});
      }
      if(action==="waiter_orders"){
        const {data:orders,error:ordersError}=await admin.from("orders").select("id,order_number,status,total,created_at,table_id,restaurant_tables(name)").eq("business_id",session.business_id).eq("restaurant_waiter_id",waiter.id).in("status",["pending","confirmed","preparing","ready"]).order("created_at",{ascending:false}).limit(50);
        if(ordersError){console.error("waiter_orders query failed",ordersError.message,ordersError.code);return reply({error:"Pedidos: "+ordersError.message},500);}
        const orderIds=(orders||[]).map((order:any)=>order.id);
        let itemsByOrder:Record<string,any[]>={};
        if(orderIds.length){
          const {data:items,error:itemsError}=await admin.from("order_items").select("order_id,product_name,quantity,line_total").in("order_id",orderIds);
          if(itemsError){console.error("waiter_order_items query failed",itemsError.message,itemsError.code);return reply({error:"Productos de pedidos: "+itemsError.message},500);}
          for(const item of items||[]){(itemsByOrder[item.order_id] ||= []).push(item);}
        }
        return reply({orders:(orders||[]).map((order:any)=>({...order,order_items:itemsByOrder[order.id]||[]}))});
      }
      if(action==="create_order"){
        const tableId=String(body.table_id||""),items=Array.isArray(body.items)?body.items:[];
        const {data,error}=await admin.rpc("restaurant_waiter_create_order",{p_business_id:session.business_id,p_waiter_id:waiter.id,p_table_id:tableId,p_items:items,p_notes:String(body.notes||"")});
        if(error)return reply({error:error.message||"No fue posible enviar el pedido."},400);return reply({ok:true,order:data});
      }
      if(action==="logout"){await admin.from("restaurant_waiter_sessions").delete().eq("id",session.id);return reply({ok:true});}
      return reply({error:"Acción de mesero no reconocida."},400);
    }
  }
  if(!authorization?.startsWith("Bearer "))return reply({error:"Debes iniciar sesión como propietario."},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await userClient.auth.getUser();
  if(authError||!auth.user)return reply({error:"Sesión inválida."},401);
  const businessId=String(body.business_id||"");
  const {data:membership,error:memberError}=await admin.from("business_memberships").select("role,status").eq("business_id",businessId).eq("user_id",auth.user.id).eq("status","active").maybeSingle();
  if(memberError)return reply({error:"No fue posible validar permisos."},500);
  if(!membership||!["owner","admin"].includes(membership.role))return reply({error:"No tienes permisos para administrar meseros."},403);
  const {data:business}=await admin.from("businesses").select("id,business_type,slug").eq("id",businessId).maybeSingle();
  if(!business||!/restaurante/i.test(business.business_type))return reply({error:"Este módulo solo está disponible para restaurantes."},403);
  if(action==="list"){
    const {data,error}=await admin.from("restaurant_waiters").select("id,display_name,waiter_code,is_active,created_at").eq("business_id",businessId).order("created_at",{ascending:false});
    if(error)return reply({error:"No fue posible cargar los meseros."},500);
    return reply({waiters:data||[],business_slug:business.slug});
  }
  const {data:subs,error:subError}=await admin.from("subscriptions").select("plan_id,ends_at").eq("business_id",businessId).eq("status","active").order("created_at",{ascending:false}).limit(10);
  if(subError)return reply({error:"No fue posible consultar el plan."},500);
  const sub=(subs||[]).find(x=>!x.ends_at||new Date(x.ends_at).getTime()>Date.now());
  if(!sub)return reply({error:"El restaurante no tiene un plan activo."},409);
  const {data:limit}=await admin.from("restaurant_plan_limits").select("max_waiters").eq("plan_id",sub.plan_id).maybeSingle();
  if(action==="create"){
    const name=String(body.name||"").trim(),pin=String(body.pin||"");
    if(name.length<2||name.length>80||!/^[0-9]{4,8}$/.test(pin))return reply({error:"Ingresa un nombre y un PIN de 4 a 8 dígitos."},400);
    const {count,error:countError}=await admin.from("restaurant_waiters").select("id",{count:"exact",head:true}).eq("business_id",businessId);
    if(countError)return reply({error:"No fue posible verificar el cupo."},500);
    if(!limit)return reply({error:"No hay cupos de meseros configurados para tu plan."},409);
    if((count??0)>=limit.max_waiters)return reply({error:"Alcanzaste el límite de meseros de tu plan.",current:count,limit:limit.max_waiters},409);
    const random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(100000+(random[0]%900000));
    const {data,error}=await admin.from("restaurant_waiters").insert({business_id:businessId,display_name:name,waiter_code:code,pin_hash:await pinHash(pin)}).select("id,display_name,waiter_code,is_active,created_at").single();
    if(error)return reply({error:error.code==="23505"?"No se pudo generar un código único. Intenta de nuevo.":"No fue posible crear el mesero."},500);
    return reply({ok:true,waiter:data,limit:limit.max_waiters,current:(count??0)+1});
  }
  if(action==="toggle"){
    const waiterId=String(body.waiter_id||""),active=Boolean(body.is_active);
    const {data,error}=await admin.from("restaurant_waiters").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",waiterId).eq("business_id",businessId).select("id,is_active").maybeSingle();
    if(error||!data)return reply({error:"No fue posible actualizar el mesero."},400);
    if(!active)await admin.from("restaurant_waiter_sessions").delete().eq("waiter_id",waiterId);
    return reply({ok:true,waiter:data});
  }
  if(action==="reset_pin"){
    const waiterId=String(body.waiter_id||""),pin=String(body.pin||"");
    if(!/^[0-9]{4,8}$/.test(pin))return reply({error:"El PIN debe tener entre 4 y 8 dígitos."},400);
    const {data,error}=await admin.from("restaurant_waiters").update({pin_hash:await pinHash(pin),updated_at:new Date().toISOString()}).eq("id",waiterId).eq("business_id",businessId).select("id").maybeSingle();
    if(error||!data)return reply({error:"No fue posible cambiar el PIN."},400);
    await admin.from("restaurant_waiter_sessions").delete().eq("waiter_id",waiterId);
    return reply({ok:true});
  }
  return reply({error:"Acción no reconocida."},400);
});
