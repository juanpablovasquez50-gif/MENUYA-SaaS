import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Plus, Send, Sparkles, X } from 'lucide-react';
import './ClickokAssistant.css';

type Answer = { id: string; category: string; question: string; answer: string; keywords: string };
type Props = { businessName: string };
type Message = { role: 'bot' | 'user'; text: string };

const answers: Answer[] = [
  { id: 'product', category: 'Productos', question: '¿Cómo creo un producto?', answer: 'Para crear un producto:\n1. Entra a **Productos** en el menú lateral.\n2. Pulsa **Crear producto**.\n3. Completa el nombre, descripción, precio y categoría.\n4. Agrega una foto y guarda.\n\nDespués revisa que aparezca correctamente en tu catálogo.', keywords: 'crear agregar nuevo editar producto foto imagen precio catálogo' },
  { id: 'category', category: 'Productos', question: '¿Cómo creo categorías?', answer: 'Abre **Categorías** desde el menú lateral, crea una categoría con un nombre claro y guarda. Luego asígnala a tus productos desde su edición para que tus clientes puedan encontrarlos más fácilmente.', keywords: 'categoría organizar clasificar grupos' },
  { id: 'store', category: 'Vitrina', question: '¿Cómo publico mi vitrina?', answer: 'Para publicar tu vitrina:\n1. Entra a **CLICKOK Studio**.\n2. Elige una plantilla y personaliza el diseño.\n3. Revisa la vista previa.\n4. Guarda y pulsa **Publicar**.\n5. Abre **Ver tienda pública** para comprobar el resultado y copiar el enlace.', keywords: 'publicar vitrina tienda link enlace compartir catálogo' },
  { id: 'studio', category: 'Vitrina', question: '¿Cómo cambio el diseño de mi vitrina?', answer: 'Abre **CLICKOK Studio** desde el menú lateral. Allí puedes explorar las plantillas, ajustar los colores y la identidad visual, revisar los cambios en la vista previa y publicar cuando estés conforme.', keywords: 'clickstudio click studio diseño colores plantilla logo apariencia' },
  { id: 'orders', category: 'Pedidos', question: '¿Dónde veo los pedidos?', answer: 'Entra a **Pedidos** desde el menú lateral. Abre cualquier pedido para consultar sus productos, cantidades y datos de entrega. Desde el detalle puedes actualizar el estado según el flujo habilitado para tu comercio.', keywords: 'pedido compra orden venta estado cliente' },
  { id: 'pos', category: 'Ventas', question: '¿Cómo registro una venta en el POS?', answer: 'Abre **Punto de venta** en el menú lateral, busca y agrega los productos, revisa cantidades y total, selecciona el medio de pago y confirma solo cuando hayas recibido el pago. Después verifica el registro de la venta.', keywords: 'pos punto venta caja vender presencial' },
  { id: 'courier', category: 'Domicilios', question: '¿Cómo gestiono los domiciliarios?', answer: 'Abre **Domiciliarios** en el menú lateral. Desde ese módulo puedes consultar y administrar los repartidores disponibles para tu comercio y revisar la asignación de entregas según las opciones habilitadas.', keywords: 'domiciliario repartidor entrega mensajero asignar' },
  { id: 'wompi', category: 'Pagos', question: '¿Cómo conecto Wompi?', answer: 'Entra a los ajustes de pagos habilitados para tu comercio y configura la cuenta Wompi correspondiente. Realiza primero las pruebas en sandbox y verifica que la cuenta esté habilitada antes de pasar a producción. Nunca compartas claves privadas ni secretos por el chat.', keywords: 'wompi pasarela pago cobrar tarjeta credenciales' },
  { id: 'push', category: 'Notificaciones', question: '¿Cómo activo las notificaciones?', answer: 'Entra a **Ajustes del negocio** y busca **Notificaciones push**. Pulsa Activar notificaciones y acepta el permiso del navegador o del sistema. En iPhone y iPad, abre CLICKOK desde el icono añadido a la pantalla de inicio para habilitarlas.', keywords: 'notificación push aviso pedido alerta activar' },
  { id: 'settings', category: 'Configuración', question: '¿Dónde cambio los datos de mi negocio?', answer: 'Abre **Ajustes** desde el menú lateral. Allí puedes revisar la información pública, teléfono, correo, redes sociales, métodos de pago y opciones de entrega. Guarda los cambios y comprueba cómo se muestran en tu vitrina.', keywords: 'ajustes configuración negocio teléfono correo dirección datos' },
  { id: 'subscription', category: 'Cuenta y plan', question: '¿Cómo consulto mi plan?', answer: 'Entra a **Mi plan** desde el menú lateral. Allí puedes revisar el plan activo, sus funciones y la información de renovación que aparece en tu cuenta.', keywords: 'plan suscripción mensualidad renovar precio' },
  { id: 'customers', category: 'Ventas', question: '¿Dónde consulto mis clientes?', answer: 'Abre **Clientes** en el menú lateral. Utiliza la búsqueda para localizar un registro y entra al detalle para consultar la información disponible de ese cliente.', keywords: 'clientes compradores contactos buscar' },
];

const suggestions = ['¿Cómo creo un producto?', '¿Cómo publico mi vitrina?', '¿Dónde veo mis pedidos?', '¿Cómo conecto Wompi?'];
const normalize = (value: string) => value.toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ClickokAssistant({ businessName }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const greeting = useMemo(() => `¡Hola! 👋 Soy el asistente de CLICKOK para ${businessName}. Estoy aquí para ayudarte a gestionar tu comercio. ¿Qué necesitas saber?`, [businessName]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, history, typing]);

  const findAnswer = (question: string) => {
    const q = normalize(question);
    const tokens = q.split(/[^a-z0-9]+/).filter(word => word.length > 2);
    let best: Answer | undefined;
    let bestScore = 0;
    for (const item of answers) {
      const haystack = normalize(`${item.question} ${item.keywords} ${item.category}`);
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? (item.question.toLowerCase().includes(token) ? 3 : 1) : 0), 0);
      if (score > bestScore) { best = item; bestScore = score; }
    }
    return bestScore >= 2 ? best : undefined;
  };

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question || typing) return;
    const found = findAnswer(question);
    setHistory(current => [...current, { role: 'user', text: question }]);
    setInput('');
    setTyping(true);
    window.setTimeout(() => {
      setHistory(current => [...current, { role: 'bot', text: found ? found.answer : 'No tengo una respuesta confirmada para esa consulta todavía. Puedes preguntarme por productos, vitrina, pedidos, ventas, domicilios, pagos o configuración. Si necesitas ayuda adicional, te orientaré para contactar al equipo de soporte de CLICKOK.' }]);
      setTyping(false);
    }, 550);
  };

  const startNewChat = () => { setHistory([]); setInput(''); setTyping(false); };
  const messages = history.length ? history : [{ role: 'bot' as const, text: greeting }];

  return <div className="clickok-ai-root">
    {open && <section className="clickok-ai-panel" role="dialog" aria-label="Chat de ayuda CLICKOK">
      <header className="clickok-ai-header">
        <div className="clickok-ai-avatar"><Bot size={21}/><span/></div>
        <div className="clickok-ai-heading"><b>CLICKOK AI</b><span><i/> En línea · Ayuda para tu negocio</span></div>
        <button type="button" className="clickok-ai-icon-btn" onClick={startNewChat} title="Nueva conversación" aria-label="Nueva conversación"><Plus size={19}/></button>
        <button type="button" className="clickok-ai-icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar chat"><X size={19}/></button>
      </header>
      <div className="clickok-ai-body">
        <div className="clickok-ai-date"><span>CHAT DE SOPORTE</span></div>
        <div className="clickok-ai-conversation">
          {messages.map((item, index) => <div className={`clickok-ai-message ${item.role}`} key={index}>
            {item.role === 'bot' && <span className="clickok-ai-message-avatar"><Bot size={15}/></span>}
            <div className="clickok-ai-message-content"><small>{item.role === 'bot' ? 'CLICKOK AI' : 'Tú'}</small><p>{item.text}</p></div>
          </div>)}
          {history.length === 0 && <div className="clickok-ai-quick-replies"><span>Preguntas frecuentes</span>{suggestions.map(item => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}</div>}
          {typing && <div className="clickok-ai-message bot"><span className="clickok-ai-message-avatar"><Bot size={15}/></span><div className="clickok-ai-typing"><i/><i/><i/></div></div>}
          <div ref={endRef}/>
        </div>
      </div>
      <footer className="clickok-ai-footer">
        <form className="clickok-ai-composer" onSubmit={event => { event.preventDefault(); ask(input); }}>
          <input value={input} onChange={event => setInput(event.target.value)} placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta" disabled={typing}/>
          <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar mensaje"><Send size={17}/></button>
        </form>
        <div className="clickok-ai-disclaimer"><Sparkles size={12}/><span>Asistente de respuestas rápidas de CLICKOK</span></div>
      </footer>
    </section>}
    <button type="button" className={`clickok-ai-launcher ${open ? 'is-open' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? 'Cerrar CLICKOK AI' : 'Abrir CLICKOK AI'} aria-expanded={open}>
      {open ? <X size={23}/> : <><MessageCircle size={22}/><span>Chat</span></>}
    </button>
  </div>;
}
