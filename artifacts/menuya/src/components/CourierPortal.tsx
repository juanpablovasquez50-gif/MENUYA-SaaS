import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import MapboxDeliveryMap from './MapboxDeliveryMap';
import {Bike,MapPin,Navigation,LogOut,RefreshCw,CheckCircle2,Package,MapPinned,Clock3,Route,LocateFixed} from 'lucide-react';
type Assignment={id:string;status:string;orders:any};
const money=(v:any)=>Number(v||0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
declare global { interface Window { google?: any } }
const loadGoogleMaps=async()=>{
 if(window.google?.maps){await Promise.all([window.google.maps.importLibrary('maps'),window.google.maps.importLibrary('geocoding')]);return;}
 const key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
 if(!key)throw new Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY en Render.');
 await new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=geometry&language=es&region=CO';
  script.async=true;script.defer=true;script.dataset.clickokGoogleMaps='1';
  script.onload=()=>resolve();script.onerror=()=>reject(new Error('No se pudo cargar Google Maps.'));
  document.head.appendChild(script);
 });
 await Promise.all([window.google.maps.importLibrary('maps'),window.google.maps.importLibrary('geocoding')]);
};
type CourierPosition={latitude:number;longitude:number;heading:number|null;accuracy:number};
type NavStep={instruction:string;distanceMeters:number;maneuver:string;endLat:number;endLng:number};
const formatDistance=(meters:number)=>meters<1000?`${Math.max(0,Math.round(meters/10)*10)} m`:`${(meters/1000).toFixed(1).replace('.',',')} km`;
const scooterIcon=(heading:number|null)=>{const angle=Number.isFinite(heading)?Number(heading):0;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88"><circle cx="44" cy="44" r="40" fill="#fff" stroke="#6848df" stroke-width="4"/><g transform="rotate(${angle} 44 44)"><rect x="38" y="7" width="12" height="19" rx="6" fill="#20283a" stroke="#fff" stroke-width="2"/><rect x="38" y="62" width="12" height="19" rx="6" fill="#20283a" stroke="#fff" stroke-width="2"/><path d="M31 27 Q44 20 57 27 L53 39 L55 56 Q44 64 33 56 L35 39Z" fill="#6848df" stroke="#fff" stroke-width="2.5"/><path d="M29 29 L59 29 M34 55 L54 55" stroke="#20283a" stroke-width="4" stroke-linecap="round"/><path d="M44 29 L44 57" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="42" r="5" fill="#fff"/></g></svg>`;return{url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),scaledSize:new window.google.maps.Size(54,54),anchor:new window.google.maps.Point(27,27)};};
const distanceBetween=(lat1:number,lng1:number,lat2:number,lng2:number)=>{const r=6371000,toRad=(v:number)=>v*Math.PI/180,dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};
const maneuverText=(m:any,name:string)=>{
 const type=String(m?.type||''),mod=String(m?.modifier||'');
 const road=name? ` hacia ${name}`:'';
 if(type==='arrive')return 'Has llegado a tu destino';
 if(type==='depart')return name?`Continúa por ${name}`:'Inicia el recorrido';
 if(type==='roundabout'||type==='rotary')return 'Entra a la glorieta y toma la salida indicada'+road;
 const words:Record<string,string>={left:'gira a la izquierda',slight_left:'mantente a la izquierda',sharp_left:'gira cerradamente a la izquierda',right:'gira a la derecha',slight_right:'mantente a la derecha',sharp_right:'gira cerradamente a la derecha',straight:'continúa derecho',uturn:'haz un retorno'};
 return (words[mod]||'Continúa por la vía')+road;
};
function DeliveryMap(props:{order:any;currentLocation:CourierPosition|null;onSaveAddress:(address:string,coords?:{latitude:number;longitude:number})=>Promise<void>}){return <MapboxDeliveryMap {...props}/>;}
export default function CourierPortal(){
 const [token,setToken]=useState(()=>sessionStorage.getItem('menuya-courier-token')||''),[courier,setCourier]=useState<any>(()=>{try{return JSON.parse(sessionStorage.getItem('menuya-courier-profile')||'null')}catch{return null}}),[code,setCode]=useState(''),[pin,setPin]=useState(''),[assignments,setAssignments]=useState<Assignment[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sharing,setSharing]=useState(false),[currentLocation,setCurrentLocation]=useState<CourierPosition|null>(null),[completedCount,setCompletedCount]=useState(0);
 const call=useCallback(async(action:string,body:any={})=>{const {data,error}=await supabase.functions.invoke('courier-access',{body:{action,...body},headers:token?{Authorization:'Bearer '+token}:{}});if(error)throw error;if(data?.error)throw new Error(data.error);return data;},[token]);
 const load=useCallback(async()=>{if(!token)return;const d=await call('orders');setAssignments(d.assignments||[]);},[call,token]);
 useEffect(()=>{if(token)void load().catch(e=>{setError(e.message);sessionStorage.removeItem('menuya-courier-token');setToken('');});},[token,load]);
 const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const {data,error}=await supabase.functions.invoke('courier-access',{body:{action:'login',code,pin}});if(error)throw error;if(data?.error)throw new Error(data.error);sessionStorage.setItem('menuya-courier-token',data.token);sessionStorage.setItem('menuya-courier-profile',JSON.stringify(data.courier));setToken(data.token);setCourier(data.courier);setPin('');}catch(e){setError(e instanceof Error?e.message:'No fue posible ingresar.');}finally{setBusy(false);}};
 const saveDeliveryAddress=useCallback(async(a:Assignment,address:string,coords?:{latitude:number;longitude:number})=>{await call('update_delivery_address',{assignment_id:a.id,delivery_address:address,...(coords?{delivery_latitude:coords.latitude,delivery_longitude:coords.longitude}:{})});await load();},[call,load]);
 const update=async(a:Assignment,status:string)=>{setBusy(true);setError('');try{await call('status',{assignment_id:a.id,status});setNotice(status==='picked_up'?'¡Vamos! La entrega está en camino. Tu GPS se compartirá durante el recorrido.':'¡Entrega completada! Preparando el siguiente pedido.');if(status==='delivered')setCompletedCount(v=>v+1);await load();}catch(e){setError(e instanceof Error?e.message:'No fue posible actualizar.');}finally{setBusy(false);}};
 useEffect(()=>{if(!token||!assignments.some(a=>a.status==='picked_up')){setSharing(false);return;}if(!navigator.geolocation){setError('Este dispositivo no permite compartir GPS.');return;}const id=navigator.geolocation.watchPosition(async p=>{try{setCurrentLocation({latitude:p.coords.latitude,longitude:p.coords.longitude,heading:Number.isFinite(p.coords.heading)?p.coords.heading:null,accuracy:p.coords.accuracy});await call('location',{latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});setSharing(true);}catch(e){setError(e instanceof Error?e.message:'No fue posible enviar ubicación.');}},e=>setError(e.message==='User denied Geolocation'?'Debes permitir la ubicación para compartir tu recorrido.':'No fue posible obtener el GPS: '+e.message),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});return()=>navigator.geolocation.clearWatch(id);},[token,assignments,call]);
 const logout=async()=>{try{await call('logout')}catch{}sessionStorage.removeItem('menuya-courier-token');sessionStorage.removeItem('menuya-courier-profile');setToken('');setCourier(null);setAssignments([]);};
 const active=useMemo(()=>assignments.filter(a=>a.status==='picked_up').length,[assignments]),pending=assignments.length-active;
 if(!token)return <main className="cp-login"><style>{courierStyles}</style><form className="cp-login-card" onSubmit={login}><div className="cp-brand"><img src="/brand-clickok-light.svg" alt="CLICKOK"/></div><span className="cp-eyebrow">PORTAL DE DOMICILIARIOS</span><h1>Tu ruta comienza aquí.</h1><p>Ingresa con los datos de acceso que te entregó el comercio.</p><label>Código de acceso<input value={code} onChange={e=>setCode(e.target.value)} required inputMode="numeric" placeholder="Código de 6 dígitos"/></label><label>PIN de seguridad<input type="password" value={pin} onChange={e=>setPin(e.target.value)} required minLength={4} maxLength={8} inputMode="numeric" placeholder="Tu PIN"/></label>{error&&<div className="cp-error">{error}</div>}<button className="cp-primary" disabled={busy}>{busy?'Verificando…':'Ingresar al panel'}</button><small className="cp-login-foot">Acceso privado para el equipo de entregas</small></form></main>;
 return <main className={`cp-app ${active>0?"cp-driving-mode":""}`}><style>{courierStyles}</style><header className="cp-topbar"><div className="cp-brand"><img src="/brand-clickok-light.svg" alt="CLICKOK"/></div><button className="cp-logout" onClick={()=>void logout()}><LogOut size={16}/> Salir</button></header><section className="cp-hero"><div className="cp-hero-copy"><span className="cp-eyebrow">PANEL DEL DOMICILIARIO</span><h1>¡Hola, {courier?.name?.split(' ')[0]||'repartidor'}!</h1><p>Organiza tus entregas y mantente en ruta.</p></div><div className="cp-hero-art"><Bike size={76} strokeWidth={1.3}/><span>EN MOVIMIENTO</span></div></section><section className="cp-stats"><article><span className="cp-stat-icon"><Package size={18}/></span><b>{assignments.length}</b><small>Entregas activas</small></article><article><span className="cp-stat-icon cp-stat-green"><Route size={18}/></span><b>{active}</b><small>En camino</small></article><article><span className="cp-stat-icon cp-stat-orange"><Clock3 size={18}/></span><b>{pending}</b><small>Por recoger</small></article></section>{notice&&<p className="cp-notice"><CheckCircle2 size={17}/>{notice}</p>}{error&&<p className="cp-error">{error}</p>}<div className="cp-section-head"><div><span className="cp-eyebrow">TU JORNADA</span><h2>Mis entregas</h2></div><button className="cp-refresh" onClick={()=>void load()}><RefreshCw size={15}/> Actualizar</button></div>{active>0&&<div className={`cp-gps ${sharing?'is-live':''}`}><span className="cp-gps-dot"/><div><b>{sharing?'Ubicación compartida en vivo':'Comparte tu ubicación'}</b><small>{sharing?'El comercio puede seguir tu recorrido mientras entregas.':'Permite el acceso al GPS para actualizar tu ubicación.'}</small></div><LocateFixed size={20}/></div>}<section className="cp-deliveries">{assignments.length?(active>0?<><div className="cp-active-deliveries">{assignments.filter(a=>a.status==='picked_up').slice(0,1).map(a=><article className="cp-delivery" key={a.id}><div className="cp-delivery-head"><div><span className="cp-order-label">ENTREGA EN CURSO</span><h3>Pedido #{a.orders?.order_number||'—'}</h3><small className="cp-progress-label">{Math.min(completedCount+1,assignments.length)} de {assignments.length} entregas</small></div><span className="cp-status on-route">En camino</span></div><DeliveryMap order={a.orders} currentLocation={currentLocation} onSaveAddress={(address,coords)=>saveDeliveryAddress(a,address,coords)}/><div className="cp-order-info"><div><small>Total del pedido</small><b>{money(a.orders?.total)}</b></div>{a.orders?.created_at&&<div><small>Recibido</small><b>{new Date(a.orders.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</b></div>}</div>{a.orders?.notes&&<p className="cp-notes"><b>Nota del pedido:</b> {a.orders.notes}</p>}<footer><button className="cp-complete" disabled={busy} onClick={()=>void update(a,'delivered')}><CheckCircle2 size={17}/> Confirmar entrega</button></footer></article>)}</div><div className="cp-incoming-tray"><div className="cp-incoming-head"><div><span className="cp-eyebrow">SIGUIENTES ENTREGAS</span><b>Pedidos por recoger</b></div><span className="cp-incoming-count">{assignments.filter(a=>a.status==='assigned').length}</span></div><div className="cp-incoming-list">{assignments.filter(a=>a.status==='assigned').map(a=><article className="cp-incoming-order" key={a.id}><div className="cp-incoming-icon"><Package size={17}/></div><div className="cp-incoming-copy"><b>Pedido #{a.orders?.order_number||'—'}</b><small>{a.orders?.delivery_address||'Dirección pendiente'}</small><strong>{money(a.orders?.total)}</strong></div><button disabled={busy} onClick={()=>void update(a,'picked_up')}>Recoger</button></article>)}</div>{assignments.filter(a=>a.status==='assigned').length===0&&<p className="cp-no-incoming">No tienes pedidos pendientes. Aquí aparecerán los próximos.</p>}</div></>:assignments.map(a=><article className="cp-delivery" key={a.id}><div className="cp-delivery-head"><div><span className="cp-order-label">PEDIDO</span><h3>#{a.orders?.order_number||'—'}</h3></div><span className={`cp-status ${a.status==='picked_up'?'on-route':''}`}>{a.status==='assigned'?'Por recoger':'En camino'}</span></div><DeliveryMap order={a.orders} currentLocation={currentLocation} onSaveAddress={(address,coords)=>saveDeliveryAddress(a,address,coords)}/><div className="cp-order-info"><div><small>Total del pedido</small><b>{money(a.orders?.total)}</b></div>{a.orders?.created_at&&<div><small>Recibido</small><b>{new Date(a.orders.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</b></div>}</div>{a.orders?.notes&&<p className="cp-notes"><b>Nota del pedido:</b> {a.orders.notes}</p>}<footer>{a.status==='assigned'&&<button className="cp-primary" disabled={busy} onClick={()=>void update(a,'picked_up')}><Package size={17}/> Recoger pedido e iniciar ruta</button>}{a.status==='picked_up'&&<button className="cp-complete" disabled={busy} onClick={()=>void update(a,'delivered')}><CheckCircle2 size={17}/> Confirmar entrega</button>}</footer></article>)):<div className="cp-empty"><span><Bike size={34}/></span><h3>Todo listo por ahora</h3><p>Cuando el comercio te asigne un pedido, aparecerá aquí con su mapa y dirección.</p></div>}</section><p className="cp-footer-note">Con tecnología <b>CLICKOK</b> · Entregas más organizadas</p></main>;
}
const courierStyles=`
.cp-app,.cp-login{min-height:100vh;background:#f3f6fb;color:#172238;font-family:Inter,'DM Sans',sans-serif;padding:0 0 34px}
.cp-app *,.cp-login *{box-sizing:border-box}.cp-topbar{height:70px;background:#fff;border-bottom:1px solid #e8edf4;display:flex;align-items:center;justify-content:space-between;padding:0 max(22px,calc((100% - 900px)/2))}
.cp-brand{display:flex;align-items:center;min-width:0}.cp-brand img{display:block;width:156px;max-width:100%;height:auto;object-fit:contain}.cp-brand-icon{width:42px;height:42px;border-radius:14px;background:#e8e4ff;color:#6848df;display:grid;place-items:center}
.cp-logout,.cp-refresh{display:inline-flex;align-items:center;gap:7px;border:1px solid #e4e9f1;background:#fff;color:#536176;border-radius:11px;padding:10px 13px;font-weight:700;cursor:pointer}
.cp-hero{max-width:900px;margin:26px auto 18px;padding:28px 32px;border-radius:23px;background:linear-gradient(115deg,#21194d,#4930a4 62%,#7155df);color:#fff;display:flex;align-items:center;justify-content:space-between;overflow:hidden;position:relative;box-shadow:0 15px 35px #4530a526}
.cp-eyebrow{font-size:10px;font-weight:900;letter-spacing:.16em;color:#8b7be5}.cp-hero .cp-eyebrow{color:#c8bdff}.cp-hero h1{font-size:clamp(27px,5vw,38px);margin:9px 0 5px;font-weight:850;letter-spacing:-.04em}.cp-hero p{margin:0;color:#d7d1f4;font-size:14px}.cp-hero-art{width:142px;height:118px;border-radius:22px;background:#ffffff16;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#e7e1ff;transform:rotate(3deg)}.cp-hero-art span{font-size:9px;font-weight:900;letter-spacing:.16em}
.cp-stats{max-width:900px;margin:0 auto 27px;display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.cp-stats article{background:#fff;border:1px solid #e9edf4;border-radius:17px;padding:16px 18px;display:grid;grid-template-columns:38px 1fr;column-gap:10px;align-items:center;box-shadow:0 4px 15px #19294a08}.cp-stat-icon{grid-row:span 2;width:36px;height:36px;border-radius:12px;background:#eeeaff;color:#6848df;display:grid;place-items:center}.cp-stat-green{background:#e3f8ef;color:#15945f}.cp-stat-orange{background:#fff1df;color:#d98520}.cp-stats b{font-size:23px;line-height:1.1}.cp-stats small{font-size:11px;color:#8290a3;margin-top:4px}
.cp-section-head,.cp-deliveries{max-width:900px;margin-left:auto;margin-right:auto}.cp-section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:13px}.cp-section-head h2{font-size:24px;margin:5px 0 0;font-weight:850;letter-spacing:-.03em}.cp-refresh{font-size:12px;padding:9px 11px}
.cp-gps{max-width:900px;margin:0 auto 14px;padding:13px 16px;background:#fff8e9;border:1px solid #f8e4bd;border-radius:14px;display:flex;align-items:center;gap:11px;color:#9a641b}.cp-gps>div{flex:1;display:flex;flex-direction:column;gap:3px}.cp-gps b{font-size:12px}.cp-gps small{font-size:11px;color:#9c835e}.cp-gps.is-live{background:#eafaf2;border-color:#c9efdc;color:#168453}.cp-gps.is-live small{color:#578d73}.cp-gps-dot{width:9px;height:9px;border-radius:50%;background:#e0a13c;box-shadow:0 0 0 4px #e0a13c22}.is-live .cp-gps-dot{background:#19a66a;box-shadow:0 0 0 4px #19a66a22}
.cp-deliveries{display:grid;grid-template-columns:1fr;gap:16px}.cp-delivery{background:#fff;border:1px solid #e8edf4;border-radius:19px;padding:19px;box-shadow:0 5px 20px #17223808}.cp-delivery-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.cp-order-label{font-size:9px;font-weight:900;letter-spacing:.16em;color:#929db0}.cp-delivery-head h3{font-size:21px;margin:3px 0 0}.cp-status{font-size:10px;font-weight:800;color:#9a641b;background:#fff2dc;border-radius:30px;padding:7px 11px}.cp-status.on-route{color:#168453;background:#e3f8ed}
.cp-nav-guidance{display:flex;align-items:center;gap:11px;padding:12px;background:#21194d;color:#fff}.cp-nav-arrow{width:42px;height:42px;border-radius:12px;background:#ffffff20;display:grid;place-items:center;flex:none}.cp-nav-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.cp-nav-copy b{font-size:13px}.cp-nav-copy small{font-size:10px;color:#d4cef2}.cp-nav-guidance>strong{font-size:17px;white-space:nowrap}.cp-nav-controls{display:flex;gap:8px;padding:9px 12px;flex-wrap:wrap}.cp-nav-controls button{border:1px solid #e0e5ef;background:#fff;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:800;color:#59667a}.cp-nav-controls button.is-on{background:#eeeaff;color:#6848df;border-color:#d9d0ff}.cp-nav-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px 12px;background:#f8f9fc}.cp-nav-summary div{display:flex;flex-direction:column;gap:3px}.cp-nav-summary b{font-size:14px;color:#27334a}.cp-nav-summary small{font-size:9px;color:#8490a2}.cp-map-wrap{border:1px solid #e8edf4;border-radius:15px;overflow:hidden;background:#f4f7fb}.cp-map-heading{height:43px;padding:0 12px;display:flex;align-items:center;justify-content:space-between;color:#58667a;font-size:11px;font-weight:800}.cp-map-heading span,.cp-map-heading a{display:flex;align-items:center;gap:6px}.cp-map-heading a{color:#6345d8;text-decoration:none}.cp-live-map{display:block;position:relative;width:100%;height:270px;min-height:270px;background:#fff;z-index:0}.cp-route-status{display:flex;align-items:center;gap:6px;color:#6b55bb;font-size:10px;font-weight:700}.cp-route-dot{width:7px;height:7px;border-radius:50%;background:#19a66a;box-shadow:0 0 0 3px #19a66a20}.cp-map-legend{display:flex;gap:18px;padding:9px 12px 2px;font-size:10px;color:#657186}.cp-map-legend span{display:flex;align-items:center;gap:6px}.cp-map-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.cp-legend-origin{background:#6848df}.cp-legend-destination{background:#e45d52}.cp-address-search{border-top:1px solid #e8edf4}.cp-address-suggestions{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}.cp-address-suggestions button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;padding:10px 11px;border:1px solid #e5e9f1;background:#fff;border-radius:10px;color:#344158;cursor:pointer}.cp-address-suggestions button:active{background:#f1eeff;border-color:#cfc4ff}.cp-address-suggestions b{font-size:11px}.cp-address-suggestions small{font-size:10px;color:#7d899c}.cp-address-search>small{font-size:10px;color:#8490a2}.cp-map-address{padding:10px 12px;display:flex;align-items:flex-start;gap:7px;font-size:11px;color:#5c687a}.cp-map-address svg{flex:none;color:#7255dc}.cp-map-empty{height:150px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#77849a;font-size:11px}.cp-map-empty svg{color:#7656df}.cp-map-empty b{color:#354158}.cp-map-empty a{color:#6848df;font-weight:800;text-decoration:none}.cp-city-editor{padding:12px;border-top:1px solid #e8edf4;display:flex;flex-direction:column;gap:8px}.cp-city-editor>b{font-size:11px;color:#344158}.cp-city-editor>span{font-size:10px;color:#8490a2}.cp-city-editor>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cp-city-editor label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:800;color:#59667a}.cp-city-editor input{height:39px;min-width:0;border:1px solid #dfe5ef;border-radius:9px;padding:0 10px;font-size:12px}.cp-city-editor button{height:40px;border:0;border-radius:9px;background:#6848df;color:#fff;font-size:11px;font-weight:800;cursor:pointer}.cp-city-editor button:disabled{opacity:.55;cursor:wait}
.cp-order-info{display:flex;gap:36px;padding:14px 2px}.cp-order-info div{display:flex;flex-direction:column;gap:4px}.cp-order-info small{font-size:10px;color:#8995a7}.cp-order-info b{font-size:14px}.cp-notes{font-size:12px;color:#68758a;background:#f6f7fb;padding:10px 12px;border-radius:10px}.cp-delivery footer{margin-top:12px}.cp-primary,.cp-complete{width:100%;min-height:47px;border:0;border-radius:12px;background:linear-gradient(100deg,#6748dc,#8062ed);color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;box-shadow:0 7px 15px #6848dc25}.cp-complete{background:linear-gradient(100deg,#128453,#20aa70);box-shadow:0 7px 15px #12845320}.cp-primary:disabled,.cp-complete:disabled{opacity:.6;cursor:wait}
.cp-empty{background:#fff;border:1px dashed #d9dfeb;border-radius:20px;padding:40px 22px;text-align:center}.cp-empty>span{width:62px;height:62px;border-radius:20px;background:#eeeaff;color:#7051df;display:grid;place-items:center;margin:0 auto 14px}.cp-empty h3{margin:0 0 6px;font-size:18px}.cp-empty p{max-width:330px;margin:0 auto;color:#8490a2;font-size:12px;line-height:1.6}.cp-notice,.cp-error{max-width:900px;margin:0 auto 13px;padding:12px 14px;border-radius:12px;font-size:12px;display:flex;align-items:center;gap:8px}.cp-notice{background:#e7f8ef;color:#137c50}.cp-error{background:#fff0ef;color:#b83e38}.cp-footer-note{text-align:center;color:#9aa4b3;font-size:10px;margin:25px 0}.cp-footer-note b{color:#7355dc}
.cp-login{display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 20% 10%,#ece8ff,transparent 38%),#f3f6fb}.cp-login-card{width:min(100%,420px);background:#fff;border:1px solid #e8edf4;border-radius:23px;padding:30px;box-shadow:0 18px 55px #25204412;display:flex;flex-direction:column;gap:13px}.cp-login-card .cp-brand{margin-bottom:13px}.cp-login-card h1{font-size:29px;line-height:1.1;letter-spacing:-.04em;margin:0}.cp-login-card>p{font-size:13px;color:#7b8799;line-height:1.5;margin:0 0 7px}.cp-login-card label{font-size:11px;font-weight:800;color:#4f5b70;display:flex;flex-direction:column;gap:7px}.cp-login-card input{height:46px;border:1px solid #dfe5ef;border-radius:11px;padding:0 13px;font-size:14px;outline:none}.cp-login-card input:focus{border-color:#7656df;box-shadow:0 0 0 3px #7656df18}.cp-login-foot{text-align:center;color:#a0a9b7;font-size:10px;margin-top:4px}
@media(max-width:940px){.cp-hero,.cp-stats,.cp-section-head,.cp-deliveries,.cp-gps{margin-left:16px;margin-right:16px}.cp-topbar{padding:0 17px}}
@media(max-width:560px){.cp-city-editor .cp-address-fields{grid-template-columns:1fr}.cp-topbar{height:62px}.cp-brand img{width:142px}.cp-brand-icon{width:37px;height:37px}.cp-hero{margin-top:16px;padding:22px 19px;border-radius:19px}.cp-hero-art{width:88px;height:88px}.cp-hero-art svg{width:52px}.cp-hero-art span{font-size:7px}.cp-hero h1{font-size:27px}.cp-hero p{font-size:12px;max-width:205px}.cp-stats{gap:8px;margin-bottom:23px}.cp-stats article{padding:12px 9px;grid-template-columns:30px 1fr;column-gap:6px}.cp-stat-icon{width:29px;height:29px;border-radius:9px}.cp-stats b{font-size:19px}.cp-stats small{font-size:9px}.cp-section-head h2{font-size:22px}.cp-delivery{padding:13px;border-radius:16px}.cp-live-map{height:230px}.cp-login-card{padding:24px 20px}}
/* Premium delivery-card refresh */
.cp-deliveries{gap:19px}
.cp-delivery{position:relative;padding:0;border:1px solid #e4e9f2;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px #1827470b;transition:box-shadow .2s,border-color .2s}
.cp-delivery:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#6848df,#a18cf4);z-index:2}
.cp-delivery-head{padding:18px 20px 15px;margin:0;align-items:center;background:linear-gradient(180deg,#fff,#fcfcff);border-bottom:1px solid #eef1f6}
.cp-order-label{display:inline-flex;align-items:center;gap:6px;color:#8a93a5;font-size:9px;letter-spacing:.15em}
.cp-delivery-head h3{font-size:25px;line-height:1.1;letter-spacing:-.045em;font-weight:850;margin:5px 0 0;color:#19243a}
.cp-status{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #f3dfb8;font-size:10px;letter-spacing:.01em}
.cp-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.cp-status.on-route{border-color:#c9edda;background:#eaf9f1;color:#138354}
.cp-map-wrap{margin:0 15px;border:1px solid #e6eaf2;border-radius:15px;background:#f7f8fc}
.cp-map-heading{height:42px;padding:0 13px}
.cp-live-map{height:280px}
.cp-nav-guidance{padding:13px 14px;background:linear-gradient(105deg,#21194d,#30236c);min-height:86px}
.cp-nav-arrow{background:#ffffff1c;border:1px solid #ffffff22}
.cp-nav-copy b{font-size:14px;line-height:1.3}
.cp-nav-guidance>strong{font-size:19px;font-weight:850;letter-spacing:-.03em}
.cp-order-info{margin:14px 15px 0;padding:0;gap:10px;display:grid;grid-template-columns:1fr 1fr}
.cp-order-info>div{padding:12px 14px;border:1px solid #edf0f5;border-radius:13px;background:#fafbfe;gap:5px}
.cp-order-info small{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8a95a7}
.cp-order-info b{font-size:16px;font-weight:850;letter-spacing:-.02em;color:#202b40}
.cp-notes{margin:12px 15px 0;border:1px solid #f0e7d7;background:#fffbf3;color:#78664c}
.cp-delivery footer{margin:14px 15px 16px}
.cp-complete,.cp-primary{min-height:49px;border-radius:13px;font-size:12px;letter-spacing:.01em}
.cp-empty{border-radius:22px}
@media(max-width:560px){
 .cp-delivery{border-radius:19px}
 .cp-delivery-head{padding:15px 15px 13px}
 .cp-delivery-head h3{font-size:23px}
 .cp-map-wrap{margin:0 10px;border-radius:13px}
 .cp-map-heading{font-size:10px;padding:0 10px}
 .cp-live-map{height:235px}
 .cp-nav-controls{gap:6px;padding:8px}.cp-nav-controls button{padding:8px;font-size:9px}
 .cp-nav-guidance{padding:11px;gap:9px}
 .cp-nav-arrow{width:38px;height:38px}
 .cp-nav-copy b{font-size:12px}
 .cp-nav-guidance>strong{font-size:16px}
 .cp-order-info{margin:11px 10px 0;gap:8px}
 .cp-order-info>div{padding:10px;border-radius:11px}
 .cp-order-info b{font-size:14px}
 .cp-delivery footer{margin:12px 10px 12px}
 .cp-notes{margin:10px 10px 0}
}
/* Premium Rappi-inspired courier navigation */
.cp-app{background:#f4f6fb}
.cp-map-experience{position:relative;margin:0 15px 0;border:0;border-radius:18px;overflow:hidden;background:#e9edf4;box-shadow:0 8px 24px #18274714}
.cp-map-experience .cp-live-map{height:min(62vh,590px);min-height:390px;width:100%;background:#e9edf4}
.cp-map-floating-top{position:absolute;z-index:3;top:13px;left:13px;right:13px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
.cp-map-live-pill,.cp-map-locate{pointer-events:auto;box-shadow:0 3px 14px #1b25401f}
.cp-map-live-pill{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e9edf4;border-radius:30px;padding:9px 12px;color:#354158;font-size:9px;font-weight:900;letter-spacing:.09em}
.cp-map-live-pill .cp-route-dot{background:#16a36a;box-shadow:0 0 0 4px #16a36a20}
.cp-map-locate{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:13px;background:#fff;color:#6848df}
.cp-map-turn-card{position:absolute;z-index:3;top:62px;left:13px;right:13px;display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:15px;background:linear-gradient(110deg,#21194d,#392879);color:#fff;box-shadow:0 7px 22px #1b164b30}
.cp-map-turn-card .cp-nav-arrow{width:39px;height:39px;flex:none;background:#ffffff20}
.cp-map-turn-card .cp-nav-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.cp-map-turn-card .cp-nav-copy small{font-size:9px;color:#d5cff2}
.cp-map-turn-card .cp-nav-copy b{font-size:13px;line-height:1.3;color:#fff}
.cp-map-bottom-sheet{position:absolute;z-index:4;left:9px;right:9px;bottom:9px;padding:10px 13px 9px;border-radius:18px;background:#fff;box-shadow:0 8px 28px #1b25402b;border:1px solid #ffffffd9}
.cp-map-sheet-handle{width:36px;height:4px;border-radius:9px;background:#d9deea;margin:0 auto 10px}
.cp-map-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cp-map-sheet-head>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.cp-map-sheet-head small{font-size:8px;letter-spacing:.13em;font-weight:900;color:#8994a7}
.cp-map-sheet-head b{font-size:13px;line-height:1.3;color:#1d2940;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65vw}
.cp-map-gps-ok,.cp-map-gps-wait{white-space:nowrap;border-radius:30px;padding:7px 9px;font-size:9px;font-weight:850;color:#128453;background:#e8f8ef}
.cp-map-gps-wait{color:#a16b1d;background:#fff4df}
.cp-map-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:11px;padding:10px 0;border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5}
.cp-map-kpis>div{display:flex;flex-direction:column;gap:3px}
.cp-map-kpis b{font-size:19px;letter-spacing:-.04em;color:#1d2940;font-weight:900}
.cp-map-kpis small{font-size:9px;color:#8390a3}
.cp-map-route-state{font-size:9px;color:#6f7b8e;padding:7px 0 3px}
.cp-map-edit{border-top:1px solid #edf0f5;margin-top:4px;padding-top:8px}
.cp-map-edit summary{display:flex;align-items:center;gap:7px;list-style:none;cursor:pointer;color:#6848df;font-size:10px;font-weight:850}
.cp-map-edit summary::-webkit-details-marker{display:none}
.cp-map-edit-body{display:flex;flex-direction:column;gap:8px;padding-top:10px}
.cp-map-edit-body label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:800;color:#59667a}
.cp-map-edit-body input{height:39px;border:1px solid #dfe5ef;border-radius:9px;padding:0 10px;font-size:12px}
.cp-map-edit-actions{display:flex;gap:8px}
.cp-map-edit-actions button{min-height:36px;padding:0 12px;border:0;border-radius:9px;background:#6848df;color:#fff;font-size:10px;font-weight:850}
.cp-map-edit-actions button:disabled{opacity:.55}
.cp-map-edit-body>small{font-size:9px;color:#8a95a7}
.cp-map-experience .mapboxgl-ctrl-group{border-radius:11px!important;overflow:hidden;box-shadow:0 2px 10px #1b25401c!important}
.cp-map-experience .mapboxgl-ctrl-top-right{top:60px;right:12px}
.cp-map-experience .mapboxgl-ctrl-bottom-left{bottom:205px}
.cp-map-experience .mapboxgl-ctrl-bottom-right{bottom:205px}
.cp-delivery-head{padding:16px 20px 13px}
.cp-order-info{margin-top:12px}
@media(max-width:560px){
 .cp-map-experience{margin:0 9px;border-radius:15px}
 .cp-map-experience .cp-live-map{height:65vh;min-height:430px}
 .cp-map-turn-card{top:60px;left:9px;right:9px;padding:11px}
 .cp-map-turn-card .cp-nav-copy b{font-size:12px}
 .cp-map-bottom-sheet{left:7px;right:7px;bottom:7px;padding:9px 11px;border-radius:16px}
 .cp-map-sheet-head b{font-size:12px}
 .cp-map-kpis{margin-top:9px;padding:8px 0}
 .cp-map-kpis b{font-size:17px}
 .cp-map-experience .mapboxgl-ctrl-top-right{top:110px;right:9px}
 .cp-map-experience .mapboxgl-ctrl-bottom-left,.cp-map-experience .mapboxgl-ctrl-bottom-right{bottom:225px}
}

/* Incoming orders dock under active navigation */
.cp-driving-mode .cp-deliveries{display:flex!important;flex-direction:column;overflow:hidden!important}
.cp-driving-mode .cp-active-deliveries{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.cp-driving-mode .cp-active-deliveries .cp-delivery{flex:1;min-height:0}
.cp-driving-mode .cp-incoming-tray{flex:none;z-index:8;background:#fff;border-top:1px solid #e5e9f1;padding:9px 12px calc(9px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px #17223812;max-height:176px}
.cp-driving-mode .cp-incoming-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}
.cp-driving-mode .cp-incoming-head>div{display:flex;flex-direction:column;gap:2px}
.cp-driving-mode .cp-incoming-head .cp-eyebrow{font-size:8px;color:#8b7be5}
.cp-driving-mode .cp-incoming-head b{font-size:12px;color:#1d2940}
.cp-incoming-count{min-width:23px;height:23px;padding:0 7px;display:grid;place-items:center;border-radius:20px;background:#eeeaff;color:#6848df;font-size:10px;font-weight:900}
.cp-incoming-list{display:flex;gap:8px;overflow-x:auto;padding:1px 1px 5px;scroll-snap-type:x mandatory}
.cp-incoming-order{flex:0 0 min(260px,78vw);min-width:0;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e9edf4;border-radius:12px;background:#fafbfe;scroll-snap-align:start}
.cp-incoming-icon{width:32px;height:32px;flex:none;border-radius:10px;background:#eeeaff;color:#6848df;display:grid;place-items:center}
.cp-incoming-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.cp-incoming-copy b{font-size:10px;color:#1d2940}
.cp-incoming-copy small{font-size:9px;color:#8792a4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-incoming-copy strong{font-size:10px;color:#4c3a9d}
.cp-incoming-order button{flex:none;border:0;border-radius:9px;background:#6848df;color:#fff;padding:8px 10px;font-size:9px;font-weight:850}
.cp-incoming-order button:disabled{opacity:.55}
.cp-no-incoming{margin:0;padding:8px 0;color:#8a95a7;font-size:10px}
@media(max-width:560px){.cp-driving-mode .cp-incoming-tray{max-height:160px;padding:8px 9px calc(8px + env(safe-area-inset-bottom))}.cp-incoming-order{flex-basis:82vw}}
/* Full-screen courier driving mode */
.cp-driving-mode{height:100dvh;min-height:100dvh;overflow:hidden;padding:0!important;background:#e9edf4!important;display:flex;flex-direction:column}
.cp-driving-mode .cp-topbar{height:54px;min-height:54px;flex:none;padding:0 14px;z-index:10;box-shadow:0 2px 12px #17223812}
.cp-driving-mode .cp-brand img{width:116px}
.cp-driving-mode .cp-hero,.cp-driving-mode .cp-stats,.cp-driving-mode .cp-section-head,.cp-driving-mode .cp-gps,.cp-driving-mode .cp-footer-note{display:none!important}
.cp-driving-mode .cp-notice,.cp-driving-mode .cp-error{position:relative;z-index:11;margin:6px 10px;flex:none}
.cp-driving-mode .cp-deliveries{width:100%;max-width:none;min-height:0;flex:1;display:block;margin:0;overflow:hidden}
.cp-driving-mode .cp-delivery{height:100%;min-height:0;width:100%;max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column;overflow:hidden;background:#e9edf4}
.cp-driving-mode .cp-delivery:before{display:none}
.cp-driving-mode .cp-delivery-head{height:48px;min-height:48px;flex:none;padding:5px 14px;background:#fff;border-bottom:1px solid #e9edf4}
.cp-driving-mode .cp-delivery-head h3{font-size:18px;margin:0}.cp-progress-label{display:block;margin-top:2px;color:#6848df;font-size:10px;font-weight:800}
.cp-driving-mode .cp-order-label{font-size:8px}
.cp-driving-mode .cp-status{font-size:9px;padding:6px 9px}
.cp-driving-mode .cp-map-experience{position:relative;flex:1;min-height:0;width:100%;margin:0;border:0;border-radius:0;box-shadow:none;overflow:hidden}
.cp-driving-mode .cp-map-experience .cp-live-map{height:100%!important;min-height:0!important;width:100%;position:absolute;inset:0}
.cp-driving-mode .cp-map-floating-top{top:12px;left:12px;right:12px}
.cp-driving-mode .cp-map-turn-card{top:60px;left:12px;right:12px}
.cp-driving-mode .cp-map-bottom-sheet{left:10px;right:10px;bottom:10px;padding:11px 14px 10px;border-radius:20px;box-shadow:0 8px 32px #17223830}
.cp-driving-mode .cp-map-kpis b{font-size:21px}
.cp-driving-mode .cp-map-edit:not([open]){padding-top:7px}
.cp-driving-mode .cp-order-info{display:none!important}
.cp-driving-mode .cp-delivery footer{flex:none;margin:0;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e9edf4}
.cp-driving-mode .cp-delivery footer button{min-height:43px}
.cp-driving-mode .cp-notes{display:none}
@media(max-width:560px){
 .cp-driving-mode .cp-topbar{height:48px;min-height:48px}
 .cp-driving-mode .cp-brand img{width:108px}
 .cp-driving-mode .cp-delivery-head{height:43px;min-height:43px;padding:4px 12px}
 .cp-driving-mode .cp-map-turn-card{top:58px}
 .cp-driving-mode .cp-map-bottom-sheet{left:8px;right:8px;bottom:8px;padding:9px 11px}
 .cp-driving-mode .cp-map-kpis{margin-top:8px;padding:8px 0}
 .cp-driving-mode .cp-map-kpis b{font-size:18px}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-top-right{top:110px;right:9px}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-left,.cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-right{bottom:210px}
}


/* Mobile map layout correction: keep navigation overlays compact and preserve map visibility */
@media(max-width:560px){
 .cp-driving-mode .cp-delivery-head{height:52px;min-height:52px;padding:5px 14px}
 .cp-driving-mode .cp-delivery-head h3{font-size:19px}
 .cp-driving-mode .cp-map-experience{margin:0;min-height:0;border-radius:0;overflow:hidden}
 .cp-driving-mode .cp-map-experience .cp-live-map{height:100%!important;min-height:0!important;position:absolute!important;inset:0!important}
 .cp-driving-mode .cp-map-floating-top{top:10px;left:12px;right:12px}
 .cp-driving-mode .cp-map-turn-card{top:60px;left:12px;right:auto;width:min( calc(100% - 24px), 360px);min-height:68px;padding:9px 11px;border-radius:13px;gap:9px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-arrow{width:36px;height:36px;border-radius:10px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-arrow svg{width:19px;height:19px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy{gap:2px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy small{font-size:8px;line-height:1.2}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy b{font-size:12px;line-height:1.2}
 .cp-driving-mode .cp-map-bottom-sheet{left:9px;right:9px;bottom:9px;padding:8px 11px 7px;border-radius:15px;max-height:180px;overflow-y:auto}
 .cp-driving-mode .cp-map-sheet-handle{margin-bottom:7px}
 .cp-driving-mode .cp-map-sheet-head small{font-size:7px}
 .cp-driving-mode .cp-map-sheet-head b{font-size:11px}
 .cp-driving-mode .cp-map-gps-ok,.cp-driving-mode .cp-map-gps-wait{padding:5px 7px;font-size:8px}
 .cp-driving-mode .cp-map-kpis{margin-top:7px;padding:7px 0;gap:5px}
 .cp-driving-mode .cp-map-kpis b{font-size:16px}
 .cp-driving-mode .cp-map-kpis small{font-size:8px}
 .cp-driving-mode .cp-map-route-state{font-size:8px;padding:5px 0 1px}
 .cp-driving-mode .cp-map-edit{margin-top:2px;padding-top:5px}
 .cp-driving-mode .cp-map-edit summary{font-size:9px}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-top-right{top:108px;right:10px}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-left,.cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-right{bottom:196px}
 .cp-driving-mode .cp-delivery footer{padding:7px 10px calc(7px + env(safe-area-inset-bottom))}
 .cp-driving-mode .cp-delivery footer button{min-height:44px}
}

/* Compact floating HUD: prioritize the live map on mobile */
@media(max-width:560px){
 .cp-driving-mode .cp-map-experience{isolation:isolate}
 .cp-driving-mode .cp-map-floating-top{z-index:5;top:12px;left:12px;right:12px}
 .cp-driving-mode .cp-map-live-pill{padding:8px 11px;font-size:9px}
 .cp-driving-mode .cp-map-locate{width:42px;height:42px}
 .cp-driving-mode .cp-map-turn-card{z-index:5;top:66px;left:12px;right:12px;width:auto;min-height:58px;padding:8px 10px;border-radius:13px;box-shadow:0 5px 18px #21194d35}
 .cp-driving-mode .cp-map-turn-card .cp-nav-arrow{width:34px;height:34px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy small{font-size:7px}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy b{font-size:11px}
 .cp-driving-mode .cp-map-bottom-sheet{z-index:5;left:12px!important;right:12px!important;bottom:12px!important;height:126px!important;min-height:126px!important;max-height:126px!important;overflow:hidden!important;padding:9px 12px!important;border-radius:15px!important;box-shadow:0 5px 22px #17223835!important}
 .cp-driving-mode .cp-map-sheet-handle{width:30px;height:3px;margin:0 auto 7px}
 .cp-driving-mode .cp-map-sheet-head{gap:7px}
 .cp-driving-mode .cp-map-sheet-head small{font-size:7px;letter-spacing:.09em}
 .cp-driving-mode .cp-map-sheet-head b{font-size:11px;max-width:62vw}
 .cp-driving-mode .cp-map-gps-ok,.cp-driving-mode .cp-map-gps-wait{font-size:8px;padding:5px 7px}
 .cp-driving-mode .cp-map-kpis{margin-top:7px!important;padding:7px 0!important;gap:5px}
 .cp-driving-mode .cp-map-kpis b{font-size:16px!important}
 .cp-driving-mode .cp-map-kpis small{font-size:8px!important}
 .cp-driving-mode .cp-map-route-state,.cp-driving-mode .cp-map-edit{display:none!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-top-right{top:116px!important;right:10px!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-left,.cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-right{bottom:158px!important}
 .cp-driving-mode .cp-delivery footer{padding:7px 12px calc(7px + env(safe-area-inset-bottom))!important}
 .cp-driving-mode .cp-delivery footer button{min-height:44px!important;border-radius:12px}
 .cp-driving-mode .cp-incoming-tray{max-height:132px;padding:7px 9px calc(7px + env(safe-area-inset-bottom))}
 .cp-driving-mode .cp-incoming-head{margin-bottom:5px}
 .cp-driving-mode .cp-incoming-head b{font-size:11px}
 .cp-driving-mode .cp-no-incoming{font-size:9px;padding:5px 0}
}


/* HARD MOBILE OVERRIDE — map-first courier layout */
@media screen and (max-width: 700px) {
  .cp-driving-mode { height: 100dvh !important; min-height: 100dvh !important; overflow: hidden !important; }
  .cp-driving-mode .cp-topbar { height: 44px !important; min-height: 44px !important; padding: 0 10px !important; }
  .cp-driving-mode .cp-brand img { width: 100px !important; }
  .cp-driving-mode .cp-logout { padding: 6px 9px !important; font-size: 11px !important; }
  .cp-driving-mode .cp-deliveries,
  .cp-driving-mode .cp-active-deliveries,
  .cp-driving-mode .cp-active-deliveries .cp-delivery { min-height: 0 !important; }
  .cp-driving-mode .cp-deliveries { flex: 1 1 auto !important; }
  .cp-driving-mode .cp-delivery { display: flex !important; flex-direction: column !important; }
  .cp-driving-mode .cp-delivery-head { height: 44px !important; min-height: 44px !important; padding: 3px 10px !important; }
  .cp-driving-mode .cp-delivery-head h3 { font-size: 16px !important; }
  .cp-driving-mode .cp-progress-label { font-size: 8px !important; margin-top: 0 !important; }
  .cp-driving-mode .cp-map-experience { position: relative !important; flex: 1 1 auto !important; min-height: 0 !important; width: 100% !important; margin: 0 !important; overflow: hidden !important; }
  .cp-driving-mode .cp-map-experience .cp-live-map { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; min-height: 0 !important; }
  .cp-driving-mode .cp-map-floating-top { top: 8px !important; left: 9px !important; right: 9px !important; }
  .cp-driving-mode .cp-map-live-pill { padding: 6px 9px !important; font-size: 8px !important; }
  .cp-driving-mode .cp-map-locate { width: 36px !important; height: 36px !important; }
  .cp-driving-mode .cp-map-turn-card { top: 54px !important; left: 9px !important; right: auto !important; width: min(250px, calc(100% - 18px)) !important; min-height: 48px !important; padding: 7px 8px !important; gap: 7px !important; border-radius: 11px !important; }
  .cp-driving-mode .cp-map-turn-card .cp-nav-arrow { width: 30px !important; height: 30px !important; }
  .cp-driving-mode .cp-map-turn-card .cp-nav-copy { gap: 1px !important; }
  .cp-driving-mode .cp-map-turn-card .cp-nav-copy small { font-size: 7px !important; }
  .cp-driving-mode .cp-map-turn-card .cp-nav-copy b { font-size: 10px !important; }
  .cp-driving-mode .cp-map-bottom-sheet { left: 9px !important; right: 9px !important; bottom: 9px !important; height: 92px !important; min-height: 92px !important; max-height: 92px !important; overflow: hidden !important; padding: 7px 9px !important; border-radius: 12px !important; }
  .cp-driving-mode .cp-map-sheet-handle { display: none !important; }
  .cp-driving-mode .cp-map-sheet-head { gap: 5px !important; }
  .cp-driving-mode .cp-map-sheet-head small { font-size: 6px !important; }
  .cp-driving-mode .cp-map-sheet-head b { font-size: 10px !important; max-width: 62vw !important; }
  .cp-driving-mode .cp-map-gps-ok, .cp-driving-mode .cp-map-gps-wait { padding: 4px 6px !important; font-size: 7px !important; }
  .cp-driving-mode .cp-map-kpis { margin-top: 5px !important; padding: 5px 0 0 !important; border-bottom: 0 !important; }
  .cp-driving-mode .cp-map-kpis b { font-size: 13px !important; }
  .cp-driving-mode .cp-map-kpis small { font-size: 7px !important; }
  .cp-driving-mode .cp-map-route-state, .cp-driving-mode .cp-map-edit { display: none !important; }
  .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-top-right { top: 103px !important; right: 8px !important; }
  .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-left,
  .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-right { bottom: 112px !important; }
  .cp-driving-mode .cp-delivery footer { flex: none !important; margin: 0 !important; padding: 5px 9px calc(5px + env(safe-area-inset-bottom)) !important; }
  .cp-driving-mode .cp-delivery footer button { min-height: 38px !important; font-size: 11px !important; }
  .cp-driving-mode .cp-incoming-tray { max-height: 94px !important; padding: 5px 8px calc(5px + env(safe-area-inset-bottom)) !important; }
  .cp-driving-mode .cp-incoming-head { margin-bottom: 2px !important; }
  .cp-driving-mode .cp-incoming-head .cp-eyebrow { font-size: 6px !important; }
  .cp-driving-mode .cp-incoming-head b { font-size: 9px !important; }
  .cp-driving-mode .cp-incoming-count { min-width: 18px !important; height: 18px !important; font-size: 8px !important; }
  .cp-driving-mode .cp-no-incoming { padding: 3px 0 !important; font-size: 8px !important; }
}

/* Visual polish — premium mobile courier navigation */
@media screen and (max-width:700px){
 .cp-driving-mode{background:#eef1f7!important;color:#172238}
 .cp-driving-mode .cp-topbar{background:rgba(255,255,255,.97)!important;border-bottom:1px solid #e8ebf2!important;backdrop-filter:blur(16px)}
 .cp-driving-mode .cp-logout{border:1px solid #e7eaf1!important;border-radius:10px!important;background:#f8f9fc!important;color:#364258!important;font-weight:800!important;box-shadow:0 2px 8px #1a24400a}
 .cp-driving-mode .cp-delivery-head{background:rgba(255,255,255,.98)!important;border-bottom:1px solid #e9edf4!important;padding-left:14px!important;padding-right:14px!important}
 .cp-driving-mode .cp-delivery-head>div{display:flex;flex-direction:column;gap:1px}
 .cp-driving-mode .cp-order-label{color:#8993a5!important;letter-spacing:.14em!important}
 .cp-driving-mode .cp-delivery-head h3{color:#19243a!important;font-weight:900!important;letter-spacing:-.04em!important}
 .cp-driving-mode .cp-progress-label{color:#6547d5!important;font-weight:850!important}
 .cp-driving-mode .cp-status.on-route{border:1px solid #c8ebd9!important;background:#e9f8f0!important;color:#128253!important;padding:7px 10px!important}
 .cp-driving-mode .cp-map-experience{background:#e9eef5!important}
 .cp-driving-mode .cp-map-live-pill{background:rgba(255,255,255,.96)!important;border:1px solid #e9edf4!important;border-radius:999px!important;color:#354158!important;box-shadow:0 5px 18px #19243a1c!important;backdrop-filter:blur(12px)}
 .cp-driving-mode .cp-map-live-pill .cp-route-dot{width:8px!important;height:8px!important;background:#18a66b!important;box-shadow:0 0 0 4px #18a66b20!important}
 .cp-driving-mode .cp-map-locate{border:1px solid #e8ebf2!important;border-radius:13px!important;background:rgba(255,255,255,.97)!important;color:#4e3bb2!important;box-shadow:0 5px 18px #19243a20!important}
 .cp-driving-mode .cp-map-turn-card{background:linear-gradient(115deg,#21194d 0%,#35236f 65%,#4c36a0 100%)!important;border:1px solid #ffffff24!important;box-shadow:0 8px 24px #21194d38!important}
 .cp-driving-mode .cp-map-turn-card .cp-nav-arrow{background:#ffffff1c!important;border:1px solid #ffffff26!important;border-radius:10px!important;color:#fff!important}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy small{color:#c9c0f0!important;letter-spacing:.08em!important;font-weight:800!important}
 .cp-driving-mode .cp-map-turn-card .cp-nav-copy b{color:#fff!important;font-weight:850!important;letter-spacing:-.015em!important}
 .cp-driving-mode .cp-map-bottom-sheet{background:rgba(255,255,255,.97)!important;border:1px solid #ffffff!important;box-shadow:0 8px 28px #17223826!important;backdrop-filter:blur(18px)!important}
 .cp-driving-mode .cp-map-sheet-head small{color:#8a94a6!important;font-weight:900!important}
 .cp-driving-mode .cp-map-sheet-head b{color:#1d2940!important;font-weight:850!important;letter-spacing:-.02em!important}
 .cp-driving-mode .cp-map-gps-ok{background:#e7f7ee!important;color:#128253!important;border:1px solid #d2efdf!important}
 .cp-driving-mode .cp-map-gps-wait{background:#fff4df!important;color:#9a681e!important;border:1px solid #f5e4c2!important}
 .cp-driving-mode .cp-map-kpis{border-top:1px solid #edf0f5!important}
 .cp-driving-mode .cp-map-kpis>div{padding-left:2px}
 .cp-driving-mode .cp-map-kpis b{color:#1e2a40!important;font-weight:900!important;letter-spacing:-.045em!important}
 .cp-driving-mode .cp-map-kpis small{color:#8994a6!important;font-weight:650!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-group{border:1px solid #e8ebf1!important;border-radius:12px!important;overflow:hidden!important;box-shadow:0 4px 14px #1b254022!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-group button{background-color:rgba(255,255,255,.97)!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-group button+button{border-top:1px solid #edf0f5!important}
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-left .mapboxgl-ctrl,
 .cp-driving-mode .cp-map-experience .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl{margin:0 7px 5px!important}
 .cp-driving-mode .cp-delivery footer{background:rgba(255,255,255,.98)!important;border-top:1px solid #e9edf4!important}
 .cp-driving-mode .cp-delivery footer button{border-radius:12px!important;font-weight:850!important;letter-spacing:.005em!important;box-shadow:0 5px 13px #12845325!important}
 .cp-driving-mode .cp-incoming-tray{background:rgba(255,255,255,.98)!important;border-top:1px solid #e7ebf2!important;box-shadow:0 -5px 20px #1722380d!important}
 .cp-driving-mode .cp-incoming-head .cp-eyebrow{color:#8975db!important;letter-spacing:.15em!important}
 .cp-driving-mode .cp-incoming-head b{color:#202b40!important;font-weight:850!important}
 .cp-driving-mode .cp-incoming-count{background:#eeeaff!important;color:#6244ce!important}
 .cp-driving-mode .cp-no-incoming{color:#8994a6!important}
 .cp-driving-mode .cp-incoming-order{background:#f9faff!important;border:1px solid #e8eaf3!important;border-radius:11px!important}
 .cp-driving-mode .cp-incoming-order button{background:linear-gradient(110deg,#6243d0,#8061e9)!important;border-radius:9px!important;box-shadow:0 3px 9px #6848df25!important}
}

`;