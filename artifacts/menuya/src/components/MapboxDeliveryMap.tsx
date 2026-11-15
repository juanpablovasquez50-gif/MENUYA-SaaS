import {useEffect,useRef,useState} from 'react';
import {MapPin,MapPinned,Navigation} from 'lucide-react';

declare global { interface Window { mapboxgl?: any } }
type Point={latitude:number;longitude:number};
type Props={order:any;currentLocation:{latitude:number;longitude:number;heading:number|null}|null;onSaveAddress:(address:string,coords?:Point)=>Promise<void>};

const distanceBetween=(lat1:number,lng1:number,lat2:number,lng2:number)=>{const r=6371000,toRad=(v:number)=>v*Math.PI/180,dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};

let mapboxLoader:Promise<any>|null=null;
const loadMapbox=async()=>{
 if(window.mapboxgl)return window.mapboxgl;
 if(!mapboxLoader)mapboxLoader=new Promise((resolve,reject)=>{
  const token=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  if(!token){reject(new Error('Falta configurar VITE_MAPBOX_ACCESS_TOKEN en Render.'));return;}
  if(!document.querySelector('link[data-menuya-mapbox]')){const link=document.createElement('link');link.rel='stylesheet';link.href='https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css';link.dataset.menuyaMapbox='1';document.head.appendChild(link);}
  const existing=document.querySelector('script[data-menuya-mapbox]');
  if(existing){existing.addEventListener('load',()=>resolve(window.mapboxgl));existing.addEventListener('error',()=>reject(new Error('No se pudo cargar Mapbox.')));return;}
  const script=document.createElement('script');script.src='https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js';script.async=true;script.dataset.menuyaMapbox='1';script.onload=()=>resolve(window.mapboxgl);script.onerror=()=>reject(new Error('No se pudo cargar Mapbox.'));document.head.appendChild(script);
 });
 const mb=await mapboxLoader;mb.accessToken=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;return mb;
};

export default function MapboxDeliveryMap({order,currentLocation,onSaveAddress}:Props){
 const mapEl=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),destinationMarker=useRef<any>(null),courierMarker=useRef<any>(null),routeSeq=useRef(0),lastRouteOrigin=useRef<{latitude:number;longitude:number;at:number}|null>(null),saveRef=useRef(onSaveAddress);
 const [message,setMessage]=useState('Cargando mapa…'),[address,setAddress]=useState(String(order?.delivery_address||'')),[destination,setDestination]=useState<Point|null>(null),[manual,setManual]=useState(false),[busy,setBusy]=useState(false),[routeInfo,setRouteInfo]=useState<{distance:number;duration:number;steps:any[]}|null>(null),[stepIndex,setStepIndex]=useState(0);
 saveRef.current=onSaveAddress;
 const stored=order?.delivery_latitude!=null&&order?.delivery_longitude!=null;
 useEffect(()=>{setAddress(String(order?.delivery_address||''));setDestination(stored?{latitude:Number(order.delivery_latitude),longitude:Number(order.delivery_longitude)}:null);setManual(false);},[order?.id,order?.delivery_address,order?.delivery_latitude,order?.delivery_longitude]);
 useEffect(()=>{let cancelled=false;void loadMapbox().then(mb=>{if(cancelled||!mapEl.current)return;if(!mapRef.current){const center=destination?[destination.longitude,destination.latitude]:[-75.88,8.75];const map=new mb.Map({container:mapEl.current,style:'mapbox://styles/mapbox/streets-v12',center,zoom:14,attributionControl:true});map.addControl(new mb.NavigationControl({showCompass:true}),'top-right');mapRef.current=map;map.on('load',()=>{if(!cancelled)setMessage('Mapa listo.');});map.on('click',(e:any)=>{setDestination({latitude:e.lngLat.lat,longitude:e.lngLat.lng});setManual(true);setMessage('Punto seleccionado. Guarda para confirmar el destino.');});}}).catch(e=>setMessage(e.message||'No se pudo cargar Mapbox.'));return()=>{cancelled=true;};},[]);
 useEffect(()=>{const map=mapRef.current;if(!map||!destination)return;const mb=window.mapboxgl;const el=document.createElement('div');el.style.cssText='width:24px;height:24px;border-radius:50% 50% 50% 0;background:#e45d52;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 8px #0005';if(destinationMarker.current)destinationMarker.current.setLngLat([destination.longitude,destination.latitude]);else destinationMarker.current=new mb.Marker({element:el,draggable:true}).setLngLat([destination.longitude,destination.latitude]).addTo(map);destinationMarker.current.setLngLat([destination.longitude,destination.latitude]);destinationMarker.current.on('dragend',()=>{const p=destinationMarker.current.getLngLat();setDestination({latitude:p.lat,longitude:p.lng});setManual(true);setMessage('Pin ajustado. Guarda para confirmar.');});if(!currentLocation)map.flyTo({center:[destination.longitude,destination.latitude],zoom:16});},[destination?.latitude,destination?.longitude]);
 useEffect(()=>{const map=mapRef.current;if(!map||!currentLocation)return;const mb=window.mapboxgl;const el=document.createElement('div');el.style.cssText='width:25px;height:25px;border-radius:50%;background:#6848df;border:4px solid white;box-shadow:0 2px 9px #0006';if(courierMarker.current)courierMarker.current.setLngLat([currentLocation.longitude,currentLocation.latitude]);else courierMarker.current=new mb.Marker({element:el}).setLngLat([currentLocation.longitude,currentLocation.latitude]).addTo(map);map.easeTo({center:[currentLocation.longitude,currentLocation.latitude],duration:650});},[currentLocation?.latitude,currentLocation?.longitude]);
 useEffect(()=>{const map=mapRef.current;if(!map||!destination||!currentLocation)return;const previous=lastRouteOrigin.current;const moved=previous?distanceBetween(previous.latitude,previous.longitude,currentLocation.latitude,currentLocation.longitude):Infinity;const elapsed=previous?Date.now()-previous.at:Infinity;if(previous&&moved<35&&elapsed<15000)return;lastRouteOrigin.current={latitude:currentLocation.latitude,longitude:currentLocation.longitude,at:Date.now()};const seq=++routeSeq.current;const token=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;const coords=[[currentLocation.longitude,currentLocation.latitude],[destination.longitude,destination.latitude]].map(pair=>pair.join(',')).join(';');const url='https://api.mapbox.com/directions/v5/mapbox/driving/'+coords+'?steps=true&geometries=geojson&overview=full&language=es&access_token='+encodeURIComponent(token);void fetch(url).then(async res=>{const data=await res.json();if(!res.ok||data.code!=='Ok'||!data.routes?.[0])throw new Error(data.message||'Mapbox no encontró una ruta para este recorrido.');if(seq!==routeSeq.current)return;const route=data.routes[0],leg=route.legs?.[0];const feature={type:'Feature',properties:{},geometry:route.geometry};if(map.getSource('menuya-route')){map.getSource('menuya-route').setData(feature);}else{map.addSource('menuya-route',{type:'geojson',data:feature});map.addLayer({id:'menuya-route-line',type:'line',source:'menuya-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#6848df','line-width':6,'line-opacity':.92}});}setRouteInfo({distance:route.distance,duration:route.duration,steps:leg?.steps||[]});setStepIndex(v=>Math.min(v,Math.max(0,(leg?.steps?.length||1)-1)));setMessage('Ruta actualizada automáticamente.');}).catch(e=>{if(seq===routeSeq.current)setMessage(e instanceof Error?e.message:'No fue posible calcular la ruta.');});},[currentLocation?.latitude,currentLocation?.longitude,destination?.latitude,destination?.longitude]);
 useEffect(()=>{if(!currentLocation||!routeInfo?.steps?.length)return;for(let i=Math.max(1,stepIndex+1);i<routeInfo.steps.length;i++){const loc=routeInfo.steps[i]?.maneuver?.location;if(!Array.isArray(loc)||loc.length<2)continue;if(distanceBetween(currentLocation.latitude,currentLocation.longitude,Number(loc[1]),Number(loc[0]))<35){setStepIndex(i);break;}}},[currentLocation?.latitude,currentLocation?.longitude,routeInfo,stepIndex]);
 const search=async()=>{if(!address.trim())return;setBusy(true);setMessage('Buscando dirección…');try{const token=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;const url='https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(address+', Montería, Córdoba, Colombia')+'.json?country=co&language=es&limit=1&access_token='+encodeURIComponent(token);const res=await fetch(url);const data=await res.json();const hit=data.features?.[0];if(!hit)throw new Error('Mapbox no encontró esa dirección. Agrega barrio o una referencia.');const [longitude,latitude]=hit.center;setDestination({latitude,longitude});setManual(true);mapRef.current?.flyTo({center:[longitude,latitude],zoom:17});setMessage('Dirección encontrada. Verifica el pin y guarda.');}catch(e){setMessage(e instanceof Error?e.message:'No se pudo buscar la dirección.');}finally{setBusy(false);}};
 const save=async()=>{if(!destination)return;setBusy(true);try{await saveRef.current(address,{latitude:destination.latitude,longitude:destination.longitude});setManual(false);setMessage('Destino guardado correctamente.');}catch(e){setMessage(e instanceof Error?e.message:'No se pudo guardar el destino.');}finally{setBusy(false);}};
 const activeStep=routeInfo?.steps?.[stepIndex];const instruction=activeStep?.maneuver?.type==='arrive'?'Has llegado al destino':activeStep?.name?activeStep.name:activeStep?.maneuver?.type==='depart'?'Inicia el recorrido':'Continúa por la vía';
 return <div className="cp-map-wrap cp-map-experience">
  <div ref={mapEl} className="cp-live-map" role="application" aria-label="Mapa Mapbox de entrega"/>
  <div className="cp-map-floating-top">
   <div className="cp-map-live-pill"><span className="cp-route-dot"/>{currentLocation?'GPS EN VIVO':'ESPERANDO GPS'}</div>
   <button type="button" className="cp-map-locate" aria-label="Centrar mapa" onClick={()=>currentLocation&&mapRef.current?.flyTo({center:[currentLocation.longitude,currentLocation.latitude],zoom:16})}><Navigation size={18}/></button>
  </div>
  {routeInfo&&<div className="cp-map-turn-card">
   <span className="cp-nav-arrow"><Navigation size={22}/></span>
   <div className="cp-nav-copy"><small>PRÓXIMA INDICACIÓN</small><b>{instruction}</b><small>{activeStep?.distance?Math.round(activeStep.distance)+' m hasta el siguiente giro':'Sigue la ruta marcada'}</small></div>
  </div>}
  <div className="cp-map-bottom-sheet">
   <div className="cp-map-sheet-handle"/>
   <div className="cp-map-sheet-head"><div><small>ENTREGA · PEDIDO #{order?.order_number||'—'}</small><b>{address||'Destino por confirmar'}</b></div><span className={currentLocation?'cp-map-gps-ok':'cp-map-gps-wait'}>{currentLocation?'En ruta':'Sin GPS'}</span></div>
   <div className="cp-map-kpis">
    <div><b>{routeInfo?(routeInfo.distance/1000).toFixed(1).replace('.',',')+' km':'—'}</b><small>Distancia</small></div>
    <div><b>{routeInfo?Math.max(1,Math.round(routeInfo.duration/60))+' min':'—'}</b><small>Tiempo estimado</small></div>
    <div><b>{routeInfo?Math.max(1,routeInfo.steps.length):'—'}</b><small>Indicaciones</small></div>
   </div>
   <div className="cp-map-route-state">{message}</div>
   <details className="cp-map-edit">
    <summary><MapPin size={15}/> Dirección y ajustes de entrega</summary>
    <div className="cp-map-edit-body">
     <label>Dirección del cliente<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección del cliente"/></label>
     <div className="cp-map-edit-actions"><button type="button" onClick={()=>void search()} disabled={busy||!address.trim()}>{busy?'Buscando…':'Buscar dirección'}</button>{(!stored||manual)&&<button type="button" disabled={!destination||busy} onClick={()=>void save()}>{busy?'Guardando…':'Guardar destino'}</button>}</div>
     <small>Toca el mapa o arrastra el marcador para ajustar el punto de entrega.</small>
    </div>
   </details>
  </div>
 </div>;
}
