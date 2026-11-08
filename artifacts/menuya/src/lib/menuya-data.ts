export type Role = 'admin' | 'owner';
export type BusinessStatus = 'pendiente' | 'activo' | 'rechazado' | 'suspendido';
export type OrderStatus = 'pendiente' | 'confirmado' | 'preparando' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
export type User = { id: string; nombre: string; email: string; password: string; role: Role; business_ids: string[] };
export type Business = { id: string; owner_id: string; nombre: string; slug: string; tipo: string; telefono: string; estado: BusinessStatus; created_at: string };
export type Category = { id: string; business_id: string; nombre: string; orden: number; activo: boolean };
export type ProductChoice = { id: string; nombre: string; precio_extra: number };
export type Product = { id: string; business_id: string; category_id: string; nombre: string; descripcion: string; precio: number; precio_anterior?: number; imagen?: string; activo: boolean; disponible: boolean; destacado: boolean; stock?: number; variantes?: ProductChoice[]; complementos?: ProductChoice[] };
export type Customer = { id: string; business_id: string; nombre: string; telefono: string; total_pedidos: number; total_compras: number; ultimo_pedido: string };
export type OrderItem = { product_id: string; nombre: string; precio: number; cantidad: number; variante?: string; complementos?: { nombre: string; precio_extra: number }[] };
export type Order = { id: string; business_id: string; numero: number; customer_id: string; items: OrderItem[]; total: number; estado: OrderStatus; entrega: 'domicilio' | 'recoger'; direccion?: string; observaciones?: string; metodo_pago: string; created_at: string };
export type Plan = { id: string; nombre: string; precio: number; periodicidad: string; max_productos: number; funciones: string[]; activo: boolean };
export type Subscription = { id: string; business_id: string; plan_id: string; estado: string; inicio: string; vencimiento: string };
export type StoreSettings = { business_id: string; portada: string; logo: string; color: string; fuente: string; contacto: string; redes: string; pagos: string; entrega: string; publicado: boolean; tagline: string; layout: 'grid' | 'list'; card_style: 'classic' | 'minimal' | 'soft'; button_style: 'rounded' | 'pill' | 'square' };
export type AuditLog = { id: string; actor: string; accion: string; entidad: string; fecha: string };
export type CatalogEvent = { id: string; business_id: string; product_id?: string; tipo: 'visita' | 'consulta'; created_at: string };
export type DemoData = { users: User[]; businesses: Business[]; categories: Category[]; products: Product[]; customers: Customer[]; orders: Order[]; plans: Plan[]; subscriptions: Subscription[]; settings: StoreSettings[]; audit: AuditLog[]; catalog_events: CatalogEvent[]; platform: { name: string; approval: 'automatica' | 'manual'; default_plan: string } };
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const categorySeed = (biz: string, names: string[]) => names.map((nombre, i) => ({ id: `${biz}-c${i + 1}`, business_id: biz, nombre, orden: i + 1, activo: true }));
const productSeed = (biz: string, catIds: string[], entries: [string, string, number, number?][]) => entries.map(([nombre, descripcion, precio, cat = 0], i) => ({ id: `${biz}-p${i + 1}`, business_id: biz, category_id: catIds[cat % catIds.length], nombre, descripcion, precio, activo: true, disponible: true, destacado: i === 0, stock: 18 + i * 3 }));
function seed(): DemoData {
  const users: User[] = [{ id: 'admin', nombre: 'Equipo CLICKOK', email: 'admin@menuya.com', password: 'MenuyaDemo2026!', role: 'admin', business_ids: [] }];
  const businessInfo = [
    ['brasa', 'La Brasa de Inés', 'restaurante', 'ines@labrasa.co', 'Inés Rojas', 'Brasa hecha con calma.'],
    ['hilo', 'Hilo Estudio', 'ropa', 'hola@hiloestudio.co', 'Sara Pardo', 'Piezas para todos tus días.'],
    ['barrio', 'Barbería del Barrio', 'barbería', 'turnos@barriobarber.co', 'Nicolás Gil', 'Buen corte, buena charla.'],
    ['nodo', 'Nodo Tecnología', 'tecnología', 'equipo@nodotec.co', 'Mateo Duque', 'Tecnología que sí te acompaña.'],
    ['miga', 'Miga de Casa', 'panadería', 'pedidos@migadecasa.co', 'Lucía Mora', 'Horneado cada mañana.'],
  ];
  const businesses: Business[] = businessInfo.map(([id, nombre, tipo, email, owner], i) => {
    const userId = `u-${id}`;
    users.push({ id: userId, nombre: owner, email, password: 'demo2026', role: 'owner', business_ids: [id] });
    return { id, owner_id: userId, nombre, slug: id, tipo, telefono: `+57 310 42${i} 80${i}1`, estado: i === 4 ? 'pendiente' : 'activo', created_at: day(28 - i * 4) };
  });
  const categories = [
    ...categorySeed('brasa', ['Favoritos', 'Platos fuertes', 'Para compartir']),
    ...categorySeed('hilo', ['Nuevos', 'Básicos', 'Accesorios']),
    ...categorySeed('barrio', ['Servicios', 'Cuidado personal']),
    ...categorySeed('nodo', ['Audio', 'Accesorios', 'Computación']),
    ...categorySeed('miga', ['Pan del día', 'Dulces', 'Bebidas']),
  ];
  const byBiz = (id: string) => categories.filter(c => c.business_id === id).map(c => c.id);
  const products = [
    ...productSeed('brasa', byBiz('brasa'), [['Pollo al carbón', 'Pollo marinado, papas criollas y ají de la casa.', 28900], ['Arepa de choclo', 'Quesito fundido y miel de panela.', 12500, 1], ['Picada de la casa', 'Para compartir entre dos, con chorizo artesanal.', 42000, 2], ['Limonada de coco', 'Limón natural, coco y mucho hielo.', 9500]]),
    ...productSeed('hilo', byBiz('hilo'), [['Camisa Río', 'Algodón liviano, corte amplio y botones de corozo.', 89000], ['Pantalón Alba', 'Lino colombiano de caída suave.', 139000, 1], ['Bolso Nudo', 'Tejido a mano en fique natural.', 76000, 2]]),
    ...productSeed('barrio', byBiz('barrio'), [['Corte clásico', 'Asesoría, lavado y acabado a tijera.', 32000], ['Barba y toalla caliente', 'Ritual de cuidado con aceites botánicos.', 24000, 1], ['Corte + barba', 'El combo completo, sin afán.', 49000]]),
    ...productSeed('nodo', byBiz('nodo'), [['Audífonos Nube', 'Inalámbricos, sonido cálido y 24 h de batería.', 189900], ['Cargador compacto 30W', 'Carga rápida para tus dispositivos.', 74900, 1], ['Teclado mecánico Uno', 'Formato compacto, switches silenciosos.', 279000, 2]]),
    ...productSeed('miga', byBiz('miga'), [['Pan campesino', 'Fermentación lenta, masa madre y corteza viva.', 12500], ['Roll de canela', 'Hojaldre, canela de Ceylán y glaseado.', 7800, 1], ['Croissant de almendra', 'Mantequilla de verdad y almendra tostada.', 9500], ['Chocolate de mesa', 'Cacao de origen, espeso y sin prisa.', 8500, 2]]),
  ];
  const plans: Plan[] = [
    { id: 'gratis', nombre: 'Gratis', precio: 0, periodicidad: 'mes', max_productos: 15, funciones: ['Catálogo público', 'Gestión básica de pedidos', 'Personalización básica'], activo: true },
    { id: 'starter', nombre: 'Starter', precio: 29900, periodicidad: 'mes', max_productos: 100, funciones: ['Catálogo público', 'Personalización ampliada', 'Gestión de pedidos', 'Estadísticas básicas'], activo: true },
    { id: 'pro', nombre: 'Pro', precio: 49900, periodicidad: 'mes', max_productos: 999999, funciones: ['Productos ilimitados', 'Personalización avanzada', 'Estadísticas avanzadas', 'Funciones adicionales'], activo: true },
  ];
  const customers: Customer[] = [];
  const orders: Order[] = [];
  for (const [bi, biz] of businesses.entries()) {
    for (let i = 0; i < 3; i++) {
      const customer = { id: `${biz.id}-cl${i + 1}`, business_id: biz.id, nombre: ['Camila Torres', 'Andrés Mejía', 'Valentina Ruiz'][i], telefono: `+57 315 408 2${i}1${bi}`, total_pedidos: 1 + (i === 0 ? 2 : 0), total_compras: 39000 + i * 15300 + bi * 1000, ultimo_pedido: day(i + 1) };
      customers.push(customer);
      const p = products.filter(x => x.business_id === biz.id);
      orders.push({ id: `${biz.id}-o${i + 1}`, business_id: biz.id, numero: i + 1, customer_id: customer.id, items: [{ product_id: p[i % p.length].id, nombre: p[i % p.length].nombre, precio: p[i % p.length].precio, cantidad: i + 1 }], total: p[i % p.length].precio * (i + 1), estado: (['pendiente', 'preparando', 'entregado'] as OrderStatus[])[i], entrega: i === 1 ? 'recoger' : 'domicilio', direccion: i === 1 ? '' : 'Cra. 7 # 42-18', metodo_pago: i === 0 ? 'Nequi' : 'Efectivo', created_at: day(i) });
    }
  }
  const settings: StoreSettings[] = businesses.map((b, i) => ({ business_id: b.id, portada: '', logo: '', color: ['#e7785d', '#5c7770', '#d1a256', '#566c84', '#d17e61'][i], fuente: 'Manrope', contacto: b.telefono, redes: `@${b.slug}.co`, pagos: 'Efectivo, Nequi, transferencia', entrega: 'Domicilio y recoger en tienda', publicado: b.estado === 'activo', tagline: businessInfo[i][5], layout: 'grid', card_style: 'classic', button_style: 'rounded' }));
  return { users, businesses, categories, products, customers, orders, plans, subscriptions: businesses.map((b, i) => ({ id: `s-${b.id}`, business_id: b.id, plan_id: plans[i === 0 ? 1 : 0].id, estado: b.estado === 'activo' ? 'activa' : 'pendiente', inicio: day(20), vencimiento: day(-10) })), settings, audit: [{ id: 'a1', actor: 'Equipo CLICKOK', accion: 'Demo inicializada', entidad: 'Plataforma', fecha: day(0) }], catalog_events: [], platform: { name: 'CLICKOK', approval: 'automatica', default_plan: 'gratis' } };
}
const STORE_KEY = 'menuya-demo-v1';
export const repository = {
  load(): DemoData {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as DemoData;
        const canonical = seed();
        const legacyPlanIds: Record<string, string> = { semilla: 'gratis', mercado: 'starter', plaza: 'pro' };
        const canonicalPlans = new Map(canonical.plans.map(plan => [plan.id, plan]));
        const migrated: DemoData = {
          ...stored,
          catalog_events: stored.catalog_events || [],
          plans: stored.plans.map(plan => {
            const id = legacyPlanIds[plan.id];
            const replacement = id ? canonicalPlans.get(id) : undefined;
            return replacement ? { ...replacement, activo: plan.activo } : plan;
          }),
          subscriptions: stored.subscriptions.map(subscription => ({
            ...subscription,
            plan_id: legacyPlanIds[subscription.plan_id] || subscription.plan_id,
          })),
          orders: stored.orders.map(order => ({
            ...order,
            estado: (order.estado as string) === 'nuevo' ? 'pendiente' : order.estado,
          })),
          platform: {
            ...stored.platform,
            default_plan: legacyPlanIds[stored.platform.default_plan] || stored.platform.default_plan,
          },
        };
        this.save(migrated);
        return migrated;
      }
    } catch { /* reset below */ }
    const data = seed(); this.save(data); return data;
  },
  save(data: DemoData) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); },
  reset() { const data = seed(); this.save(data); return data; },
  id: uid,
  date: day,
};
