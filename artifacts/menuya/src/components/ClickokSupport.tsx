import { Headset, Search, Inbox, Clock3, CheckCircle2, UserRound, ShieldCheck, MessageCircle, ArrowUpRight, LockKeyhole } from 'lucide-react';
import './ClickokSupport.css';

const sampleTickets = [
  { id: 'CK-2048', name: 'Comercializadora La 14', subject: 'No puedo publicar mi vitrina', time: 'Hace 3 min', status: 'Pendiente', initials: 'CL', color: 'violet' },
  { id: 'CK-2047', name: 'Restaurante Sazón', subject: 'Duda sobre los pedidos', time: 'Hace 18 min', status: 'En espera', initials: 'RS', color: 'orange' },
  { id: 'CK-2046', name: 'Moda Caribe', subject: 'Necesito cambiar mi plan', time: 'Hace 42 min', status: 'Pendiente', initials: 'MC', color: 'blue' },
];

export default function ClickokSupport() {
  return <main className="cks-page">
    <header className="cks-topbar"><a className="cks-brand" href="/"><span className="cks-mark">C</span><b>CLICKOK <span>SUPPORT</span></b></a><div className="cks-top-right"><span className="cks-preview"><i/> Vista previa</span><span className="cks-avatar">AD</span></div></header>
    <div className="cks-layout">
      <aside className="cks-sidebar"><div className="cks-workspace"><span className="cks-workspace-icon"><Headset size={18}/></span><span><b>Centro de soporte</b><small>Workspace interno</small></span></div>
        <span className="cks-nav-label">ATENCIÓN</span><div className="cks-nav-item active"><Inbox size={17}/> Bandeja de entrada <b>3</b></div><div className="cks-nav-item"><Clock3 size={17}/> Mis asignaciones</div><div className="cks-nav-item"><CheckCircle2 size={17}/> Resueltos</div>
        <div className="cks-sidebar-bottom"><div className="cks-secure"><ShieldCheck size={17}/><b>Acceso independiente</b><small>Los representantes no necesitan entrar al panel administrativo.</small></div><div className="cks-agent"><span className="cks-avatar">AD</span><span><b>Área de soporte</b><small>Configuración pendiente</small></span></div></div>
      </aside>
      <section className="cks-main"><div className="cks-heading"><div><span className="cks-kicker">OPERACIONES · SOPORTE</span><h1>Bandeja de entrada</h1><p>Atiende las solicitudes de los comercios que utilizan CLICKOK.</p></div><button className="cks-outline" disabled><UserRound size={16}/> Gestionar equipo</button></div>
        <div className="cks-stats"><article><span>Conversaciones abiertas</span><b>03</b><small><Inbox size={13}/> Solicitudes por atender</small></article><article><span>Tiempo medio de respuesta</span><b>—</b><small><Clock3 size={13}/> Se calculará al activar el servicio</small></article><article><span>Resueltas hoy</span><b>—</b><small><CheckCircle2 size={13}/> Sin actividad todavía</small></article></div>
        <div className="cks-inbox"><div className="cks-list"><div className="cks-list-head"><div><b>Conversaciones</b><small>Vista ilustrativa · datos de ejemplo</small></div><button aria-label="Buscar" className="cks-search"><Search size={17}/></button></div>{sampleTickets.map(t=><article className="cks-ticket" key={t.id}><span className={`cks-ticket-avatar ${t.color}`}>{t.initials}</span><div className="cks-ticket-body"><div><b>{t.name}</b><small>{t.time}</small></div><p>{t.subject}</p><span className="cks-ticket-status">{t.status}</span></div></article>)}</div>
          <div className="cks-conversation"><div className="cks-empty-icon"><MessageCircle size={25}/></div><h2>Tu equipo de soporte, en un solo lugar</h2><p>Cuando se active el módulo, aquí podrás abrir conversaciones, responder a los comerciantes y consultar todo el historial de atención.</p><div className="cks-empty-note"><LockKeyhole size={16}/> Las conversaciones reales estarán disponibles después de configurar los accesos y la conexión en tiempo real.</div></div>
        </div>
        <footer className="cks-footer"><span>CLICKOK SUPPORT · ATOM LABS</span><span><ShieldCheck size={14}/> Módulo independiente</span></footer>
      </section>
    </div>
  </main>;
}
