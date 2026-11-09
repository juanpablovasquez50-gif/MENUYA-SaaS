import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, CheckCircle2,
  CircleHelp, ClipboardList, CreditCard, Package, Pencil, Search, Settings,
  ShoppingBag, ShoppingCart, Store, Tags, Users, Utensils, X
} from 'lucide-react';
import './HelpCenter.css';

type Tutorial = {
  id: string;
  title: string;
  category: string;
  summary: string;
  icon: LucideIcon;
  steps: string[];
  note?: string;
  keywords?: string;
};

type Props = {
  businessId: string;
  businessName: string;
  businessType: string;
};

const tutorials: Tutorial[] = [
  {
    id: 'start',
    title: 'Conoce tu panel de CLICKOK',
    category: 'Primeros pasos',
    summary: 'Ubica las secciones principales y empieza a organizar tu negocio.',
    icon: Store,
    steps: [
      'Inicia sesión con el correo y la contraseña de tu cuenta.',
      'En el menú lateral encontrarás Inicio, Catálogo, Productos, Pedidos y las demás herramientas habilitadas para tu comercio.',
      'En la parte superior puedes identificar el comercio activo y acceder a las acciones de tu cuenta.',
      'Completa primero la información de tu negocio y luego organiza tu catálogo.'
    ]
  },
  {
    id: 'products',
    title: 'Crea y administra productos',
    category: 'Catálogo y vitrina',
    summary: 'Agrega productos, precios, fotos y descripciones.',
    icon: Package,
    steps: [
      'Entra a Productos desde el menú lateral.',
      'Selecciona la opción para crear un producto.',
      'Completa el nombre, descripción, precio y categoría.',
      'Agrega una imagen clara del producto y guarda los cambios.',
      'Revisa el resultado en tu catálogo antes de compartir la vitrina.'
    ],
    note: 'Los campos disponibles pueden variar según el tipo de comercio.'
  },
  {
    id: 'categories',
    title: 'Organiza tus categorías',
    category: 'Catálogo y vitrina',
    summary: 'Agrupa tus productos para que los clientes encuentren lo que buscan.',
    icon: Tags,
    steps: [
      'Abre Categorías en el menú lateral.',
      'Crea una categoría con un nombre fácil de reconocer.',
      'Guarda y asígnala a los productos correspondientes desde su edición.',
      'Revisa el orden y la presentación en tu vitrina.'
    ]
  },
  {
    id: 'storefront',
    title: 'Publica y comparte tu vitrina',
    category: 'Catálogo y vitrina',
    summary: 'Comprueba cómo ven tus clientes tu tienda digital.',
    icon: ShoppingBag,
    steps: [
      'Abre CLICKOK Studio para personalizar la apariencia de tu vitrina.',
      'Revisa colores, plantilla, identidad y vista previa.',
      'Guarda los cambios y utiliza la opción de publicación disponible en el editor.',
      'Desde el menú lateral, usa “Ver tienda pública” para abrir tu vitrina.',
      'Copia el enlace público y compártelo con tus clientes.'
    ],
    note: 'Si acabas de cambiar el diseño, abre nuevamente la vitrina para comprobar que se publicó correctamente.'
  },
  {
    id: 'editor',
    title: 'Personaliza tu vitrina en CLICKOK Studio',
    category: 'Catálogo y vitrina',
    summary: 'Adapta el diseño a la identidad de tu marca.',
    icon: Pencil,
    steps: [
      'Entra a CLICKOK Studio desde el menú lateral.',
      'Explora las plantillas disponibles y selecciona la que mejor represente tu negocio.',
      'Ajusta los colores y los elementos de identidad que permite el editor.',
      'Comprueba cada cambio en la vista previa.',
      'Guarda y publica cuando estés conforme con el resultado.'
    ]
  },
  {
    id: 'orders',
    title: 'Gestiona los pedidos de tu vitrina',
    category: 'Ventas y operación',
    summary: 'Consulta pedidos, revisa sus detalles y actualiza su estado.',
    icon: ClipboardList,
    steps: [
      'Entra a Pedidos para consultar las compras recibidas.',
      'Abre un pedido para revisar productos, cantidades y datos del cliente.',
      'Actualiza el estado conforme avances en la preparación y entrega.',
      'Consulta el seguimiento para verificar que el cambio se refleje al cliente.'
    ],
    note: 'Los estados disponibles dependen del flujo habilitado para tu comercio.'
  },
  {
    id: 'pos',
    title: 'Realiza ventas desde el punto de venta',
    category: 'Ventas y operación',
    summary: 'Registra ventas presenciales desde el POS.',
    icon: ShoppingCart,
    steps: [
      'Abre Punto de venta desde el menú lateral.',
      'Busca y agrega los productos a la venta.',
      'Revisa cantidades y total antes de continuar.',
      'Selecciona el medio de pago disponible y confirma únicamente cuando hayas recibido el pago.',
      'Verifica que la venta aparezca en los registros correspondientes.'
    ],
    note: 'El Punto de venta requiere que tu plan tenga habilitado este módulo.'
  },
  {
    id: 'customers',
    title: 'Consulta y organiza tus clientes',
    category: 'Ventas y operación',
    summary: 'Revisa la información de los clientes registrados en tu comercio.',
    icon: Users,
    steps: [
      'Entra a Clientes desde el menú lateral.',
      'Busca el registro que necesitas consultar.',
      'Abre el detalle para revisar la información disponible.',
      'Mantén los datos de contacto actualizados cuando corresponda.'
    ]
  },
  {
    id: 'analytics',
    title: 'Consulta la analítica de tu negocio',
    category: 'Ventas y operación',
    summary: 'Revisa los indicadores y la actividad registrada.',
    icon: BarChart3,
    steps: [
      'Abre Analítica desde el menú lateral.',
      'Selecciona el periodo o filtro disponible.',
      'Revisa los indicadores, productos consultados y actividad que muestra el panel.',
      'Usa la información como apoyo para tomar decisiones sobre tu negocio.'
    ],
    note: 'Los resultados dependen de la actividad registrada y del periodo seleccionado.'
  },
  {
    id: 'push',
    title: 'Activa las notificaciones de nuevos pedidos',
    category: 'Notificaciones',
    summary: 'Recibe avisos en tu dispositivo cuando llegue un pedido.',
    icon: Bell,
    steps: [
      'Abre CLICKOK desde el icono instalado en la pantalla de inicio cuando tu dispositivo lo requiera.',
      'Inicia sesión y entra a Ajustes del negocio.',
      'Busca la sección de Notificaciones push y pulsa Activar notificaciones.',
      'Cuando el navegador o el sistema muestre la solicitud, selecciona Permitir.',
      'Comprueba que CLICKOK indique que las notificaciones están activadas.'
    ],
    note: 'En iPhone y iPad se requiere una versión compatible de iOS/iPadOS y tener CLICKOK añadido a la pantalla de inicio. En Android y computadores, el permiso se concede desde el navegador. Si bloqueaste el permiso, habilítalo desde los ajustes del sitio en el navegador.'
  },
  {
    id: 'wompi',
    title: 'Conecta y prueba los pagos con Wompi',
    category: 'Pagos y cuenta',
    summary: 'Conoce las recomendaciones para configurar tu pasarela de pagos.',
    icon: CreditCard,
    steps: [
      'Entra al módulo de configuración de pagos habilitado para tu comercio.',
      'Conecta la cuenta Wompi del propio comercio y utiliza las credenciales que correspondan a ese ambiente.',
      'Realiza las primeras verificaciones en ambiente de pruebas (sandbox).',
      'Antes de recibir pagos reales, confirma que la cuenta esté activada y que las credenciales sean las de producción.',
      'Verifica que el pedido solo se marque como pagado después de la confirmación válida de Wompi.'
    ],
    note: 'Nunca compartas claves privadas, secretos ni códigos de acceso. No uses credenciales de pruebas para cobrar a clientes.'
  },
  {
    id: 'settings',
    title: 'Configura la información de tu negocio',
    category: 'Pagos y cuenta',
    summary: 'Mantén actualizados tus datos públicos, métodos de pago y entregas.',
    icon: Settings,
    steps: [
      'Abre Ajustes desde el menú lateral.',
      'En Información pública, revisa nombre, teléfono, correo y redes sociales.',
      'En Pagos y entregas, actualiza los métodos y opciones que ofreces.',
      'Guarda cada cambio y comprueba la información que verán tus clientes.'
    ]
  },
  {
    id: 'subscription',
    title: 'Consulta tu plan y suscripción',
    category: 'Pagos y cuenta',
    summary: 'Revisa las funciones disponibles en tu plan.',
    icon: CreditCard,
    steps: [
      'Entra a Mi plan desde el menú lateral.',
      'Consulta el plan activo, su valor y la fecha de renovación que aparece en tu cuenta.',
      'Compara las funciones de los planes disponibles.',
      'Si decides cambiar de plan, revisa el valor antes de iniciar el pago.'
    ],
    note: 'No cierres la ventana de pago hasta que Wompi confirme el resultado de la transacción.'
  },
  {
    id: 'restaurant',
    title: 'Administra mesas y meseros',
    category: 'Herramientas del negocio',
    summary: 'Consulta las herramientas operativas para restaurantes.',
    icon: Utensils,
    steps: [
      'Abre Mesas y meseros si el módulo está habilitado para tu comercio.',
      'Revisa las mesas y sesiones activas.',
      'Asigna o consulta la atención de los meseros según las opciones disponibles.',
      'Verifica los cambios en el panel antes de cerrar una operación.'
    ],
    note: 'Este tutorial aplica a comercios de gastronomía que tengan habilitado el módulo.'
  }
];

const categories = ['Todos', 'Primeros pasos', 'Catálogo y vitrina', 'Ventas y operación', 'Notificaciones', 'Pagos y cuenta', 'Herramientas del negocio'];

export default function HelpCenter({ businessId, businessName, businessType }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    const key = `clickok-help-welcome-${businessId}`;
    try {
      if (!window.localStorage.getItem(key)) setWelcome(true);
    } catch {
      setWelcome(false);
    }
  }, [businessId]);

  const availableTutorials = useMemo(() => tutorials.filter(item => item.id !== 'restaurant' || /restaurante|gastronom|comida|cafeter|panader|bar/i.test(businessType)), [businessType]);

  const filtered = useMemo(() => availableTutorials.filter(item => {
    const matchesCategory = category === 'Todos' || item.category === category;
    const haystack = `${item.title} ${item.summary} ${item.category} ${item.keywords || ''}`.toLocaleLowerCase('es-CO');
    return matchesCategory && haystack.includes(query.trim().toLocaleLowerCase('es-CO'));
  }), [availableTutorials, category, query]);

  const current = availableTutorials.find(item => item.id === selected);
  const dismissWelcome = () => {
    setWelcome(false);
    try { window.localStorage.setItem(`clickok-help-welcome-${businessId}`, '1'); } catch { /* Storage may be unavailable. */ }
  };

  return <div className="help-center">
    {welcome && <div className="help-welcome" role="dialog" aria-label="Bienvenido al Centro de ayuda">
      <button className="help-welcome-close" onClick={dismissWelcome} aria-label="Cerrar bienvenida"><X size={18}/></button>
      <div className="help-welcome-icon"><BookOpen size={23}/></div>
      <span className="eyebrow">BIENVENIDO A CLICKOK</span>
      <h2>Aprende a manejar tu negocio con confianza.</h2>
      <p>Reunimos guías sencillas para configurar tu vitrina, gestionar pedidos, recibir notificaciones y aprovechar las herramientas de tu comercio.</p>
      <button className="btn btn-solid" onClick={dismissWelcome}>Explorar tutoriales <ArrowRight size={16}/></button>
    </div>}

    <div className="help-hero">
      <div>
        <span className="eyebrow">CENTRO DE AYUDA · {businessName.toLocaleUpperCase('es-CO')}</span>
        <h1>Todo lo que necesitas<br/><em>para sacarle provecho a CLICKOK.</em></h1>
        <p>Guías prácticas para cada parte de tu negocio. Encuentra una respuesta y sigue trabajando.</p>
      </div>
      <div className="help-hero-mark"><BookOpen size={42}/><span>CLICKOK<br/>ACADEMIA</span></div>
    </div>

    <div className="help-search-row">
      <label className="help-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar un tutorial, función o palabra…" aria-label="Buscar tutoriales"/></label>
      <label className="help-filter"><span>Área</span><select value={category} onChange={e => { setCategory(e.target.value); setSelected(null); }}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
    </div>

    {current ? <section className="help-detail">
      <button className="help-back" onClick={() => setSelected(null)}><ArrowLeft size={16}/> Volver a todos los tutoriales</button>
      <div className="help-detail-head"><span className="help-tutorial-icon"><current.icon size={23}/></span><div><span className="eyebrow">{current.category}</span><h2>{current.title}</h2><p>{current.summary}</p></div></div>
      <ol className="help-steps">{current.steps.map((step, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
      {current.note && <div className="help-note"><CircleHelp size={18}/><p>{current.note}</p></div>}
      <div className="help-detail-footer"><CheckCircle2 size={17}/> Cuando termines, vuelve al Centro de ayuda para elegir otra guía.</div>
    </section> : <>
      <div className="help-section-heading"><div><span className="eyebrow">APRENDE A TU RITMO</span><h2>Tutoriales disponibles</h2></div><span>{filtered.length} guías</span></div>
      {filtered.length ? <div className="help-grid">{filtered.map(item => {
        const Icon = item.icon;
        return <button className="help-card" key={item.id} onClick={() => setSelected(item.id)}>
          <span className="help-card-icon"><Icon size={20}/></span><span className="help-card-category">{item.category}</span><b>{item.title}</b><p>{item.summary}</p><span className="help-card-link">Ver tutorial <ArrowRight size={15}/></span>
        </button>;
      })}</div> : <div className="help-empty"><Search size={22}/><b>No encontramos tutoriales</b><p>Prueba con otra palabra o selecciona “Todos”.</p></div>}
    </>}
    <div className="help-contact-strip"><CircleHelp size={20}/><div><b>¿No encontraste lo que buscabas?</b><p>Consulta las guías disponibles o contacta al equipo de soporte de CLICKOK.</p></div><span className="help-support-hint">Consulta el canal de soporte de tu cuenta.</span></div>
  </div>;
}
