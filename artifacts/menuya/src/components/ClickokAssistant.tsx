import { useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, CircleHelp, MessageCircle, Search, Send, Sparkles, X } from 'lucide-react';
import './ClickokAssistant.css';

type Answer = { id: string; category: string; question: string; answer: string; keywords: string };
type Props = { businessName: string };

const answers: Answer[] = [
  { id: 'product', category: 'Productos', question: '¿Cómo creo un producto?', answer: '1. Entra a Productos en el menú lateral.\n2. Pulsa el botón para crear un producto.\n3. Completa nombre, descripción, precio y categoría.\n4. Agrega una foto y guarda.\n\nDespués revisa que aparezca correctamente en tu catálogo.', keywords: 'crear agregar nuevo editar producto foto imagen precio' },
  { id: 'category', category: 'Productos', question: '¿Cómo creo categorías?', answer: '1. Abre Categorías desde el menú lateral.\n2. Crea una categoría con un nombre claro.\n3. Guarda y luego asígnala a tus productos desde su edición.\n\nAsí tus clientes podrán encontrar los productos más fácilmente.', keywords: 'categoría organizar clasificar grupos' },
  { id: 'store', category: 'Vitrina', question: '¿Cómo publico mi vitrina?', answer: '1. Entra a CLICKOK Studio.\n2. Elige una plantilla y personaliza los elementos disponibles.\n3. Revisa la vista previa.\n4. Guarda y utiliza la opción Publicar.\n5. Abre “Ver tienda pública” para comprobar el resultado y copiar el enlace.', keywords: 'publicar vitrina tienda link enlace compartir catálogo' },
  { id: 'studio', category: 'Vitrina', question: '¿Cómo cambio el diseño de mi vitrina?', answer: 'Abre CLICKOK Studio desde el menú lateral. Allí puedes explorar las plantillas disponibles, ajustar los colores y la identidad visual, revisar los cambios en la vista previa y publicar cuando estés conforme.', keywords: 'clickstudio click studio diseño colores plantilla logo apariencia' },
  { id: 'orders', category: 'Pedidos', question: '¿Dónde veo los pedidos?', answer: 'Entra a Pedidos desde el menú lateral. Abre cualquier pedido para consultar sus productos, cantidades y datos de entrega. Desde su detalle puedes actualizar el estado según el flujo habilitado para tu comercio.', keywords: 'pedido compra orden venta estado cliente' },
  { id: 'pos', category: 'Ventas', question: '¿Cómo registro una venta en el POS?', answer: '1. Abre Punto de venta en el menú lateral.\n2. Busca y agrega los productos.\n3. Revisa cantidades y total.\n4. Selecciona el medio de pago y confirma solo cuando hayas recibido el pago.\n5. Verifica el registro de la venta.', keywords: 'pos punto venta caja vender presencial' },
  { id: 'courier', category: 'Domicilios', question: '¿Cómo gestiono los domiciliarios?', answer: 'Abre Domiciliarios en el menú lateral. Desde ese módulo puedes consultar y administrar los repartidores disponibles para tu comercio y revisar la asignación de entregas según las opciones habilitadas.', keywords: 'domiciliario repartidor entrega mensajero asignar' },
  { id: 'wompi', category: 'Pagos', question: '¿Cómo conecto Wompi?', answer: 'Entra a los ajustes de pagos habilitados para tu comercio y configura la cuenta Wompi correspondiente. Realiza primero las pruebas en sandbox y verifica que la cuenta esté habilitada antes de pasar a producción. Nunca compartas claves privadas ni secretos por el chat.', keywords: 'wompi pasarela pago cobrar tarjeta credenciales' },
  { id: 'push', category: 'Notificaciones', question: '¿Cómo activo las notificaciones?', answer: 'Entra a Ajustes del negocio y busca Notificaciones push. Pulsa Activar notificaciones y acepta el permiso del navegador o del sistema. En iPhone y iPad, abre CLICKOK desde el icono añadido a la pantalla de inicio para habilitarlas.', keywords: 'notificación push aviso pedido alerta activar' },
  { id: 'settings', category: 'Configuración', question: '¿Dónde cambio los datos de mi negocio?', answer: 'Abre Ajustes desde el menú lateral. Allí puedes revisar la información pública, teléfono, correo, redes sociales, métodos de pago y opciones de entrega. Guarda los cambios y comprueba cómo se muestran en tu vitrina.', keywords: 'ajustes configuración negocio teléfono correo dirección datos' },
  { id: 'subscription', category: 'Cuenta y plan', question: '¿Cómo consulto mi plan?', answer: 'Entra a Mi plan desde el menú lateral. Allí puedes revisar el plan activo, sus funciones y la información de renovación que aparece en tu cuenta.', keywords: 'plan suscripción mensualidad renovar precio' },
  { id: 'customers', category: 'Ventas', question: '¿Dónde consulto mis clientes?', answer: 'Abre Clientes en el menú lateral. Utiliza la búsqueda para localizar un registro y entra al detalle para consultar la información disponible de ese cliente.', keywords: 'clientes compradores contactos buscar' },
];

const categories = ['Todos', 'Productos', 'Vitrina', 'Pedidos', 'Ventas', 'Domicilios', 'Pagos', 'Notificaciones', 'Configuración', 'Cuenta y plan'];
const suggestions = ['¿Cómo creo un producto?', '¿Cómo publico mi vitrina?', '¿Dónde veo mis pedidos?', '¿Cómo conecto Wompi?'];

export default function ClickokAssistant({ businessName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [history, setHistory] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-CO');
    return answers.filter(item => (category === 'Todos' || item.category === category) &&
      (!q || `${item.question} ${item.category} ${item.keywords} ${item.answer}`.toLocaleLowerCase('es-CO').includes(q)));
  }, [query, category]);
  const ask = (text: string) => {
    const normalized = text.toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const found = answers.find(item => {
      const terms = `${item.question} ${item.keywords}`.toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(word => word.length > 3);
      return terms.some(term => normalized.includes(term));
    });
    setHistory(current => [...current, { role: 'user', text }, { role: 'bot', text: found ? found.answer : 'Todavía no tengo una respuesta aprobada para esa consulta. Prueba con una de las categorías o preguntas frecuentes. Si necesitas ayuda adicional, contacta al equipo de soporte de CLICKOK.' }]);
    setQuery('');
  };
  const reset = () => { setHistory([]); setQuery(''); setCategory('Todos'); };
  return <div className="clickok-ai-root">
    {open && <section className="clickok-ai-panel" role="dialog" aria-label="Asistente CLICKOK AI">
      <header className="clickok-ai-header">
        <div className="clickok-ai-avatar"><Bot size={21}/></div>
        <div className="clickok-ai-heading"><b>CLICKOK AI</b><span><i/> Asistente de {businessName}</span></div>
        <button type="button" className="clickok-ai-icon-btn" onClick={reset} title="Nueva conversación" aria-label="Nueva conversación"><Sparkles size={17}/></button>
        <button type="button" className="clickok-ai-icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar asistente"><X size={19}/></button>
      </header>
      <div className="clickok-ai-body">
        {history.length === 0 ? <>
          <div className="clickok-ai-welcome"><span className="clickok-ai-welcome-icon"><Sparkles size={18}/></span><b>¡Hola! ¿En qué puedo ayudarte?</b><p>Encuentra respuestas rápidas para administrar tu comercio en CLICKOK.</p></div>
          <label className="clickok-ai-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Busca una pregunta o función…"/></label>
          <div className="clickok-ai-categories">{categories.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="clickok-ai-faq-title">{query || category !== 'Todos' ? 'Resultados' : 'Preguntas frecuentes'}</div>
          <div className="clickok-ai-questions">{matches.map(item => <button type="button" key={item.id} onClick={() => { setHistory([{ role: 'user', text: item.question }, { role: 'bot', text: item.answer }]); }}><span>{item.question}</span><ChevronRight size={16}/></button>)}{matches.length === 0 && <p className="clickok-ai-empty">No encontramos esa pregunta. Prueba con otras palabras.</p>}</div>
          {!query && category === 'Todos' && <div className="clickok-ai-suggestions">{suggestions.map(item => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}</div>}
        </> : <div className="clickok-ai-conversation">
          {history.map((item, index) => <div className={`clickok-ai-message ${item.role}`} key={index}><span>{item.role === 'bot' ? <Bot size={15}/> : 'Tú'}</span><p>{item.text}</p></div>)}
          <button type="button" className="clickok-ai-back" onClick={reset}><ChevronDown size={15}/> Volver a las preguntas</button>
        </div>}
      </div>
      <footer className="clickok-ai-footer"><CircleHelp size={15}/><span>Respuestas predefinidas · Sin IA externa</span><button type="button" onClick={() => { setHistory([]); setQuery(''); }}>Inicio</button></footer>
    </section>}
    <button type="button" className={`clickok-ai-launcher ${open ? 'is-open' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? 'Cerrar CLICKOK AI' : 'Abrir CLICKOK AI'} aria-expanded={open}>
      {open ? <X size={23}/> : <><MessageCircle size={22}/><span>Ayuda</span></>}
    </button>
  </div>;
}
