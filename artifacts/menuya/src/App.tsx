import './menuya.css';
import './order-tracking.css';
import PlatformAdminCenter from '@/components/PlatformAdminCenter';
import * as React from 'react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, CreditCard, ExternalLink, Eye, EyeOff, ImagePlus, LayoutDashboard, Loader2, LogOut, Menu, MoreHorizontal, Package, Pencil, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Store, Tag, Trash2, TrendingUp, Upload, Users, X, Zap } from 'lucide-react';
import { type AuditLog, type Business, type CatalogEvent, type Category, type Customer, type DemoData, type Order, type OrderStatus, type Plan, type Product, type ProductChoice, type StoreSettings, repository } from '@/lib/menuya-data';
import { type MenuyaAuthContext, ensureBusinessForCurrentUser, getAuthContext, isSupabaseConfigured, sendPasswordRecovery, preparePasswordRecovery, signInWithEmail, signOut, signUpWithEmail, updatePassword } from '@/lib/menuya-auth';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const shortDate = (date: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(date));
const statusLabel: Record<string, string> = { pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'En preparación', listo: 'Listo', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado', activo: 'Activo', rechazado: 'Rechazado', suspendido: 'Suspendido', activa: 'Activa', vencida: 'Vencida' };
const productLimitLabel = (limit: number) => limit >= 999999 ? 'ilimitados' : String(limit);
const adminLinks = [['/admin', 'Resumen', LayoutDashboard], ['/admin/businesses', 'Comercios', Store], ['/admin/requests', 'Solicitudes', ClipboardList], ['/admin/users', 'Usuarios', Users], ['/admin/plans', 'Planes', Tag], ['/admin/subscriptions', 'Suscripciones', CreditCard], ['/admin/settings', 'Ajustes', Settings], ['/admin/audit', 'Auditoría', Activity]] as const;
const shopLinks = [['/app', 'Inicio', LayoutDashboard], ['/app/catalog', 'Catálogo', ShoppingBag], ['/app/products', 'Productos', Package], ['/app/categories', 'Categorías', Tag], ['/app/orders', 'Pedidos', ClipboardList], ['/app/customers', 'Clientes', Users], ['/app/editor', 'CLICKOK Studio', Pencil], ['/app/analytics', 'Analítica', BarChart3], ['/app/settings', 'Ajustes', Settings], ['/app/subscription', 'Mi plan', CreditCard]] as const;
type Session = { userId: string; role: 'admin' | 'owner' } | null;
type FormField = { name: string; label: string; type?: string; value?: string | number | boolean; options?: string[]; required?: boolean };
type CartLine = { key: string; productId: string; cantidad: number; variante?: ProductChoice; complementos: ProductChoice[] };
const choiceText = (choices: ProductChoice[] = []) => choices.map(choice => `${choice.nombre}|${choice.precio_extra}`).join('\n');
const parseChoices = (value: string | boolean | undefined) => String(value || '').split('\n').map(row => row.trim()).filter(Boolean).map(row => {
  const [nombre, price = '0'] = row.split('|');
  return { id: repository.id(), nombre: nombre.trim(), precio_extra: Number(price.replace(/[^\d.-]/g, '')) || 0 };
}).filter(choice => choice.nombre);

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-menuya-home" aria-label="CLICKOK, inicio"><img src={inverse ? '/brand-clickok-dark.svg' : '/brand-clickok-light.svg'} alt="CLICKOK" /></Link>;
}
function Button({ children, onClick, kind = 'solid', className = '', type = 'button', disabled = false, testId }: { children: ReactNode; onClick?: () => void; kind?: string; className?: string; type?: 'button' | 'submit'; disabled?: boolean; testId?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`btn btn-${kind} ${className}`}>{children}</button>;
}
async function optimizeStoreImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen supera 15 MB. Elige una foto más liviana.');
  let bitmap: ImageBitmap | null = null;
  let source: CanvasImageSource;
  let width = 0;
  let height = 0;
  try {
    bitmap = await createImageBitmap(file);
    source = bitmap; width = bitmap.width; height = bitmap.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('Este formato no se puede abrir. Prueba con JPG o PNG.')); element.src = url;
      });
      source = image; width = image.naturalWidth; height = image.naturalHeight;
    } finally { URL.revokeObjectURL(url); }
  }
  const scale = Math.min(1, 1400 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap?.close(); throw new Error('No fue posible procesar la imagen.'); }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No fue posible convertir la imagen.')), 'image/webp', 0.82));
  return new File([blob], `clickok-${Date.now()}.webp`, { type: 'image/webp' });
}
function ImageUploadField({ field, value, businessId, onChange }: { field: FormField; value: string; businessId?: string; onChange: (name: string, value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    if (!businessId) { setError('Inicia sesión en tu comercio para subir imágenes.'); return; }
    setBusy(true); setError(''); setStats('');
    try {
      const optimized = await optimizeStoreImage(file);
      const folder = field.name === 'imagen' ? 'products' : 'storefront';
      const path = `${businessId}/${folder}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from('clickok-images').upload(path, optimized, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('clickok-images').getPublicUrl(path);
      onChange(field.name, data.publicUrl);
      const saved = Math.max(0, Math.round((1 - optimized.size / file.size) * 100));
      setStats(`Lista · WebP · ${Math.round(optimized.size / 1024)} KB · ${saved}% menos peso`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible subir la imagen.');
    } finally { setBusy(false); }
  };
  return <div className="field image-upload-field"><span>{field.label}</span>
    <div className="image-upload-control">
      {value ? <img className="image-upload-preview" src={value} alt="Vista previa de la imagen" /> : <div className="image-upload-placeholder"><ImagePlus size={24}/><span>Tu foto aparecerá aquí</span></div>}
      <div className="image-upload-actions">
        <label className="btn btn-outline image-upload-button"><Upload size={15}/>{busy ? 'Procesando…' : value ? 'Cambiar imagen' : 'Subir imagen'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
        {value && <button type="button" className="text-link" onClick={() => { onChange(field.name, ''); setStats(''); }}>Quitar</button>}
        <small>JPG, PNG o WebP · Máximo 15 MB. CLICKOK la optimiza automáticamente.</small>
        {busy && <small className="image-upload-status"><Loader2 size={13} className="image-spin"/> Optimizando y subiendo tu imagen…</small>}
        {stats && <small className="image-upload-success"><CheckCircle2 size={13}/> {stats}</small>}
        {error && <small className="image-upload-error">{error}</small>}
      </div>
    </div>
  </div>;
}
function Field({ field, onChange, businessId }: { field: FormField; onChange: (name: string, value: string | boolean) => void; businessId?: string }) {
  if (field.type === 'image') return <ImageUploadField field={field} value={String(field.value ?? '')} businessId={businessId} onChange={onChange as (name: string, value: string) => void}/>;
  return <label className="field"><span>{field.label}{field.required ? ' *' : ''}</span>
      {field.options ? <select name={field.name} required={field.required} value={String(field.value ?? '')} onChange={e => onChange(field.name, e.target.value)} data-testid={`select-${field.name}`}>{field.options.map(o => <option key={o} value={o}>{statusLabel[o] || o}</option>)}</select>
      : field.type === 'textarea' ? <textarea name={field.name} required={field.required} defaultValue={String(field.value ?? '')} onChange={e => onChange(field.name, e.target.value)} data-testid={`input-${field.name}`} />
      : field.type === 'checkbox' ? <input name={field.name} type="checkbox" defaultChecked={Boolean(field.value)} onChange={e => onChange(field.name, e.target.checked)} data-testid={`input-${field.name}`} />
      : <input name={field.name} required={field.required} type={field.type || 'text'} defaultValue={String(field.value ?? '')} onChange={e => onChange(field.name, e.target.value)} data-testid={`input-${field.name}`} />}
  </label>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><div><span className="eyebrow">CLICKOK</span><h2>{title}</h2></div><button className="icon-btn" onClick={close} aria-label="Cerrar" data-testid="button-close-modal"><X size={18} /></button></header>{children}</section></div>;
}
function AuthPage({ mode, data, onLogin, onRegister, onForgot, onReset }: {
  mode: 'login' | 'register' | 'forgot' | 'reset';
  data: DemoData;
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (values: Record<string, string>) => Promise<string | null>;
  onForgot: (email: string) => Promise<string | null>;
  onReset: (password: string) => Promise<string | null>;
}) {
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(mode !== 'reset');
  useEffect(() => {
    if (mode !== 'reset') return;
    let active = true;
    preparePasswordRecovery()
      .then((ready) => {
        if (!active) return;
        setRecoveryReady(ready);
        if (!ready) setError('El enlace no inició una sesión de recuperación. Solicita un correo nuevo y abre el enlace directamente desde el mismo navegador.');
      })
      .catch((err) => {
        if (!active) return;
        setRecoveryReady(false);
        setError(err instanceof Error ? err.message : 'No fue posible validar el enlace de recuperación.');
      });
    return () => { active = false; };
  }, [mode]);
  const sampleBiz = data.businesses.find(b => b.id === 'brasa');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setDone(false);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if ((mode === 'register' || mode === 'reset') && values.password !== values.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const message = mode === 'login'
        ? await onLogin(values.email, values.password)
        : mode === 'register'
          ? await onRegister(values)
          : mode === 'forgot' ? await onForgot(values.email) : await onReset(values.password);
      if (message) setError(message);
      else if (mode === 'login') setLocation('/app');
      else if (mode === 'reset') { setDone(true); window.setTimeout(() => setLocation('/login'), 900); }
      else setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la solicitud. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-layout"><aside className="auth-story"><Brand inverse /><div className="story-copy"><span className="eyebrow light">UNA TIENDA PROPIA, EN SERIO</span><h1>Tu negocio<br />merece su<br /><em>propia vitrina.</em></h1><p>Un catálogo que se siente tuyo. Pedidos organizados. Todo en un solo lugar.</p><div className="mini-store-preview"><div className="mini-preview-top"><span className="mini-avatar">{sampleBiz?.nombre.charAt(0) || 'M'}</span><span><b>{sampleBiz?.nombre || 'Tu negocio'}</b><small>Catálogo digital · Tu marca</small></span><ArrowRight size={17} /></div><div className="preview-products"><span /><span /><span /></div><div className="preview-caption">Así podría verse tu tienda</div></div></div><div className="auth-foot">Hecho para el comercio de aquí. <span>CLICKOK</span></div></aside>
    <main className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="eyebrow">{mode === 'register' ? 'EMPIEZA EN MINUTOS' : mode === 'forgot' || mode === 'reset' ? 'RECUPERA EL ACCESO' : 'QUÉ BUENO VERTE'}</span><h2>{mode === 'register' ? 'Abre tu tienda digital' : mode === 'forgot' ? '¿Olvidaste tu clave?' : mode === 'reset' ? 'Crea una nueva clave' : 'Entra a tu espacio'}</h2><p className="subtle">{mode === 'register' ? 'Crea tu cuenta y registra los datos de tu comercio.' : mode === 'forgot' ? 'Te enviaremos las instrucciones para recuperar tu cuenta.' : mode === 'reset' ? 'Elige una contraseña nueva para tu cuenta.' : 'Ingresa con el correo y la contraseña de tu cuenta.'}</p>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {done && <div className="notice notice-success" role="status">{mode === 'forgot' ? 'Si el correo está registrado, recibirás instrucciones para recuperar el acceso.' : mode === 'reset' ? 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' : 'Tu cuenta fue creada. Revisa tu correo para confirmar la dirección; después inicia sesión y CLICKOK terminará de registrar tu comercio.'}</div>}
      <form onSubmit={submit} className="form-stack">
        {mode === 'register' && <><Field field={{ name: 'nombre', label: 'Tu nombre', required: true }} onChange={() => {}} /><Field field={{ name: 'negocio', label: 'Nombre del negocio', required: true }} onChange={() => {}} /><div className="field"><span>Sector *</span><select name="sector" required data-testid="select-sector">{['Restaurante', 'Ropa', 'Barbería', 'Tecnología', 'Panadería', 'Servicios', 'Otro'].map(x => <option key={x}>{x}</option>)}</select></div><Field field={{ name: 'telefono', label: 'Teléfono', type: 'tel', required: true }} onChange={() => {}} /></>}
        {mode !== 'reset' && <Field field={{ name: 'email', label: 'Correo electrónico', type: 'email', required: true }} onChange={() => {}} />}
        {mode !== 'forgot' && <><label className="field"><span>{mode === 'reset' ? 'Nueva contraseña *' : 'Contraseña *'}</span><div className="password-wrap"><input name="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} data-testid="input-password" /><button type="button" className="password-eye" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar u ocultar contraseña">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {(mode === 'register' || mode === 'reset') && <Field field={{ name: 'confirmPassword', label: 'Confirma tu contraseña', type: 'password', required: true }} onChange={() => {}} />}
        </>}
        {mode === 'register' && <p className="fine-print">Tu comercio se crea inicialmente privado y pendiente de revisión. No se publicará automáticamente.</p>}
        <Button type="submit" className="full-btn" disabled={busy || (mode === "reset" && !recoveryReady)} testId="button-auth-submit">{busy ? 'Procesando...' : mode === 'register' ? 'Crear mi cuenta y tienda' : mode === 'forgot' ? 'Enviar instrucciones' : mode === 'reset' ? 'Actualizar contraseña' : 'Entrar'} <ArrowRight size={16} /></Button>
      </form>
      {mode === 'login' && <Link href="/forgot-password" className="text-link">¿Olvidaste tu contraseña?</Link>}
      {(mode === 'login' || mode === 'register') && <p className="auth-switch">{mode === 'register' ? '¿Ya tienes cuenta?' : '¿Tienes un comercio?'} <Link href={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? 'Inicia sesión' : 'Crea tu tienda'}</Link></p>}
      {(mode === 'forgot' || mode === 'reset') && <Link href="/login" className="back-link"><ArrowLeft size={15} /> Volver a iniciar sesión</Link>}
      <p className="security-note"><ShieldCheck size={14} /> Acceso protegido por Supabase Auth.</p>
    </div></main></div>;
}
function Landing({ data }: { data: DemoData }) {
  return <div className="landing clickok-world stripe-inspired">
    <header className="landing-nav"><Brand/><nav><a href="#plataforma">Plataforma</a><a href="#soluciones">Soluciones</a><a href="#como-funciona">Cómo funciona</a><a href="#ecosistema">Sectores</a></nav><div className="landing-actions"><Link href="/login" className="nav-login">Iniciar sesión</Link><Link href="/register" className="btn btn-solid">Comenzar <ArrowRight size={15}/></Link></div></header>
    <section className="hero ck-hero stripe-hero" id="plataforma"><div className="stripe-gradient-art"/><div className="hero-copy ck-copy"><span className="eyebrow"><i className="eyebrow-dot"/> COMERCIO DIGITAL, SIN COMPLICACIONES</span><h1>Todo tu negocio.<br/><em>En un solo lugar.</em></h1><p>Crea tu vitrina digital, conecta con tus clientes y gestiona tus ventas desde una plataforma diseñada para hacer crecer tu negocio.</p><div className="hero-ctas"><Link href="/register" className="btn btn-solid btn-large">Crea tu espacio gratis <ArrowRight size={17}/></Link><a href="#soluciones" className="hero-secondary">Conoce la plataforma <ArrowRight size={15}/></a></div><div className="ck-proof"><i/> TU MARCA. TUS PRODUCTOS. TU NEGOCIO.</div></div>
    <div className="hero-art ck-stage stripe-stage"><div className="stripe-glow-orbit"/><div className="stripe-ui-window"><div className="stripe-window-bar"><span/><span/><span/><small>app.clickok.co / mi-tienda</small></div><div className="stripe-store-ui"><aside><b className="stripe-mini-logo">C<span>.</span></b><i/><i/><i/><i/></aside><main><div className="stripe-ui-top"><span>Resumen de tu tienda</span><b>Vista previa ↗</b></div><div className="stripe-ui-welcome"><small>BUENOS DÍAS, CAMILA</small><strong>Tu negocio está en marcha.</strong><span>Este es el resumen de tu actividad.</span></div><div className="stripe-ui-metrics"><div><small>Ventas del mes</small><b>$ 4.850.000</b><em>↗ Actividad reciente</em></div><div><small>Pedidos recibidos</small><b>128</b><em>↗ Nuevos pedidos</em></div></div><div className="stripe-ui-chart"><div><b>Actividad de ventas</b><span>Últimos 7 días</span></div><svg viewBox="0 0 420 105" role="img" aria-label="Gráfico ilustrativo de ventas"><defs><linearGradient id="ckChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#635bff" stopOpacity=".25"/><stop offset="1" stopColor="#635bff" stopOpacity="0"/></linearGradient></defs><path d="M0 82 C35 76 42 53 78 61 S125 84 158 51 S211 58 244 35 S300 52 330 23 S383 37 420 8 L420 105 L0 105Z" fill="url(#ckChart)"/><path d="M0 82 C35 76 42 53 78 61 S125 84 158 51 S211 58 244 35 S300 52 330 23 S383 37 420 8" fill="none" stroke="#635bff" strokeWidth="3" strokeLinecap="round"/></svg></div></main></div></div><div className="stripe-floating-order"><span><CheckCircle2 size={16}/></span><div><small>NUEVO PEDIDO</small><b>Pedido confirmado</b></div><strong>$ 89.000</strong></div><div className="stripe-floating-pill">● TIENDA PUBLICADA</div></div></section>
    <section className="stripe-trust"><span>UNA PLATAFORMA PARA NEGOCIOS QUE QUIEREN CRECER</span><div><b>RESTAURANTES</b><b>MODA</b><b>TIENDAS</b><b>SERVICIOS</b><b>EMPRENDIMIENTOS</b></div></section>
    <section className="stripe-solutions" id="soluciones"><div className="stripe-section-intro"><span className="eyebrow">UNA PLATAFORMA. MUCHAS POSIBILIDADES.</span><h2>Las herramientas que necesitas.<br/><em>Sin complicar tu operación.</em></h2><p>Todo conectado para que puedas dedicar menos tiempo a organizar y más tiempo a hacer crecer tu negocio.</p></div><div className="stripe-bento">
      <article className="stripe-bento-card stripe-bento-main"><div className="stripe-bento-copy"><span>01 / TU VITRINA DIGITAL</span><h3>Una tienda que se siente tuya.</h3><p>Personaliza tu espacio con tu marca, tus productos y la experiencia que quieres ofrecer.</p></div><div className="stripe-mini-browser"><div className="stripe-browser-top"><i/><i/><i/><span>tu-negocio.clickok.co</span></div><div className="stripe-browser-content"><div><small>HECHO PARA TI</small><b>Lo que buscas,<br/>está aquí.</b><span>Descubre nuestra colección</span><i>Explorar productos ↗</i></div><div className="stripe-browser-product"><span>✳</span></div></div></div></article>
      <article className="stripe-bento-card stripe-bento-orders"><span>02 / PEDIDOS</span><div className="stripe-order-mock"><div><span className="stripe-order-icon"><ShoppingBag size={16}/></span><b>Pedido #1048</b><small>Hace 2 minutos</small><strong>Confirmado <CheckCircle2 size={13}/></strong></div><div><span className="stripe-order-icon"><ShoppingBag size={16}/></span><b>Pedido #1047</b><small>Hace 18 minutos</small><strong>En preparación</strong></div><div><span className="stripe-order-icon"><ShoppingBag size={16}/></span><b>Pedido #1046</b><small>Hace 36 minutos</small><strong>Entregado</strong></div></div><h3>Todo pedido, bajo control.</h3><p>Organiza y actualiza tus pedidos desde un solo panel.</p></article>
      <article className="stripe-bento-card stripe-bento-catalog"><span>03 / CATÁLOGO</span><div className="stripe-catalog-mock"><div/><div/><div/></div><h3>Tus productos, siempre listos.</h3><p>Administra productos, categorías, precios y opciones fácilmente.</p></article>
      <article className="stripe-bento-card stripe-bento-analytics"><span>04 / CONTROL</span><div className="stripe-analytics-mock"><div><small>VENTAS REGISTRADAS</small><b>$ 2.480.000</b><em>Resumen de ejemplo</em></div><div className="stripe-bars"><i/><i/><i/><i/><i/><i/><i/></div></div><h3>Entiende cómo se mueve tu negocio.</h3><p>Consulta la actividad y toma decisiones con más claridad.</p></article>
      <article className="stripe-bento-card stripe-bento-share"><span>05 / COMPARTE</span><div className="stripe-share-orb"><span>↗</span></div><h3>Tu tienda, en todas partes.</h3><p>Comparte el enlace de tu vitrina por WhatsApp y redes sociales.</p></article>
    </div></section>
    <section className="how-section ck-how stripe-how" id="como-funciona"><div className="section-label">EMPIEZA EN POCOS PASOS <span>02 — SIMPLE POR DISEÑO</span></div><div className="how-grid"><h2>De la idea<br/><em>a tu tienda online.</em></h2><div className="steps"><article><span>01</span><div><h3>Abre tu espacio</h3><p>Registra tu negocio y configura la información principal de tu marca.</p></div></article><article><span>02</span><div><h3>Organiza tu oferta</h3><p>Agrega productos o servicios, categorías, precios y detalles.</p></div></article><article><span>03</span><div><h3>Publica y conecta</h3><p>Comparte tu vitrina y gestiona los pedidos desde CLICKOK.</p></div></article></div></div></section>
    <section className="sector-section ck-ecosystem" id="ecosistema"><div className="section-label">CRECE A TU MANERA <span>03 — PARA DIFERENTES NEGOCIOS</span></div><div className="sector-head"><h2>Tu negocio es único.<br/>Tu plataforma también.</h2><p>CLICKOK se adapta a distintas formas de vender, desde una tienda de ropa hasta un restaurante o un negocio de servicios.</p></div><div className="sector-list">{[['01','Gastronomía','Cartas, productos y pedidos.'],['02','Moda y accesorios','Colecciones con identidad propia.'],['03','Servicios','Catálogos y solicitudes.'],['04','Comercio y retail','Un espacio para mostrar lo que vendes.']].map(([n,t,d])=><div key={n} className="sector-row"><span>{n}</span><b>{t}</b><p>{d}</p><ArrowRight size={18}/></div>)}</div></section>
    <section className="closing-cta ck-closing stripe-closing"><span className="eyebrow light">TU NEGOCIO PUEDE LLEGAR MÁS LEJOS</span><h2>Haz espacio para<br/><em>todo lo que viene.</em></h2><p>Empieza a construir la presencia digital de tu negocio.</p><Link href="/register" className="btn btn-light btn-large">Crear mi espacio gratis <ArrowRight size={17}/></Link><div className="ck-closing-orb"/></section>
    <footer className="landing-footer ck-footer"><Brand/><span>Tu negocio, conectado.</span><span>Una nueva forma de vender y crecer.</span><Link href="/login">Iniciar sesión <ArrowRight size={14}/></Link><a className="atomlabs-credit" href="https://atomlabs.lat/#top" target="_blank" rel="noreferrer"><span>DESARROLLADO POR</span><b>Atom Labs®</b></a></footer>
  </div>;
}

function AppShell({ data, session, update, logout, children, business, activePath }: { data: DemoData; session: Session; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void; logout: () => void; children: ReactNode; business?: Business; activePath: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = session?.role === 'admin';
  const links = isAdmin ? adminLinks : shopLinks;
  const [location, setLocation] = useLocation();
  const user = data.users.find(u => u.id === session?.userId);
  const switchBusiness = (id: string) => { localStorage.setItem('menuya-business', id); setLocation('/app'); window.dispatchEvent(new Event('menuya-business-change')); };
  return <div className={`dashboard-shell ${!isAdmin ? 'merchant-dashboard' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="side-brand-row"><Brand inverse /><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>{!isAdmin && <div className="business-select"><span className="business-initial">{business?.nombre.charAt(0)}</span><span><small>TIENDA ACTIVA</small><b>{business?.nombre}</b></span><ChevronDown size={14} /></div>}
      <div className="side-caption">{isAdmin ? 'PLATAFORMA' : 'GESTIONA TU TIENDA'}</div><nav className="side-nav">{links.map(([href, label, Icon]) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`side-link ${activePath === href ? 'side-link-active' : ''} ${href === '/app/editor' ? 'studio-nav-link' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span>{label === 'Pedidos' && data.orders.filter(o => o.business_id === business?.id && o.estado === 'pendiente').length > 0 && <i className="nav-count">{data.orders.filter(o => o.business_id === business?.id && o.estado === 'pendiente').length}</i>}</Link>)}</nav>
      <div className="sidebar-bottom">{!isAdmin && business && <Link href={`/${business.slug}`} className="store-link"><ExternalLink size={15} /> Ver tienda pública <ArrowRight size={13} /></Link>}<div className="user-chip"><span className="user-avatar">{user?.nombre.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span className="user-meta"><b>{user?.nombre}</b><small>{isAdmin ? 'Administrador demo' : 'Propietario'}</small></span><button className="icon-btn logout-btn" aria-label="Cerrar sesión" onClick={logout} data-testid="button-logout"><LogOut size={16} /></button></div></div></aside>
    <main className="workspace"><header className="workspace-top"><button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button><div className="crumb">{isAdmin ? 'CLICKOK' : business?.nombre}<ChevronRight size={14} /><span>{links.find(x => x[0] === activePath)?.[1] || 'Inicio'}</span></div><div className="top-actions">{!isAdmin && data.businesses.filter(b => user?.business_ids.includes(b.id)).length > 1 && <select aria-label="Cambiar comercio" value={business?.id} onChange={e => switchBusiness(e.target.value)}>{data.businesses.filter(b => user?.business_ids.includes(b.id)).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>}<Link href={isAdmin ? '/admin/settings' : '/app/orders'} className="top-icon" aria-label="Notificaciones"><Bell size={17} /><i /></Link><span className="top-avatar">{user?.nombre.slice(0, 1)}</span></div></header><div className="page-content">{children}</div></main>
    {mobileOpen && <button aria-label="Cerrar menú" className="mobile-shade" onClick={() => setMobileOpen(false)} />}
  </div>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="title-action">{action}</div>}</div>;
}
function Metric({ label, value, note, icon: Icon, trend }: { label: string; value: string; note: string; icon: typeof ShoppingBag; trend?: string }) {
  return <article className="metric"><div className="metric-top"><span>{label}</span><Icon size={18} /></div><b>{value}</b><div className="metric-foot">{trend && <span className="trend"><TrendingUp size={13} /> {trend}</span>}<span>{note}</span></div></article>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><ShoppingBag size={21} /></div><h3>{title}</h3><p>{text}</p>{action}</div>; }
function Status({ value }: { value: string }) { return <span className={`status status-${value}`}>{statusLabel[value] || value}</span>; }

function DataTable({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: string }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>{empty && <div className="table-empty">{empty}</div>}</div>;
}
function FormModal({ title, fields, close, submit, submitText = 'Guardar', businessId }: { title: string; fields: FormField[]; close: () => void; submit: (values: Record<string, string | boolean>) => void; submitText?: string; businessId?: string }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => fields.reduce((result, field) => {
    result[field.name] = field.type === 'checkbox' ? Boolean(field.value) : String(field.value ?? field.options?.[0] ?? '');
    return result;
  }, {} as Record<string, string | boolean>));
  return <Modal title={title} close={close}><form className="modal-form" onSubmit={e => { e.preventDefault(); submit(values); }}><div className="form-grid">{fields.map(f => <Field key={f.name} field={{...f, value: values[f.name]}} businessId={businessId} onChange={(n, v) => setValues(prev => ({ ...prev, [n]: v }))} />)}</div><div className="modal-actions"><Button kind="ghost" onClick={close}>Cancelar</Button><Button type="submit" testId="button-save-form"><Check size={16} /> {submitText}</Button></div></form></Modal>;
}

function MerchantPage({ path, data, business, update }: { path: string; data: DemoData; business: Business; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [orderFrom, setOrderFrom] = useState('');
  const [orderTo, setOrderTo] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [modal, setModal] = useState<{ title: string; fields: FormField[]; save: (v: Record<string, string | boolean>) => void } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [draftStoreColor, setDraftStoreColor] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const cats = data.categories.filter(c => c.business_id === business.id).sort((a, b) => a.orden - b.orden);
  const products = data.products.filter(p => p.business_id === business.id);
  const orders = data.orders.filter(o => o.business_id === business.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const customers = data.customers.filter(c => c.business_id === business.id);
  const settings = data.settings.find(s => s.business_id === business.id)!;
  useEffect(() => { setDraftStoreColor(settings.color); }, [settings.color, business.id]);
  const previewStoreColor = draftStoreColor || settings.color;
  const startSubscriptionCheckout = async (planId: string) => {
    setCheckoutBusy(planId); setCheckoutError('');
    try {
      const { data: result, error } = await supabase.functions.invoke('create-subscription-checkout', { body: { business_id: business.id, plan_id: planId } });
      if (error) throw error;
      if (!result?.checkout_url || typeof result.checkout_url !== 'string' || !result.checkout_url.startsWith('https://checkout.wompi.co/p/')) throw new Error(result?.error || 'Wompi no devolvió un enlace de pago válido.');
      window.location.assign(result.checkout_url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'No fue posible iniciar el pago.');
      setCheckoutBusy(null);
    }
  };
  const commitStoreColor = () => {
    if (previewStoreColor === settings.color) return;
    update(d => ({ ...d, settings: d.settings.map(item => item.business_id === business.id ? { ...item, color: previewStoreColor } : item) }), 'Color actualizado', business.nombre);
  };
  const subscription = data.subscriptions.find(s => s.business_id === business.id);
  const plan = data.plans.find(p => p.id === subscription?.plan_id);
  const productLimit = plan?.max_productos ?? 15;
  const openModal = (title: string, fields: FormField[], save: (v: Record<string, string | boolean>) => void) => setModal({ title, fields, save });
  const createProduct = (initial?: Product) => {
    if (!initial && products.length >= productLimit) {
      update(d => d, `Límite alcanzado: tu plan permite ${productLimitLabel(productLimit)} productos.`, 'Límite del plan');
      return;
    }
    openModal(initial ? 'Editar producto' : 'Nuevo producto', [
    { name: 'nombre', label: 'Nombre', value: initial?.nombre, required: true }, { name: 'precio', label: 'Precio (COP)', type: 'number', value: initial?.precio, required: true },
    { name: 'descripcion', label: 'Descripción', type: 'textarea', value: initial?.descripcion }, { name: 'imagen', label: 'Fotografía del producto', type: 'image', value: initial?.imagen || '' }, { name: 'category_id', label: 'Categoría', value: initial?.category_id || cats[0]?.id, options: cats.map(c => c.id) },
    { name: 'variantes', label: 'Variantes (una por línea: Nombre|recargo)', type: 'textarea', value: choiceText(initial?.variantes) }, { name: 'complementos', label: 'Complementos (una por línea: Nombre|recargo)', type: 'textarea', value: choiceText(initial?.complementos) },
    { name: 'precio_anterior', label: 'Precio anterior (opcional)', type: 'number', value: initial?.precio_anterior || '' }, { name: 'stock', label: 'Stock', type: 'number', value: initial?.stock || 0 },
    { name: 'disponible', label: 'Disponible', type: 'checkbox', value: initial?.disponible ?? true }, { name: 'destacado', label: 'Destacado', type: 'checkbox', value: initial?.destacado ?? false },
  ], v => {
    const item: Product = { id: initial?.id || repository.id(), business_id: business.id, category_id: String(v.category_id || cats[0]?.id || ''), nombre: String(v.nombre), descripcion: String(v.descripcion || ''), precio: Number(v.precio), precio_anterior: Number(v.precio_anterior) || undefined, imagen: String(v.imagen || '') || undefined, activo: initial?.activo ?? true, disponible: Boolean(v.disponible), destacado: Boolean(v.destacado), stock: Number(v.stock), variantes: parseChoices(v.variantes), complementos: parseChoices(v.complementos) };
    update(d => ({ ...d, products: initial ? d.products.map(p => p.id === initial.id ? item : p) : [...d.products, item] }), initial ? 'Producto actualizado' : 'Producto creado', item.nombre); setModal(null);
    });
  };
  const addCategory = (initial?: Category) => openModal(initial ? 'Editar categoría' : 'Nueva categoría', [{ name: 'nombre', label: 'Nombre', value: initial?.nombre, required: true }, { name: 'orden', label: 'Orden', type: 'number', value: initial?.orden || cats.length + 1 }, { name: 'activo', label: 'Visible en tienda', type: 'checkbox', value: initial?.activo ?? true }], v => {
    const item: Category = { id: initial?.id || repository.id(), business_id: business.id, nombre: String(v.nombre), orden: Number(v.orden), activo: Boolean(v.activo) };
    update(d => ({ ...d, categories: initial ? d.categories.map(c => c.id === item.id ? item : c) : [...d.categories, item] }), 'Categoría guardada', item.nombre); setModal(null);
  });
  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === 'todos' || p.category_id === categoryFilter) && (filter === 'todos' || (filter === 'activos' ? p.activo && p.disponible : !p.disponible || !p.activo)));
  const filteredOrders = orders.filter(o => {
    const orderDate = o.created_at.slice(0, 10);
    return `${o.numero} ${data.customers.find(c => c.id === o.customer_id)?.nombre || ''}`.toLowerCase().includes(search.toLowerCase())
      && (filter === 'todos' || o.estado === filter)
      && (!orderFrom || orderDate >= orderFrom) && (!orderTo || orderDate <= orderTo);
  });
  const HeaderAction = ({ text, onClick }: { text: string; onClick: () => void }) => <Button onClick={onClick} testId="button-create"><Plus size={16} /> {text}</Button>;

  if (path === '/app' || path === '/app/') {
    const now = Date.now();
    const currentStart = now - 30 * 86400000;
    const previousStart = now - 60 * 86400000;
    const validOrders = orders.filter(o => o.estado !== 'cancelado');
    const currentOrders = validOrders.filter(o => new Date(o.created_at).getTime() >= currentStart);
    const previousOrders = validOrders.filter(o => {
      const time = new Date(o.created_at).getTime();
      return time >= previousStart && time < currentStart;
    });
    const currentSales = currentOrders.reduce((sum, order) => sum + order.total, 0);
    const previousSales = previousOrders.reduce((sum, order) => sum + order.total, 0);
    const currentCustomers = new Set(currentOrders.map(order => order.customer_id).filter(Boolean)).size;
    const previousCustomers = new Set(previousOrders.map(order => order.customer_id).filter(Boolean)).size;
    const variation = (current: number, previous: number) => previous > 0
      ? `${current >= previous ? '+' : ''}${Math.round(((current - previous) / previous) * 100)}% vs. período anterior`
      : undefined;
    return <><PageTitle eyebrow="TU NEGOCIO, EN UN VISTAZO" title={`Hola, ${data.users.find(u => u.id === business.owner_id)?.nombre.split(' ')[0] || 'bienvenido'}.`} description="Esto es lo que está pasando en tu tienda." action={<Link href={`/${business.slug}`} className="btn btn-outline" target="_blank"><Eye size={16} /> Ver mi tienda</Link>} />
      {business.estado !== 'activo' && <div className="notice notice-warn"><Clock3 size={18} /><span><b>Tu tienda está {statusLabel[business.estado]?.toLowerCase()}.</b> {business.estado === 'pendiente' ? 'La tienda no será visible al público hasta su aprobación.' : 'Contacta al equipo de CLICKOK si necesitas ayuda.'}</span></div>}
      <div className="metrics-grid">
        <Metric label="Pedidos recibidos" value={String(currentOrders.length)} note="Últimos 30 días" icon={ShoppingCart} trend={variation(currentOrders.length, previousOrders.length)} />
        <Metric label="Ventas registradas" value={money(currentSales)} note="Últimos 30 días · pedidos no cancelados" icon={TrendingUp} trend={variation(currentSales, previousSales)} />
        <Metric label="Productos publicados" value={String(products.filter(p => p.activo).length)} note={productLimit >= 999999 ? 'Sin límite de productos' : `de ${productLimit} disponibles`} icon={Package} />
        <Metric label="Clientes activos" value={String(currentCustomers)} note="Con pedidos en los últimos 30 días" icon={Users} trend={variation(currentCustomers, previousCustomers)} />
      </div>
      <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-head"><div><span className="eyebrow">MOVIMIENTO RECIENTE</span><h2>Últimos pedidos</h2></div><Link href="/app/orders" className="text-link">Ver todos <ArrowRight size={14} /></Link></div>{orders.length ? <div className="recent-list">{orders.slice(0, 4).map(o => <button className="recent-row" key={o.id} onClick={() => setSelectedOrder(o)} data-testid={`row-order-${o.id}`}><span className="order-number">#{String(o.numero).padStart(3, '0')}</span><span className="recent-customer"><b>{data.customers.find(c => c.id === o.customer_id)?.nombre}</b><small>{o.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', ')}</small></span><span className="recent-total">{money(o.total)}</span><Status value={o.estado} /></button>)}</div> : <Empty title="Aún no llegan pedidos" text="Cuando tus clientes compren, verás sus pedidos aquí." />}</section><section className="panel quick-panel"><div className="panel-head"><div><span className="eyebrow">SIGUIENTE PASO</span><h2>Haz crecer tu tienda</h2></div><Zap size={17} /></div><div className="setup-progress"><span>Tu tienda está lista para crecer</span><b>{products.length > 0 && settings.publicado ? '100%' : '60%'}</b><div><i style={{ width: products.length > 0 && settings.publicado ? '100%' : '60%' }} /></div></div><Link href="/app/products" className="quick-link"><span className="quick-icon"><Package size={17} /></span><span><b>Completa tu catálogo</b><small>Agrega productos y precios</small></span><ChevronRight size={16} /></Link><Link href="/app/editor" className="quick-link"><span className="quick-icon coral"><Pencil size={17} /></span><span><b>Personaliza tu vitrina</b><small>Colores, portada y contacto</small></span><ChevronRight size={16} /></Link><Link href="/app/subscription" className="quick-link"><span className="quick-icon sand"><CreditCard size={17} /></span><span><b>Tu plan: {plan?.nombre || 'Semilla'}</b><small>Conoce lo que incluye</small></span><ChevronRight size={16} /></Link></section></div>
      <div className="bottom-note"><span>Tu tienda pública</span><Link href={`/${business.slug}`}>clickok.co/{business.slug} <ExternalLink size={13} /></Link></div>
      {selectedOrder && <OrderModal order={selectedOrder} data={data} close={() => setSelectedOrder(null)} update={update} />}
    </>;
  }
  if (path === '/app/catalog') return <><PageTitle eyebrow="TU VITRINA DIGITAL" title="Catálogo" description="Así se ve tu tienda para tus clientes." action={<Link href={`/${business.slug}`} target="_blank" className="btn btn-outline"><ExternalLink size={15} /> Abrir tienda</Link>} /><div className="catalog-banner"><div className="catalog-monogram">{business.nombre.charAt(0)}</div><div><span className="eyebrow">VISTA PÚBLICA</span><h2>{business.nombre}</h2><p>{settings.tagline} · clickok.co/{business.slug}</p></div><Status value={settings.publicado && business.estado === 'activo' ? 'activo' : 'pendiente'} /></div><div className="section-heading"><h2>Categorías visibles</h2><Link href="/app/categories" className="text-link">Editar categorías <ArrowRight size={14} /></Link></div><div className="category-chips">{cats.filter(c => c.activo).map(c => <span key={c.id}>{c.nombre} <small>{products.filter(p => p.category_id === c.id && p.activo).length}</small></span>)}</div><div className="section-heading"><h2>Productos publicados <small>{products.filter(p => p.activo).length}</small></h2><Link href="/app/products" className="btn btn-soft"><Pencil size={15} /> Gestionar productos</Link></div><ProductGrid products={products.filter(p => p.activo)} cats={cats} /></>;
  if (path === '/app/products') return <>
    <PageTitle eyebrow="LO QUE OFRECES" title="Productos" description={`${products.length} productos · ${products.filter(p => p.activo).length} visibles en tu tienda`} action={<HeaderAction text="Nuevo producto" onClick={() => createProduct()} />} />
    <div className="toolbar">
      <label className="search-field"><Search size={17} /><input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-products" /></label>
      <select value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-product-filter"><option value="todos">Todos los estados</option><option value="activos">Disponibles</option><option value="inactivos">No disponibles</option></select>
      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} data-testid="select-product-category-filter"><option value="todos">Todas las categorías</option>{cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      <span className="toolbar-count">{filteredProducts.length} resultados</span>
    </div>
    {filteredProducts.length ? <DataTable headers={['Producto', 'Categoría', 'Precio', 'Estado', 'Acciones']}>{filteredProducts.map(p => <tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="table-product"><span className="product-thumb">{p.nombre.slice(0, 1)}</span><span><b>{p.nombre}</b><small>{p.destacado ? 'Destacado' : p.descripcion.slice(0, 40)}</small></span></div></td><td>{cats.find(c => c.id === p.category_id)?.nombre || 'Sin categoría'}</td><td><b>{money(p.precio)}</b>{p.precio_anterior && <small className="old-price">{money(p.precio_anterior)}</small>}</td><td><Status value={p.activo && p.disponible ? 'activo' : 'suspendido'} /></td><td><div className="table-actions"><button title="Editar" onClick={() => createProduct(p)} data-testid={`button-edit-product-${p.id}`}><Pencil size={15} /></button><button title={p.activo ? 'Desactivar' : 'Activar'} onClick={() => update(d => ({ ...d, products: d.products.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x) }), 'Estado del producto actualizado', p.nombre)}><Eye size={15} /></button><button title="Duplicar" onClick={() => update(d => ({ ...d, products: [...d.products, { ...p, id: repository.id(), nombre: `${p.nombre} (copia)` }] }), 'Producto duplicado', p.nombre)}><MoreHorizontal size={15} /></button><button title="Eliminar" onClick={() => { if (confirm(`¿Eliminar ${p.nombre}?`)) update(d => ({ ...d, products: d.products.filter(x => x.id !== p.id) }), 'Producto eliminado', p.nombre); }}><Trash2 size={15} /></button></div></td></tr>)}</DataTable> : <Empty title="No hay productos con ese filtro" text="Prueba otra búsqueda o crea tu primer producto." action={<HeaderAction text="Crear producto" onClick={() => createProduct()} />} />}
    <p className="plan-limit"><Package size={15} /> Plan {plan?.nombre}: {products.length} de {productLimitLabel(productLimit)} productos utilizados.</p>
    {modal && <FormModal {...modal} businessId={business.id} close={() => setModal(null)} submit={modal.save} />}
  </>;
  if (path === '/app/categories') return <><PageTitle eyebrow="ORDENA TU VITRINA" title="Categorías" description="Agrupa tus productos para que encontrar lo bueno sea fácil." action={<HeaderAction text="Nueva categoría" onClick={() => addCategory()} />} /><div className="category-manager">{cats.map((c, index) => <div className="category-row" key={c.id} data-testid={`row-category-${c.id}`}><span className="category-order">{String(c.orden).padStart(2, '0')}</span><div className="category-info"><b>{c.nombre}</b><small>{products.filter(p => p.category_id === c.id).length} productos</small></div><Status value={c.activo ? 'activo' : 'suspendido'} /><div className="table-actions"><button title="Subir" disabled={index === 0} onClick={() => update(d => ({ ...d, categories: d.categories.map(x => x.id === c.id ? { ...x, orden: x.orden - 1 } : x) }), 'Orden actualizado', c.nombre)}>↑</button><button title="Bajar" disabled={index === cats.length - 1} onClick={() => update(d => ({ ...d, categories: d.categories.map(x => x.id === c.id ? { ...x, orden: x.orden + 1 } : x) }), 'Orden actualizado', c.nombre)}>↓</button><button title="Editar" onClick={() => addCategory(c)}><Pencil size={15} /></button><button title="Eliminar" onClick={() => { if (confirm(`¿Eliminar la categoría ${c.nombre}?`)) update(d => ({ ...d, categories: d.categories.filter(x => x.id !== c.id) }), 'Categoría eliminada', c.nombre); }}><Trash2 size={15} /></button></div></div>)}{!cats.length && <Empty title="Empieza por una categoría" text="Organiza tus productos por tipo, colección o momento." />}</div>{modal && <FormModal {...modal} close={() => setModal(null)} submit={modal.save} />}</>;
  if (path === '/app/orders') return <>
    <PageTitle eyebrow="CADA PEDIDO EN SU LUGAR" title="Pedidos" description="Sigue cada compra desde que llega hasta que se entrega." />
    <div className="toolbar">
      <label className="search-field"><Search size={17} /><input placeholder="Buscar por cliente o número..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-orders" /></label>
      <select value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-order-filter">{['todos', 'pendiente', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado'].map(s => <option value={s} key={s}>{s === 'todos' ? 'Todos los estados' : statusLabel[s]}</option>)}</select>
      <label className="date-filter">Desde <input type="date" value={orderFrom} onChange={e => setOrderFrom(e.target.value)} data-testid="input-orders-from" /></label>
      <label className="date-filter">Hasta <input type="date" value={orderTo} onChange={e => setOrderTo(e.target.value)} data-testid="input-orders-to" /></label>
      <span className="toolbar-count">{filteredOrders.length} pedidos</span>
    </div>
    {filteredOrders.length ? <DataTable headers={['Pedido', 'Cliente', 'Fecha', 'Entrega', 'Total', 'Estado', '']}>{filteredOrders.map(o => <tr key={o.id}><td><b>#{String(o.numero).padStart(3, '0')}</b></td><td><div className="simple-cell"><b>{data.customers.find(c => c.id === o.customer_id)?.nombre || 'Cliente'}</b><small>{o.items.length} producto(s)</small></div></td><td>{shortDate(o.created_at)}</td><td>{o.entrega === 'domicilio' ? 'Domicilio' : 'Recoger'}</td><td><b>{money(o.total)}</b></td><td><Status value={o.estado} /></td><td><button className="table-detail" onClick={() => setSelectedOrder(o)} data-testid={`button-order-detail-${o.id}`}>Ver <ChevronRight size={14} /></button></td></tr>)}</DataTable> : <Empty title="Todavía no hay pedidos" text="Prueba otro rango de fechas o comparte el enlace de tu tienda." action={<Link href={`/${business.slug}`} className="btn btn-outline">Ver tienda <ArrowRight size={15} /></Link>} />}
    {selectedOrder && <OrderModal order={selectedOrder} data={data} close={() => setSelectedOrder(null)} update={update} />}
  </>;
  if (path === '/app/customers') return <>
    <PageTitle eyebrow="GENTE QUE VUELVE" title="Clientes" description="Un vistazo a quienes ya eligieron tu negocio." />
    <div className="metrics-grid compact-metrics"><Metric label="Clientes registrados" value={String(customers.length)} note="Con compra en la tienda" icon={Users} /><Metric label="Compras acumuladas" value={money(customers.reduce((a, c) => a + c.total_compras, 0))} note="Compras registradas en tu tienda" icon={TrendingUp} /></div>
    {customers.length ? <DataTable headers={['Cliente', 'Teléfono', 'Pedidos', 'Compras', 'Último pedido', 'Historial']}>{customers.map(c => <tr key={c.id} data-testid={`row-customer-${c.id}`}><td><div className="table-product"><span className="customer-avatar">{c.nombre.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><b>{c.nombre}</b></div></td><td>{c.telefono}</td><td>{c.total_pedidos}</td><td><b>{money(c.total_compras)}</b></td><td>{shortDate(c.ultimo_pedido)}</td><td><button className="table-detail" onClick={() => setSelectedCustomer(c)} data-testid={`button-customer-history-${c.id}`}>Ver pedidos <ChevronRight size={14} /></button></td></tr>)}</DataTable> : <Empty title="Tu comunidad empieza aquí" text="Cuando llegue el primer pedido, verás el historial de tus clientes." />}
    {selectedCustomer && <CustomerHistoryModal customer={selectedCustomer} orders={orders.filter(o => o.customer_id === selectedCustomer.id)} close={() => setSelectedCustomer(null)} onSelectOrder={order => { setSelectedCustomer(null); setSelectedOrder(order); }} />}
    {selectedOrder && <OrderModal order={selectedOrder} data={data} close={() => setSelectedOrder(null)} update={update} />}
  </>;
  if (path === '/app/editor') return <><PageTitle eyebrow="CLICKOK STUDIO" title="CLICKOK Studio" description="Personaliza la identidad de tu tienda y mira los cambios en tiempo real." action={<Link href={`/${business.slug}`} target="_blank" className="btn btn-outline"><Eye size={15} /> Abrir tienda</Link>} /><div className="studio-shell"><aside className="panel studio-controls"><div className="studio-intro"><span className="studio-kicker"><Pencil size={13}/> ESTUDIO DE DISEÑO</span><h2>Tu marca, tus reglas.</h2><p>Los cambios se guardan automáticamente.</p></div><div className="studio-section"><div className="studio-section-title"><span>01</span><div><b>Identidad</b><small>Nombre y personalidad</small></div></div><div className="form-stack"><label className="field"><span>Nombre del negocio</span><input defaultValue={business.nombre} onBlur={e => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, nombre: e.target.value } : b) }), 'Nombre de tienda guardado', business.nombre)} data-testid="input-store-name" /></label><label className="field"><span>Frase de presentación</span><input defaultValue={settings.tagline} onBlur={e => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, tagline: e.target.value } : s) }), 'Presentación guardada', business.nombre)} data-testid="input-store-tagline" /></label><Field field={{ name: 'logo', label: 'Logo de tu negocio', type: 'image', value: settings.logo }} businessId={business.id} onChange={(_, value) => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, logo: String(value) } : s) }), 'Logo actualizado', business.nombre)} /></div></div><div className="studio-section"><div className="studio-section-title"><span>02</span><div><b>Colores</b><small>Elige el tono de tu marca</small></div></div><div className="studio-palette">{[{name:'Coral',value:'#e7785d'},{name:'Océano',value:'#3977a8'},{name:'Esmeralda',value:'#26856f'},{name:'Violeta',value:'#7357d9'},{name:'Carbón',value:'#273449'},{name:'Dorado',value:'#bd9148'}].map(p => <button type="button" key={p.value} className={`studio-swatch ${previewStoreColor.toLowerCase()===p.value?'selected':''}`} style={{'--swatch':p.value} as React.CSSProperties} onClick={() => {setDraftStoreColor(p.value); update(d => ({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,color:p.value}:s)}),'Paleta actualizada',business.nombre);}} aria-label={`Usar color ${p.name}`} title={p.name}><i/></button>)}</div><label className="field"><span>Color personalizado</span><div className="color-field"><input type="color" value={previewStoreColor} onChange={e => setDraftStoreColor(e.target.value)} onBlur={commitStoreColor} onKeyDown={e => {if(e.key==='Enter'){e.preventDefault();commitStoreColor();}}} data-testid="input-store-color"/><span>{previewStoreColor.toUpperCase()}</span><div className="color-swatch" style={{backgroundColor:previewStoreColor}}/></div></label></div><div className="studio-section"><div className="studio-section-title"><span>03</span><div><b>Tipografía</b><small>El carácter de tus textos</small></div></div><label className="field"><span>Estilo de letra</span><select value={settings.fuente} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,fuente:e.target.value}:s)}),'Tipografía actualizada',business.nombre)}><option>Manrope</option><option>DM Sans</option><option>Georgia</option><option>Arial</option></select></label></div><div className="studio-section"><div className="studio-section-title"><span>04</span><div><b>Portada y redes</b><small>Haz que te encuentren</small></div></div><div className="form-stack"><Field field={{ name: 'portada', label: 'Imagen de portada', type: 'image', value: settings.portada }} businessId={business.id} onChange={(_, value) => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, portada: String(value) } : s) }), 'Portada actualizada', business.nombre)} /><label className="field"><span>Contacto visible</span><input defaultValue={settings.contacto} placeholder="WhatsApp o teléfono" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,contacto:e.target.value}:s)}),'Contacto actualizado',business.nombre)}/></label><label className="field"><span>Entrega y recogida</span><input defaultValue={settings.entrega} placeholder="Domicilios y recoger en tienda" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,entrega:e.target.value}:s)}),'Información de entrega actualizada',business.nombre)}/></label><label className="field"><span>Usuario de redes sociales</span><input defaultValue={settings.redes} placeholder="@tunegocio" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,redes:e.target.value}:s)}),'Redes sociales actualizadas',business.nombre)}/></label></div></div><div className="studio-section"><div className="studio-section-title"><span>05</span><div><b>Diseño de catálogo</b><small>Distribución y estilo de productos</small></div></div><label className="field"><span>Distribución de productos</span><select value={settings.layout} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,layout:e.target.value as StoreSettings['layout']}:s)}),'Distribución actualizada',business.nombre)}><option value="grid">Cuadrícula</option><option value="list">Lista horizontal</option></select></label><label className="field"><span>Estilo de tarjetas</span><select value={settings.card_style} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,card_style:e.target.value as StoreSettings['card_style']}:s)}),'Tarjetas actualizadas',business.nombre)}><option value="classic">Clásico</option><option value="minimal">Minimalista</option><option value="soft">Suave y moderno</option></select></label><label className="field"><span>Forma de botones</span><select value={settings.button_style} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,button_style:e.target.value as StoreSettings['button_style']}:s)}),'Botones actualizados',business.nombre)}><option value="rounded">Redondeados</option><option value="pill">Pastilla</option><option value="square">Cuadrados</option></select></label></div><div className="studio-publish"><div><b>{settings.publicado?'Tu vitrina está publicada':'Tu vitrina está oculta'}</b><small>{settings.publicado?'Los clientes pueden visitar tu tienda.':'Publícala cuando esté lista.'}</small></div><button className={`toggle ${settings.publicado?'toggle-on':''}`} onClick={()=>{update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,publicado:!s.publicado}:s)}),settings.publicado?'Tienda despublicada':'Tienda publicada',business.nombre);}} aria-label="Cambiar publicación" data-testid="toggle-store-published"><i/></button></div></aside><section className="studio-preview"><div className="studio-preview-head"><div><span className="studio-kicker">VISTA EN TIEMPO REAL</span><b>Así verán tu tienda</b></div><span className="studio-live"><i/> PREVISUALIZACIÓN</span></div><div className="preview-browser studio-browser"><div className="browser-bar"><i/><i/><i/><span>clickok.co/{business.slug}</span></div><div className="live-preview" style={{'--store-color':previewStoreColor,'fontFamily':settings.fuente==='Georgia'?'Georgia,serif':settings.fuente==='Arial'?'Arial,sans-serif':settings.fuente==='DM Sans'?'DM Sans,sans-serif':'Manrope,sans-serif'} as React.CSSProperties}><div className="live-cover" style={settings.portada?{backgroundImage:`linear-gradient(90deg,rgba(10,20,35,.58),rgba(10,20,35,.08)),url("${settings.portada}")`,backgroundSize:'cover',backgroundPosition:'center'}:undefined}><span>HECHO PARA TI</span><b>{business.nombre}</b></div><div className="live-brand">{settings.logo?<img src={settings.logo} alt="Logo de la tienda" onError={e=>{e.currentTarget.style.display='none';}}/>:<span>{business.nombre.charAt(0)}</span>}<div><b>{business.nombre}</b><small>{settings.tagline}</small></div></div><div className="live-search">⌕ &nbsp; Busca algo para hoy</div><div className="live-category">{cats.filter(c=>c.activo).slice(0,3).map(c=><span key={c.id}>{c.nombre}</span>)}</div><div className="live-products">{products.slice(0,2).map(p=><div key={p.id}><span>{p.nombre.charAt(0)}</span><b>{p.nombre}</b><small>{money(p.precio)}</small></div>)}</div></div></div><div className="studio-preview-foot"><span><CheckCircle2 size={14}/> Vista previa interactiva</span><small>Los cambios se guardan automáticamente en tu vitrina.</small></div></section></div></>;
  if (path === '/app/analytics') {
    const now = Date.now();
    const currentStart = now - 30 * 86400000;
    const previousStart = now - 60 * 86400000;
    const completed = orders.filter(o => o.estado !== 'cancelado');
    const currentCompleted = completed.filter(o => new Date(o.created_at).getTime() >= currentStart);
    const previousCompleted = completed.filter(o => { const time = new Date(o.created_at).getTime(); return time >= previousStart && time < currentStart; });
    const currentOrders = orders.filter(o => new Date(o.created_at).getTime() >= currentStart);
    const previousOrders = orders.filter(o => { const time = new Date(o.created_at).getTime(); return time >= previousStart && time < currentStart; });
    const currentSales = currentCompleted.reduce((a, o) => a + o.total, 0);
    const previousSales = previousCompleted.reduce((a, o) => a + o.total, 0);
    const average = currentCompleted.length ? Math.round(currentSales / currentCompleted.length) : 0;
    const previousAverage = previousCompleted.length ? Math.round(previousSales / previousCompleted.length) : 0;
    const variation = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 'Nuevo período' : 'Sin variación';
      const change = Math.round(((current - previous) / previous) * 100);
      return `${change > 0 ? '+' : ''}${change}% vs. mes anterior`;
    };
    const activeProducts = products.filter(p => p.activo && p.disponible).length;
    const lastSevenDays = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - i)); return date; });
    const counts = lastSevenDays.map(date => orders.filter(o => { const created = new Date(o.created_at); return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth() && created.getDate() === date.getDate(); }).length);
    const max = Math.max(1, ...counts);
    const periodStart = new Date(Date.now() - 30 * 86400000);
    const periodEvents = data.catalog_events.filter(event => event.business_id === business.id && new Date(event.created_at) >= periodStart);
    const consultationCounts = periodEvents.filter(event => event.tipo === 'consulta' && event.product_id).reduce<Record<string, number>>((acc, event) => { acc[event.product_id!] = (acc[event.product_id!] || 0) + 1; return acc; }, {});
    const mostConsulted = Object.entries(consultationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const visits = periodEvents.filter(event => event.tipo === 'visita').length;
    const consultations = periodEvents.filter(event => event.tipo === 'consulta').length;
    const bestSelling = products.map(product => ({ product, units: orders.flatMap(order => order.items).filter(item => item.product_id === product.id).reduce((sum, item) => sum + item.cantidad, 0) })).filter(item => item.units > 0).sort((a, b) => b.units - a.units).slice(0, 4);
    return <>
      <PageTitle eyebrow="NÚMEROS QUE CUENTAN" title="Analítica" description="Comparación de los últimos 30 días frente a los 30 días anteriores." />
      <div className="metrics-grid"><Metric label="Ventas últimos 30 días" value={money(currentSales)} note="Sin pedidos cancelados" icon={TrendingUp} trend={variation(currentSales, previousSales)} /><Metric label="Pedidos" value={String(currentOrders.length)} note="Últimos 30 días · todos los estados" icon={ShoppingCart} trend={variation(currentOrders.length, previousOrders.length)} /><Metric label="Promedio por pedido" value={money(average)} note="Ticket promedio · últimos 30 días" icon={CreditCard} trend={variation(average, previousAverage)} /><Metric label="Productos activos" value={String(activeProducts)} note="Disponibles para vender" icon={Package} trend={`${activeProducts} disponibles`} /></div>
      <div className="analytics-grid"><section className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">ÚLTIMOS 7 DÍAS</span><h2>Pedidos por día</h2></div><span className="chart-badge">Pedidos registrados</span></div><div className="bar-chart">{counts.map((v, i) => <div className="bar-column" key={i}><span>{v}</span><i style={{ height: `${Math.max(8, v / max * 100)}%` }} /><small>{['D', 'L', 'M', 'M', 'J', 'V', 'S'][lastSevenDays[i].getDay()]}</small></div>)}</div></section><section className="panel best-panel"><div className="panel-head"><div><span className="eyebrow">LOS QUE MÁS SE MUEVEN</span><h2>Productos más vendidos</h2></div></div>{bestSelling.length ? bestSelling.map(({product, units}, i) => <div className="rank-row" key={product.id}><span>0{i + 1}</span><b>{product.nombre}</b><small>{units} vendidos</small></div>) : <p className="subtle">Aún no hay unidades vendidas registradas.</p>}</section></div>
      <div className="analytics-grid analytics-bottom"><section className="panel"><div className="panel-head"><div><span className="eyebrow">TRÁFICO DE TU TIENDA</span><h2>Visitas y consultas</h2></div><Eye size={17} /></div><div className="traffic-summary"><div><b>{visits}</b><span>Visitas al catálogo</span></div><div><b>{consultations}</b><span>Consultas de producto</span></div></div><p className="fine-print">Datos registrados en Supabase durante los últimos 30 días.</p></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">INTERÉS DE TUS CLIENTES</span><h2>Más consultados</h2></div></div>{mostConsulted.length ? mostConsulted.map(([id, count], i) => <div className="rank-row" key={id}><span>0{i + 1}</span><b>{products.find(p => p.id === id)?.nombre || 'Producto'}</b><small>{count} consultas</small></div>) : <p className="subtle">Aún no hay consultas de producto registradas.</p>}</section></div>
    </>;
  }
  if (path === '/app/settings') return <><PageTitle eyebrow="DATOS DEL NEGOCIO" title="Ajustes" description="Mantén al día la información que tus clientes necesitan." /><div className="settings-grid"><section className="panel setting-section"><span className="eyebrow">INFORMACIÓN PÚBLICA</span><h2>Que te encuentren</h2><div className="form-stack"><SettingInput label="Nombre del negocio" value={business.nombre} id="business-name" onSave={v => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, nombre: v } : b) }), 'Datos guardados', 'Negocio')} /><SettingInput label="Teléfono" value={business.telefono} id="business-phone" onSave={v => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, telefono: v } : b) }), 'Teléfono actualizado', 'Negocio')} /><SettingInput label="Correo de contacto" value={settings.contacto} id="contact-email" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, contacto: v } : s) }), 'Contacto actualizado', 'Negocio')} /><SettingInput label="Redes sociales" value={settings.redes} id="business-social" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, redes: v } : s) }), 'Redes actualizadas', 'Negocio')} /></div></section><section className="panel setting-section"><span className="eyebrow">CÓMO OPERAS</span><h2>Pagos y entregas</h2><div className="form-stack"><SettingInput label="Métodos de pago" value={settings.pagos} id="payment-methods" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, pagos: v } : s) }), 'Métodos de pago guardados', 'Negocio')} /><SettingInput label="Opciones de entrega" value={settings.entrega} id="delivery-methods" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, entrega: v } : s) }), 'Opciones de entrega guardadas', 'Negocio')} /><div className="settings-info"><CircleHelp size={17} /><p>CLICKOK organiza tus pedidos. El cobro y la coordinación de entrega siguen directamente contigo y tu cliente.</p></div></div></section></div></>;
  if (path === '/app/subscription') return <><PageTitle eyebrow="TU TIENDA, A TU RITMO" title="Plan y suscripción" description="Empieza con lo esencial. Cambia cuando tu negocio lo pida." /><div className="current-plan"><div><span className="eyebrow">PLAN ACTUAL</span><h2>{plan?.nombre || 'Gratis'}<span>{money(plan?.precio || 0)} <small>/ mes</small></span></h2><p>Suscripción {statusLabel[subscription?.estado || 'activa']?.toLowerCase()} · Renueva el {shortDate(subscription?.vencimiento || new Date().toISOString())}</p></div><Status value={subscription?.estado || 'activa'} /></div><div className="plans-grid">{data.plans.filter(p => p.activo).map(p => <article className={`plan-card ${p.id === plan?.id ? 'plan-selected' : ''}`} key={p.id}><span className="eyebrow">{p.id === 'pro' ? 'PARA CRECER' : p.id === 'starter' ? 'EL FAVORITO' : 'PARA EMPEZAR'}</span><h3>{p.nombre}</h3><p className="plan-price">{money(p.precio)}<small> / {p.periodicidad === 'year' ? 'año' : 'mes'}</small></p><p className="plan-products">{p.max_productos >= 999999 ? 'Productos ilimitados' : `Hasta ${p.max_productos} productos`}</p><ul>{p.funciones.map(f => <li key={f}><Check size={15} /> {f}</li>)}</ul><Button kind={p.id === plan?.id ? 'soft' : 'outline'} disabled={p.id === plan?.id || p.precio <= 0 || Boolean(checkoutBusy)} onClick={() => void startSubscriptionCheckout(p.id)} testId={`button-plan-${p.id}`}>{p.id === plan?.id ? 'Tu plan actual' : checkoutBusy === p.id ? 'Conectando con Wompi…' : p.precio <= 0 ? 'Plan gratuito' : 'Pagar con Wompi'}</Button></article>)}</div>{checkoutError && <div className="notice notice-error" role="alert">{checkoutError}</div>}<p className="fine-print">Pagos procesados de forma segura por Wompi. Tu plan se activa cuando recibimos la confirmación del pago.</p></>;
  return <Empty title="Página en construcción" text="Este espacio estará disponible pronto." />;
}

function SettingInput({ label, value, id, onSave }: { label: string; value: string; id: string; onSave: (value: string) => void }) {
  const displayValue = id === 'platform-name' && value === 'MENUYA' ? 'CLICKOK' : value;
  return <label className="field"><span>{label}</span><input defaultValue={displayValue} onBlur={e => { if (e.target.value !== value) onSave(e.target.value); }} data-testid={`input-${id}`} /></label>;
}
function ProductGrid({ products, cats }: { products: Product[]; cats: Category[] }) {
  return <div className="managed-product-grid">{products.map((p, i) => <article key={p.id} className="managed-product"><div className={`managed-art managed-art-${i % 5}`}><span>{cats.find(c => c.id === p.category_id)?.nombre}</span><b>{p.nombre.charAt(0)}</b></div><div className="managed-product-info"><h3>{p.nombre}</h3><p>{p.descripcion}</p><b>{money(p.precio)}</b></div></article>)}</div>;
}
function OrderModal({ order, data, close, update }: { order: Order; data: DemoData; close: () => void; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const customer = data.customers.find(c => c.id === order.customer_id);
  const statuses: OrderStatus[] = ['pendiente', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado'];
  return <Modal title={`Pedido #${String(order.numero).padStart(3, '0')}`} close={close}><div className="order-detail"><div className="detail-customer"><span className="customer-avatar">{customer?.nombre.slice(0, 1)}</span><span><b>{customer?.nombre || 'Cliente'}</b><small>{customer?.telefono}</small></span><Status value={order.estado} /></div><div className="detail-items">{order.items.map((item, i) => <div key={`${item.product_id}-${i}`}><span>{item.cantidad} × {item.nombre}{(item.variante || item.complementos?.length) && <small className="item-options">{[item.variante, ...(item.complementos || []).map(choice => `+ ${choice.nombre}`)].filter(Boolean).join(' · ')}</small>}</span><b>{money(item.precio * item.cantidad)}</b></div>)}</div><div className="detail-total"><span>Total del pedido</span><b>{money(order.total)}</b></div><div className="detail-meta"><span>Entrega<b>{order.entrega === 'domicilio' ? 'Domicilio' : 'Recoger en tienda'}</b></span>{order.direccion && <span>Dirección<b>{order.direccion}</b></span>}<span>Pago<b>{order.metodo_pago}</b></span><span>Fecha<b>{shortDate(order.created_at)}</b></span></div>{order.observaciones && <div className="order-note"><small>OBSERVACIONES</small><p>{order.observaciones}</p></div>}<label className="field"><span>Estado del pedido</span><select value={order.estado} onChange={e => update(d => ({ ...d, orders: d.orders.map(o => o.id === order.id ? { ...o, estado: e.target.value as OrderStatus } : o) }), `Pedido actualizado: ${statusLabel[e.target.value]}`, `Pedido #${order.numero}`)} data-testid="select-order-status">{statuses.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}</select></label><div className="modal-actions"><Button kind="ghost" onClick={close}>Cerrar</Button><Button onClick={close}>Listo <Check size={15} /></Button></div></div></Modal>;
}

function CustomerHistoryModal({ customer, orders, close, onSelectOrder }: { customer: Customer; orders: Order[]; close: () => void; onSelectOrder: (order: Order) => void }) {
  return <Modal title={`Pedidos de ${customer.nombre}`} close={close}><div className="customer-history"><div className="detail-customer"><span className="customer-avatar">{customer.nombre.slice(0, 1)}</span><span><b>{customer.telefono}</b><small>{customer.total_pedidos} pedidos · {money(customer.total_compras)} acumulados</small></span></div>{orders.length ? <div className="customer-order-list">{orders.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(order => <button key={order.id} onClick={() => onSelectOrder(order)} data-testid={`button-history-order-${order.id}`}><span><b>Pedido #{String(order.numero).padStart(3, '0')}</b><small>{shortDate(order.created_at)} · {order.items.length} producto(s)</small></span><strong>{money(order.total)}</strong><Status value={order.estado} /><ChevronRight size={15} /></button>)}</div> : <Empty title="Sin pedidos registrados" text="Aún no hay pedidos en el historial de este cliente." />}<div className="modal-actions"><Button kind="ghost" onClick={close}>Cerrar historial</Button></div></div></Modal>;
}

function AdminPage({ path, data, update }: { path: string; data: DemoData; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [modal, setModal] = useState<{ title: string; fields: FormField[]; save: (v: Record<string, string | boolean>) => void } | null>(null);
  const open = (title: string, fields: FormField[], save: (v: Record<string, string | boolean>) => void) => setModal({ title, fields, save });
  const changeBusiness = (b: Business, estado: Business['estado']) => update(d => ({ ...d, businesses: d.businesses.map(x => x.id === b.id ? { ...x, estado } : x), subscriptions: d.subscriptions.map(s => s.business_id === b.id ? { ...s, estado: estado === 'activo' ? 'activa' : estado } : s), settings: d.settings.map(s => s.business_id === b.id ? { ...s, publicado: estado === 'activo' } : s) }), `Comercio ${statusLabel[estado].toLowerCase()}`, b.nombre);
  const createBusiness = () => open('Crear comercio', [
    { name: 'propietario', label: 'Nombre del propietario', required: true },
    { name: 'correo', label: 'Correo del propietario', type: 'email', required: true },
    { name: 'negocio', label: 'Nombre del negocio', required: true },
    { name: 'sector', label: 'Sector', options: ['Restaurante', 'Ropa', 'Barbería', 'Tecnología', 'Panadería', 'Otro'], required: true },
    { name: 'telefono', label: 'Teléfono', required: true },
  ], values => {
    const ownerName = String(values.propietario).trim();
    const email = String(values.correo).trim().toLowerCase();
    const businessName = String(values.negocio).trim();
    const phone = String(values.telefono).trim();
    if (data.users.some(user => user.email.toLowerCase() === email)) {
      setModal({ title: 'Correo ya registrado', fields: [{ name: 'correo', label: 'Este correo ya pertenece a una cuenta', value: email }], save: () => setModal(null) });
      return;
    }
    const businessId = repository.id();
    const ownerId = repository.id();
    const slugBase = businessName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase || 'tienda'}-${businessId.slice(-4)}`;
    const state: Business['estado'] = data.platform.approval === 'automatica' ? 'activo' : 'pendiente';
    const category: Category = { id: repository.id(), business_id: businessId, nombre: 'General', orden: 1, activo: true };
    const planId = data.plans.find(plan => plan.id === data.platform.default_plan)?.id || data.plans[0]?.id || 'gratis';
    const created: Business = { id: businessId, owner_id: ownerId, nombre: businessName, slug, tipo: String(values.sector).toLowerCase(), telefono: phone, estado: state, created_at: repository.date(0) };
    update(d => ({
      ...d,
      users: [...d.users, { id: ownerId, nombre: ownerName, email, password: 'demo2026', role: 'owner', business_ids: [businessId] }],
      businesses: [...d.businesses, created],
      categories: [...d.categories, category],
      settings: [...d.settings, { business_id: businessId, portada: '', logo: '', color: '#e77a60', fuente: 'Manrope', contacto: phone, redes: '', pagos: 'Efectivo, Nequi', entrega: 'Domicilio y recoger en tienda', publicado: state === 'activo', tagline: 'Un negocio local, hecho con cariño.' }],
      subscriptions: [...d.subscriptions, { id: repository.id(), business_id: businessId, plan_id: planId, estado: state === 'activo' ? 'activa' : 'pendiente', inicio: repository.date(0), vencimiento: repository.date(-30) }],
    }), `Comercio creado · acceso demo ${email} / demo2026`, businessName);
    setModal(null);
  });
  const createPlan = (initial?: Plan) => open(initial ? 'Editar plan' : 'Crear plan', [
    { name: 'nombre', label: 'Nombre del plan', value: initial?.nombre, required: true }, { name: 'precio', label: 'Precio mensual (COP)', type: 'number', value: initial?.precio || 0, required: true },
    { name: 'max_productos', label: 'Máximo de productos (999999 = ilimitado)', type: 'number', value: initial?.max_productos || 15, required: true },
    { name: 'funciones', label: 'Funciones (separadas por coma)', value: initial?.funciones.join(', ') }, { name: 'activo', label: 'Plan activo', type: 'checkbox', value: initial?.activo ?? true },
  ], v => {
    const item: Plan = { id: initial?.id || repository.id(), nombre: String(v.nombre), precio: Number(v.precio), periodicidad: 'mes', max_productos: Number(v.max_productos), funciones: String(v.funciones || '').split(',').map(x => x.trim()).filter(Boolean), activo: Boolean(v.activo) };
    update(d => ({ ...d, plans: initial ? d.plans.map(p => p.id === initial.id ? item : p) : [...d.plans, item] }), initial ? 'Plan actualizado' : 'Plan creado', item.nombre); setModal(null);
  });
  const deletePlan = (plan: Plan) => {
    const replacement = data.plans.find(item => item.id !== plan.id);
    if (!replacement) return;
    const affected = data.subscriptions.filter(subscription => subscription.plan_id === plan.id).length;
    const consequence = affected ? ` ${affected} suscripción(es) se reasignarán a ${replacement.nombre}.` : '';
    if (!confirm(`¿Eliminar el plan ${plan.nombre}?${consequence}`)) return;
    update(d => ({
      ...d,
      plans: d.plans.filter(item => item.id !== plan.id),
      subscriptions: d.subscriptions.map(subscription => subscription.plan_id === plan.id ? { ...subscription, plan_id: replacement.id } : subscription),
      platform: { ...d.platform, default_plan: d.platform.default_plan === plan.id ? replacement.id : d.platform.default_plan },
    }), 'Plan eliminado', plan.nombre);
  };
  const bizList = data.businesses.filter(b => `${b.nombre} ${b.tipo} ${data.users.find(u => u.id === b.owner_id)?.nombre}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'todos' || b.estado === filter));
  if (path === '/admin' || path === '/admin/') {
    const revenue = data.subscriptions.filter(s => s.estado === 'activa').reduce((sum, s) => sum + (data.plans.find(p => p.id === s.plan_id)?.precio || 0), 0);
    const pending = data.businesses.filter(b => b.estado === 'pendiente');
    return <><PageTitle eyebrow="CLICKOK · PANEL DE PLATAFORMA" title="La red CLICKOK" description="Un panorama de los comercios y la actividad de la plataforma." action={<Button kind="outline" onClick={() => { if (confirm('¿Restablecer por completo la demo? Se borrarán los cambios locales.')) location.reload(); }} testId="button-reset-demo"><Activity size={15} /> Restablecer demo</Button>} /><div className="metrics-grid"><Metric label="Comercios registrados" value={String(data.businesses.length)} note={`${data.businesses.filter(b => b.estado === 'activo').length} activos`} icon={Store} trend="+2 este mes" /><Metric label="Solicitudes por revisar" value={String(pending.length)} note="Requieren una decisión" icon={ClipboardList} /><Metric label="Usuarios" value={String(data.users.length)} note="Administradores y propietarios" icon={Users} /><Metric label="Ingreso mensual estimado" value={money(revenue)} note="Planes activos · sin cobro real" icon={CreditCard} /></div><div className="admin-overview-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">REQUIEREN TU ATENCIÓN</span><h2>Solicitudes recientes</h2></div><Link href="/admin/requests" className="text-link">Ver solicitudes <ArrowRight size={14} /></Link></div>{pending.length ? <div className="recent-list">{pending.map(b => <div className="business-request-row" key={b.id}><span className="biz-avatar">{b.nombre.slice(0, 1)}</span><span><b>{b.nombre}</b><small>{b.tipo} · {data.users.find(u => u.id === b.owner_id)?.nombre}</small></span><span className="request-date">{shortDate(b.created_at)}</span><Button kind="soft" onClick={() => changeBusiness(b, 'activo')}>Revisar <ArrowRight size={14} /></Button></div>)}</div> : <Empty title="Todo al día" text="No hay solicitudes pendientes por revisar." />}</section><section className="panel platform-panel"><div className="panel-head"><div><span className="eyebrow">ACTIVIDAD</span><h2>Últimas acciones</h2></div><Link href="/admin/audit" className="text-link">Auditoría <ArrowRight size={14} /></Link></div>{data.audit.slice(0, 5).map(a => <div className="audit-row" key={a.id}><span className="audit-dot" /><span><b>{a.accion}</b><small>{a.actor} · {a.entidad}</small></span><time>{shortDate(a.fecha)}</time></div>)}</section></div><div className="platform-note"><ShieldCheck size={16} /><span>Modo de demostración</span><p>Los datos solo existen en este navegador. El acceso no es seguro ni multiusuario de producción.</p><Link href="/admin/settings">Configurar plataforma <ArrowRight size={14} /></Link></div></>;
  }
  if (path === '/admin/businesses' || path === '/admin/requests') {
    const isRequests = path.endsWith('requests');
    const displayedBusinesses = bizList.filter(b => !isRequests || b.estado === 'pendiente');
    return <>
      <PageTitle eyebrow={isRequests ? 'REVISIÓN Y APROBACIÓN' : 'DIRECTORIO DE COMERCIOS'} title={isRequests ? 'Solicitudes de registro' : 'Comercios'} description={isRequests ? 'Aprueba, rechaza o pide revisar cada nuevo registro.' : `${data.businesses.length} negocios en la red CLICKOK.`} action={!isRequests ? <Button onClick={createBusiness} testId="button-create-business"><Plus size={16} /> Crear comercio</Button> : undefined} />
      <div className="toolbar"><label className="search-field"><Search size={17} /><input placeholder="Buscar negocio o propietario..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-businesses" /></label><select value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-business-filter"><option value="todos">Todos los estados</option>{['pendiente', 'activo', 'rechazado', 'suspendido'].map(s => <option value={s} key={s}>{statusLabel[s]}</option>)}</select><span className="toolbar-count">{displayedBusinesses.length} comercios</span></div>
      {displayedBusinesses.length ? <DataTable headers={['Negocio', 'Propietario', 'Sector', 'Registro', 'Estado', 'Acciones']}>{displayedBusinesses.map(b => <tr key={b.id} data-testid={`row-business-${b.id}`}><td><div className="table-product"><span className="biz-avatar">{b.nombre.charAt(0)}</span><span><b>{b.nombre}</b><small>clickok.co/{b.slug}</small></span></div></td><td>{data.users.find(u => u.id === b.owner_id)?.nombre || '—'}</td><td className="capitalize">{b.tipo}</td><td>{shortDate(b.created_at)}</td><td><Status value={b.estado} /></td><td><div className="table-actions">{b.estado !== 'activo' && <button className="approve-action" title="Aprobar / activar" onClick={() => changeBusiness(b, 'activo')} data-testid={`button-approve-${b.id}`}><Check size={16} /></button>}{b.estado === 'activo' ? <button title="Suspender" onClick={() => changeBusiness(b, 'suspendido')}><X size={15} /></button> : b.estado !== 'rechazado' && <button title="Rechazar" onClick={() => changeBusiness(b, 'rechazado')}><Trash2 size={15} /></button>}{b.estado === 'suspendido' && <button title="Activar" onClick={() => changeBusiness(b, 'activo')}><Zap size={15} /></button>}</div></td></tr>)}</DataTable> : <Empty title="No encontramos comercios" text="Prueba con otro estado o término de búsqueda." />}
      {modal && <FormModal {...modal} close={() => setModal(null)} submit={modal.save} submitText="Crear comercio" />}
    </>;
  }
  if (path === '/admin/users') return <><PageTitle eyebrow="PERSONAS DETRÁS DE CADA TIENDA" title="Usuarios" description="Administradores y propietarios registrados en la plataforma." /><div className="toolbar"><label className="search-field"><Search size={17} /><input placeholder="Buscar por nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} /></label><span className="toolbar-count">{data.users.filter(u => `${u.nombre} ${u.email}`.toLowerCase().includes(search.toLowerCase())).length} usuarios</span></div><DataTable headers={['Usuario', 'Correo', 'Rol', 'Comercio asociado', 'Estado']}>{data.users.filter(u => `${u.nombre} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map(u => { const b = data.businesses.find(x => x.owner_id === u.id); return <tr key={u.id}><td><div className="table-product"><span className="customer-avatar">{u.nombre.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><b>{u.nombre}</b></div></td><td>{u.email}</td><td><span className="role-tag">{u.role === 'admin' ? 'Administrador' : 'Propietario'}</span></td><td>{b?.nombre || 'Plataforma'}</td><td>{b ? <Status value={b.estado} /> : <Status value="activo" />}</td></tr>; })}</DataTable></>;
  if (path === '/admin/plans') return <><PageTitle eyebrow="OFERTA COMERCIAL" title="Planes" description="Define lo que incluye cada nivel de CLICKOK." action={<Button onClick={() => createPlan()}><Plus size={16} /> Crear plan</Button>} /><div className="admin-plans-grid">{data.plans.map(p => <article key={p.id} className={`admin-plan ${!p.activo ? 'plan-paused' : ''}`}><div className="admin-plan-head"><span className="eyebrow">{p.activo ? 'DISPONIBLE' : 'PAUSADO'}</span><button className="icon-btn" onClick={() => createPlan(p)} aria-label={`Editar plan ${p.nombre}`}><Pencil size={16} /></button></div><h2>{p.nombre}</h2><b className="admin-plan-price">{money(p.precio)}<small> / mes</small></b><p>{p.max_productos >= 999999 ? 'Productos ilimitados' : `Hasta ${p.max_productos} productos`}</p><ul>{p.funciones.map(f => <li key={f}><Check size={14} /> {f}</li>)}</ul><div className="admin-plan-footer"><span>{data.subscriptions.filter(s => s.plan_id === p.id).length} suscripciones</span><button className="text-link" onClick={() => update(d => ({ ...d, plans: d.plans.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x) }), p.activo ? 'Plan pausado' : 'Plan activado', p.nombre)}>{p.activo ? 'Pausar plan' : 'Activar plan'}</button><button className="text-link" disabled={data.plans.length <= 1} onClick={() => deletePlan(p)}>Eliminar</button></div></article>)}</div>{modal && <FormModal {...modal} close={() => setModal(null)} submit={modal.save} />}</>;
  if (path === '/admin/subscriptions') return <>
    <PageTitle eyebrow="SEGUIMIENTO DE PLANES" title="Suscripciones" description="Actualiza el plan y el estado asociado a cada comercio." />
    <DataTable headers={['Comercio', 'Plan asignado', 'Inicio', 'Vencimiento', 'Estado', 'Cambiar estado']}>
      {data.subscriptions.map(subscription => {
        const business = data.businesses.find(item => item.id === subscription.business_id);
        const currentPlan = data.plans.find(item => item.id === subscription.plan_id);
        return <tr key={subscription.id} data-testid={`row-subscription-${subscription.id}`}>
          <td><b>{business?.nombre || 'Comercio'}</b></td>
          <td><select className="inline-select" value={subscription.plan_id} onChange={e => update(d => ({ ...d, subscriptions: d.subscriptions.map(item => item.id === subscription.id ? { ...item, plan_id: e.target.value } : item) }), `Plan cambiado a ${data.plans.find(item => item.id === e.target.value)?.nombre || 'nuevo plan'}`, business?.nombre || 'Comercio')} data-testid={`select-subscription-plan-${subscription.id}`}>{data.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.nombre} · {money(plan.precio)}</option>)}</select><small className="old-price">Actual: {currentPlan?.nombre || 'Sin plan'}</small></td>
          <td>{shortDate(subscription.inicio)}</td><td>{shortDate(subscription.vencimiento)}</td><td><Status value={subscription.estado} /></td>
          <td><select className="inline-select" value={subscription.estado} onChange={e => update(d => ({ ...d, subscriptions: d.subscriptions.map(item => item.id === subscription.id ? { ...item, estado: e.target.value } : item) }), 'Estado de suscripción actualizado', business?.nombre || 'Comercio')} data-testid={`select-subscription-status-${subscription.id}`}><option value="activa">Activa</option><option value="pendiente">Pendiente</option><option value="vencida">Vencida</option><option value="cancelada">Cancelada</option></select></td>
        </tr>;
      })}
    </DataTable>
  </>;
  if (path === '/admin/settings') return <><PageTitle eyebrow="IDENTIDAD Y REGLAS DE LA PLATAFORMA" title="Ajustes de CLICKOK" description="Configura el comportamiento de los nuevos registros." /><div className="settings-grid"><section className="panel setting-section"><span className="eyebrow">PLATAFORMA</span><h2>Un nombre que se recuerda</h2><div className="form-stack"><SettingInput label="Nombre de la plataforma" value={data.platform.name} id="platform-name" onSave={v => update(d => ({ ...d, platform: { ...d.platform, name: v } }), 'Nombre de plataforma actualizado', 'Ajustes')} /><label className="field"><span>Aprobación de comercios</span><select value={data.platform.approval} onChange={e => update(d => ({ ...d, platform: { ...d.platform, approval: e.target.value as 'automatica' | 'manual' } }), 'Modo de aprobación actualizado', 'Ajustes')} data-testid="select-approval-mode"><option value="automatica">Automática</option><option value="manual">Manual</option></select></label><label className="field"><span>Plan por defecto al registrarse</span><select value={data.platform.default_plan} onChange={e => update(d => ({ ...d, platform: { ...d.platform, default_plan: e.target.value } }), 'Plan predeterminado actualizado', 'Ajustes')}>{data.plans.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label></div></section><section className="panel setting-section"><span className="eyebrow">RESTABLECER</span><h2>Volver al inicio</h2><p className="subtle">Restaura los cinco comercios de ejemplo y elimina los cambios hechos en esta sesión local.</p><Button kind="outline" onClick={() => { if (confirm('¿Restablecer la demo? Esta acción elimina todos los cambios locales.')) { localStorage.removeItem('menuya-demo-v1'); localStorage.removeItem('menuya-session'); location.reload(); } }} testId="button-reset-demo-settings"><Activity size={15} /> Restablecer demo</Button><div className="settings-info"><ShieldCheck size={17} /><p>La sesión de administrador usa credenciales públicas de demostración: admin@menuya.com / MenuyaDemo2026!</p></div></section></div></>;
  if (path === '/admin/audit') return <><PageTitle eyebrow="TRAZABILIDAD LOCAL" title="Auditoría" description="Registro de acciones realizadas en esta demo." /><DataTable headers={['Fecha', 'Actor', 'Acción', 'Entidad']}>{data.audit.map(a => <tr key={a.id}><td>{new Date(a.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{a.actor}</td><td><b>{a.accion}</b></td><td>{a.entidad}</td></tr>)}</DataTable><p className="fine-print">El registro se guarda localmente y no constituye una bitácora de seguridad de producción.</p></>;
  return <Empty title="No encontramos esa sección" text="Usa la navegación para volver a CLICKOK." />;
}

function PublicStore({ data, slug, update }: { data: DemoData; slug: string; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todos');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartChoices, setCartChoices] = useState<Record<string, { variante?: ProductChoice; complementos: ProductChoice[] }>>({});
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState('');
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [delivery, setDelivery] = useState<'domicilio' | 'recoger'>('domicilio');
  const [success, setSuccess] = useState(false);
  const [trackingToken, setTrackingToken] = useState('');
  const [error, setError] = useState('');
  const business = data.businesses.find(b => b.slug === slug);
  useEffect(() => {
    const store = data.businesses.find(item => item.slug === slug);
    if (!store) return;
    void supabase.from('catalog_events').insert({ business_id: store.id, event_type: 'visit' }).then(({ error }) => { if (error) console.warn('No se pudo registrar la visita del catálogo:', error.message); });
  }, [slug]);
  if (!business) return <NotFound />;
  const settings = data.settings.find(s => s.business_id === business.id);
  const cats = data.categories.filter(c => c.business_id === business.id && c.activo).sort((a, b) => a.orden - b.orden);
  const products = data.products.filter(p => p.business_id === business.id && p.activo && p.disponible && (category === 'todos' || p.category_id === category) && `${p.nombre} ${p.descripcion}`.toLowerCase().includes(search.toLowerCase()));
  const cartItems = Object.entries(cart).map(([id, cantidad]) => ({ p: data.products.find(p => p.id === id)!, cantidad, variante: cartChoices[id]?.variante, complementos: cartChoices[id]?.complementos || [] })).filter(x => x.p);
  const itemUnitPrice = (item: (typeof cartItems)[number]) => item.p.precio + (item.variante?.precio_extra || 0) + item.complementos.reduce((sum, choice) => sum + choice.precio_extra, 0);
  const subtotal = cartItems.reduce((a, x) => a + itemUnitPrice(x) * x.cantidad, 0);
  const openProduct = (product: Product) => {
    void supabase.from('catalog_events').insert({ business_id: business.id, product_id: product.id, event_type: 'inquiry' }).then(({ error }) => { if (error) console.warn('No se pudo registrar la consulta del producto:', error.message); });
    setConfiguring(product);
    setVariantId(product.variantes?.[0]?.id || '');
    setAddonIds([]);
  };
  const addItem = (product: Product) => {
    if (checkout) {
      setCart(current => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
      return;
    }
    openProduct(product);
  };
  const confirmConfiguredItem = (product: Product) => {
    const variant = product.variantes?.find(choice => choice.id === variantId);
    const complementos = (product.complementos || []).filter(choice => addonIds.includes(choice.id));
    setCart(current => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
    setCartChoices(current => ({ ...current, [product.id]: { variante: variant, complementos } }));
    setConfiguring(null);
  };
  const setQty = (id: string, amount: number) => setCart(c => { const next = { ...c }; if (amount <= 0) delete next[id]; else next[id] = amount; return next; });
  const submitOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const form = new FormData(e.currentTarget);
    const nombre = String(form.get('nombre') || '').trim(), telefono = String(form.get('telefono') || '').trim();
    const entrega = String(form.get('entrega') || 'domicilio') as 'domicilio' | 'recoger';
    const direccion = String(form.get('direccion') || '').trim();
    if (!nombre || !telefono || (entrega === 'domicilio' && !direccion)) { setError('Completa tu nombre, teléfono y dirección para el domicilio.'); return; }
    if (!cartItems.length) { setError('Agrega al menos un producto al pedido.'); return; }
    try {
      const { data: created, error: createError } = await supabase.functions.invoke('create-store-order', {
        body: {
          business_id: business.id,
          customer: { name: nombre, phone: telefono },
          fulfillment_type: entrega === 'domicilio' ? 'delivery' : 'pickup',
          delivery_address: entrega === 'domicilio' ? direccion : null,
          notes: String(form.get('observaciones') || '').trim(),
          payment_method: String(form.get('metodo_pago') || 'Efectivo'),
          items: cartItems.map(x => ({
            product_id: x.p.id,
            quantity: x.cantidad,
            variant_value_id: x.variante?.id || null,
            addon_value_ids: x.complementos.map(choice => choice.id)
          }))
        }
      });
      if (createError) throw createError;
      if (!created?.order) throw new Error('El servidor no confirmó el registro del pedido.');
      const order = created.order as Order;
      setTrackingToken(String((created.order as Order & { tracking_token?: string }).tracking_token || ''));
      update(d => ({
        ...d,
        customers: d.customers.some(customer => customer.telefono === telefono && customer.business_id === business.id)
          ? d.customers.map(customer => customer.telefono === telefono && customer.business_id === business.id
            ? { ...customer, total_pedidos: customer.total_pedidos + 1, total_compras: customer.total_compras + order.total, ultimo_pedido: order.created_at }
            : customer)
          : [...d.customers, { id: order.customer_id || repository.id(), business_id: business.id, nombre, telefono, total_pedidos: 1, total_compras: order.total, ultimo_pedido: order.created_at }],
        orders: [order, ...d.orders.filter(existing => existing.id !== order.id)]
      }), `Pedido #${String(order.numero).padStart(3, '0')} recibido`, business.nombre);
      setCart({}); setCartChoices({}); setCheckout(false); setSuccess(true);
    } catch (err) {
      console.error('CLICKOK: error registrando pedido de vitrina', err);
      setError(err instanceof Error ? err.message : 'No fue posible registrar el pedido. Intenta nuevamente.');
    }
  };
  if (business.estado !== 'activo' || !settings?.publicado) return <div className="store-unavailable"><Brand /><div><span className="eyebrow">VITRINA NO DISPONIBLE</span><h1>Esta tienda está en pausa.</h1><p>Vuelve a visitarla más adelante.</p><Link href="/" className="btn btn-outline">Conocer CLICKOK</Link></div><small>CLICKOK · Catálogos digitales y pedidos</small></div>;
  return <div className={`public-store public-layout-${settings.layout} public-cards-${settings.card_style} public-buttons-${settings.button_style}`} style={{ '--store-color': settings.color, fontFamily: settings.fuente==='Georgia'?'Georgia,serif':settings.fuente==='Arial'?'Arial,sans-serif':settings.fuente==='DM Sans'?'DM Sans,sans-serif':'Manrope,sans-serif' } as React.CSSProperties}><header className="public-header"><Brand /><div className="public-header-actions"><Link href="/track" className="public-track-link">Rastrear mi pedido</Link><span className="public-powered">UNA TIENDA DE <b>CLICKOK</b></span></div></header><section className="public-hero"><div className="public-cover" style={settings.portada ? { backgroundImage: `linear-gradient(90deg,rgba(22,49,43,.56),rgba(22,49,43,.05)),url("${settings.portada}")` } : undefined}><span className="cover-kicker">CATÁLOGO DIGITAL</span><span className="cover-shop-name">{business.nombre}</span></div><div className="public-store-intro"><div className="public-logo">{settings.logo ? <img src={settings.logo} alt={`Logo de ${business.nombre}`} /> : business.nombre.charAt(0)}</div><div><h1>{business.nombre}</h1><p>{settings.tagline || 'Una tienda local que te atiende de cerca.'}</p></div><span className="open-label"><i /> Abierto</span></div><div className="public-contact"><span>{business.tipo}</span><span>·</span><span>{settings.contacto || business.telefono}</span><span>·</span><span>{settings.entrega}</span></div></section><main className="public-main"><div className="public-toolbar"><label className="search-field"><Search size={17} /><input placeholder="Busca algo que te guste..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-store-search" /></label>{cartItems.length > 0 && <button className="cart-button" onClick={() => setCheckout(true)} data-testid="button-open-cart"><ShoppingCart size={17} /><span>{Object.values(cart).reduce((a, n) => a + n, 0)}</span>{money(subtotal)}</button>}</div><div className="public-categories"><button className={category === 'todos' ? 'category-active' : ''} onClick={() => setCategory('todos')}>Todo el catálogo</button>{cats.map(c => <button key={c.id} className={category === c.id ? 'category-active' : ''} onClick={() => setCategory(c.id)}>{c.nombre}</button>)}</div><div className="public-section-title"><span className="eyebrow">{category === 'todos' ? 'HECHO PARA TI' : cats.find(c => c.id === category)?.nombre}</span><h2>{search ? 'Resultados' : category === 'todos' ? 'Lo que se te antoje.' : 'Escoge tu favorito.'}</h2></div>{products.length ? <div className={`public-products public-products-${settings.layout}`}>{products.map((p, i) => <article className={`public-product public-product-${settings.card_style}`} key={p.id} data-testid={`card-store-product-${p.id}`}><div className={`public-product-art public-art-${i % 5}`}>{p.imagen ? <img className="public-product-image" src={p.imagen} alt={p.nombre} loading="lazy"/> : <b className="public-product-placeholder">{p.nombre.slice(0, 1)}</b>}<span>{p.destacado ? 'DESTACADO' : cats.find(c => c.id === p.category_id)?.nombre}</span><button onClick={() => addItem(p)} aria-label={`Agregar ${p.nombre}`} data-testid={`button-add-${p.id}`}><Plus size={19} /></button></div><div className="public-product-info"><div><h3>{p.nombre}</h3><p>{p.descripcion}</p><b>{money(p.precio)}</b>{p.precio_anterior && <del>{money(p.precio_anterior)}</del>}</div>{cart[p.id] ? <div className="quantity-control"><button onClick={() => setQty(p.id, cart[p.id] - 1)} aria-label="Quitar uno">−</button><b>{cart[p.id]}</b><button onClick={() => addItem(p)} aria-label="Agregar uno más">+</button></div> : <button className="add-mobile" onClick={() => addItem(p)}>Agregar <Plus size={14} /></button>}</div></article>)}</div> : <Empty title="No encontramos eso" text="Prueba con otra palabra o categoría." />}
    </main><footer className="public-footer"><span>{settings.redes}</span><span>Pedidos directos, cerca de ti.</span><Brand /></footer>
    {success && <div className="modal-backdrop"><section className="success-modal"><div className="success-icon"><Check size={24} /></div><span className="eyebrow">PEDIDO ENVIADO</span><h2>¡Ya lo tenemos!</h2><p>Tu pedido <b>#{String(Math.max(0, ...data.orders.filter(o => o.business_id === business.id).map(o => o.numero))).padStart(3, '0')}</b> se envió a {business.nombre}. Puedes consultar sus cambios de estado desde aquí.</p>{trackingToken && <div className="tracking-success-actions"><Link className="btn btn-solid" href={`/track/${trackingToken}`}>Rastrear mi pedido <ArrowRight size={15} /></Link><a className="btn btn-outline" href={`https://wa.me/?text=${encodeURIComponent(`Sigue tu pedido en ${business.nombre}: ${window.location.origin}/track/${trackingToken}`)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a></div>}<Button kind="ghost" onClick={() => setSuccess(false)}>Seguir mirando <ArrowRight size={15} /></Button></section></div>}
    {configuring && <Modal title={`Personaliza ${configuring.nombre}`} close={() => setConfiguring(null)}>
      <div className="product-config">
        <p className="subtle">{configuring.descripcion}</p>
        {!!configuring.variantes?.length && <label className="field"><span>Elige una variante</span><select value={variantId} onChange={e => setVariantId(e.target.value)} data-testid="select-product-variant">{configuring.variantes.map(choice => <option key={choice.id} value={choice.id}>{choice.nombre}{choice.precio_extra ? ` · +${money(choice.precio_extra)}` : ''}</option>)}</select></label>}
        {!!configuring.complementos?.length && <fieldset className="choice-list"><legend>Complementos</legend>{configuring.complementos.map(choice => <label key={choice.id}><input type="checkbox" checked={addonIds.includes(choice.id)} onChange={e => setAddonIds(current => e.target.checked ? [...current, choice.id] : current.filter(id => id !== choice.id))} data-testid={`checkbox-addon-${choice.id}`} /><span>{choice.nombre}</span><b>{choice.precio_extra ? `+${money(choice.precio_extra)}` : 'Incluido'}</b></label>)}</fieldset>}
        {!configuring.variantes?.length && !configuring.complementos?.length && <div className="notice notice-info">Este producto no tiene opciones adicionales.</div>}
        <div className="checkout-total"><span>Precio unitario</span><b>{money(configuring.precio + (configuring.variantes?.find(choice => choice.id === variantId)?.precio_extra || 0) + (configuring.complementos || []).filter(choice => addonIds.includes(choice.id)).reduce((sum, choice) => sum + choice.precio_extra, 0))}</b></div>
        <div className="modal-actions"><Button kind="ghost" onClick={() => setConfiguring(null)}>Cancelar</Button><Button onClick={() => confirmConfiguredItem(configuring)} data-testid="button-add-configured-product">Agregar al carrito <Plus size={15} /></Button></div>
      </div>
    </Modal>}
    {checkout && <Modal title="Tu pedido" close={() => setCheckout(false)}><form className="checkout-form" onSubmit={submitOrder}>
      <div className="checkout-items">{cartItems.map(x => <div key={x.p.id}><span><b>{x.cantidad} × {x.p.nombre}</b><small>{[x.variante?.nombre, ...x.complementos.map(choice => `+ ${choice.nombre}`)].filter(Boolean).join(' · ') || 'Sin opciones'} · {money(itemUnitPrice(x))} c/u</small></span><div className="quantity-control"><button type="button" onClick={() => setQty(x.p.id, x.cantidad - 1)}>−</button><b>{x.cantidad}</b><button type="button" onClick={() => addItem(x.p)}>+</button></div><strong>{money(itemUnitPrice(x) * x.cantidad)}</strong></div>)}</div>
      <div className="checkout-total"><span>Total</span><b>{money(subtotal)}</b></div>{error && <div className="notice notice-error">{error}</div>}
      <div className="form-grid">
        <label className="field"><span>Tu nombre *</span><input required name="nombre" autoComplete="name" data-testid="input-checkout-name" /></label>
        <label className="field"><span>Teléfono *</span><input required name="telefono" type="tel" autoComplete="tel" data-testid="input-checkout-phone" /></label>
        <label className="field"><span>¿Cómo lo recibes?</span><select name="entrega" value={delivery} onChange={e => setDelivery(e.target.value as 'domicilio' | 'recoger')} data-testid="select-checkout-delivery"><option value="domicilio">Domicilio</option><option value="recoger">Recoger en tienda</option></select></label>
        <label className="field"><span>Dirección{delivery === 'domicilio' ? ' *' : ' (opcional)'}</span><input required={delivery === 'domicilio'} name="direccion" placeholder={delivery === 'domicilio' ? 'Calle, carrera, barrio...' : 'No se requiere para recoger'} data-testid="input-checkout-address" /></label>
        <label className="field"><span>Método de pago</span><select name="metodo_pago" data-testid="select-checkout-payment">{settings.pagos.split(',').map(x => <option key={x}>{x.trim()}</option>)}</select></label>
        <label className="field"><span>Observaciones</span><textarea name="observaciones" placeholder="¿Alguna indicación para tu pedido?" data-testid="input-checkout-notes" /></label>
      </div>
      <p className="fine-print">No necesitas crear una cuenta. {business.nombre} confirmará contigo los detalles de pago y entrega.</p>
      <div className="modal-actions"><Button kind="ghost" onClick={() => setCheckout(false)}>Seguir mirando</Button><Button type="submit" testId="button-submit-order">Confirmar pedido · {money(subtotal)} <ArrowRight size={15} /></Button></div>
    </form></Modal>}
  </div>;
}

type PlatformBusinessRow = { id: string; name: string; slug: string; business_type: string; status: string; is_published: boolean; created_at: string; email: string | null; phone: string | null };

function PlatformAdminLogin({ onLogin }: { onLogin: (email: string, password: string) => Promise<string | null> }) {
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string,string>;
    setBusy(true); setError('');
    try { const message = await onLogin(values.email, values.password); if (message) setError(message); else setLocation('/admin'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.'); }
    finally { setBusy(false); }
  };
  return <main className="sa-login">
    <div className="sa-login-brand"><img src="/brand-clickok-dark.svg" alt="CLICKOK" style={{width:188,height:'auto',display:'block'}} /><span className="sr-only">CLICKOK CONTROL CENTER</span></div>
    <section className="sa-login-card">
      <div className="sa-login-icon"><ShieldCheck size={25}/></div>
      <span className="sa-kicker">ÁREA RESTRINGIDA · ATOM LABS</span>
      <h1>Administración<br/><em>de plataforma.</em></h1>
      <p>Ingresa con tus credenciales autorizadas para gestionar CLICKOK.</p>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <label className="sa-field"><span>Correo administrador</span><input name="email" type="email" autoComplete="username" placeholder="Correo autorizado" required/></label>
        <label className="sa-field"><span>Contraseña</span><div className="sa-password"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label="Mostrar contraseña">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        <button className="sa-submit" type="submit" disabled={busy}>{busy ? 'Verificando acceso…' : 'Entrar al panel'} <ArrowRight size={17}/></button>
      </form>
      <div className="sa-login-recovery"><a href="/forgot-password">¿Olvidaste tu contraseña? Recuperar acceso</a></div>
      <div className="sa-login-secure"><ShieldCheck size={14}/> Acceso verificado por Supabase · Solo personal autorizado</div>
    </section>
    <footer className="sa-login-footer">MENUYA <span>•</span> ATOM LABS <span>•</span> ADMINISTRACIÓN SEGURA</footer>
  </main>;
}

function PlatformAdminPage({ context, onLogout }: { context: MenuyaAuthContext; onLogout: () => void }) { return <PlatformAdminCenter context={context} onLogout={onLogout} />; }

function MerchantDashboardSkeleton() {
  return <div className="merchant-skeleton" aria-label="Cargando panel del negocio" role="status">
    <aside className="merchant-skeleton-side">
      <div className="ms-brand"><i/><b/></div>
      <div className="ms-side-label"/>
      {Array.from({length:7},(_,i)=><div className={`ms-nav ${i===0?'active':''}`} key={i}><i/><span/></div>)}
      <div className="ms-side-bottom"><i/><span/></div>
    </aside>
    <main className="merchant-skeleton-main">
      <header className="ms-topbar"><div><i/><b/></div><div className="ms-user"><i/><span/></div></header>
      <section className="ms-heading"><div className="ms-line wide"/><div className="ms-line medium"/></section>
      <section className="ms-stats">{Array.from({length:4},(_,i)=><div className="ms-card stat" key={i}><i/><b/><span/></div>)}</section>
      <section className="ms-content-grid"><div className="ms-card ms-chart"><div className="ms-card-head"><b/><i/></div><div className="ms-chart-bars">{Array.from({length:9},(_,i)=><i key={i}/>)}</div></div><div className="ms-card ms-activity"><div className="ms-card-head"><b/></div>{Array.from({length:4},(_,i)=><div className="ms-activity-row" key={i}><i/><span/><b/></div>)}</div></section>
      <div className="ms-card ms-table"><div className="ms-card-head"><b/><i/></div>{Array.from({length:4},(_,i)=><div className="ms-table-row" key={i}><i/><span/><span/><b/></div>)}</div>
    </main>
  </div>;
}

function RemoteAccessGate({ context, onLogout }: { context: MenuyaAuthContext; onLogout: () => void }) {
  const membership = context.memberships[0];
  const business = membership?.businesses ?? undefined;
  const [location] = useLocation();
  const [remoteData, setRemoteData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingError, setSavingError] = useState('');
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const loadRemoteData = async () => {
    if (!business?.id) return;
    setLoading(true); setLoadError('');
    const [categoryResult, productResult, settingsResult, subscriptionResult, planResult, orderResult, customerResult, catalogEventResult] = await Promise.all([
      supabase.from('categories').select('id,business_id,name,sort_order,is_active').eq('business_id',business.id).order('sort_order'),
      supabase.from('products').select('id,business_id,category_id,name,description,price,previous_price,image_url,is_active,is_available,is_featured,stock').eq('business_id',business.id).order('created_at',{ascending:false}),
      supabase.from('store_settings').select('business_id,cover_url,logo_url,brand_color,font_family,contact_text,social_links,payment_methods,delivery_info,is_published,tagline,storefront_layout,product_card_style,button_style').eq('business_id',business.id).maybeSingle(),
      supabase.from('subscriptions').select('id,business_id,plan_id,status,starts_at,ends_at,plans(id,name,price,billing_period,max_products,features,is_active)').eq('business_id',business.id).maybeSingle(),
      supabase.from('plans').select('id,code,name,price,billing_period,max_products,features,is_active').eq('is_active',true).order('price'),
      supabase.from('orders').select('id,business_id,customer_id,order_number,status,fulfillment_type,delivery_address,notes,payment_method,total,created_at,order_items!order_items_order_id_fkey(product_id,product_name,unit_price,quantity,variant_name,addons_snapshot)').eq('business_id',business.id).order('created_at',{ascending:false}),
      supabase.from('customers').select('id,business_id,name,phone,total_orders,total_spent,last_order_at').eq('business_id',business.id).order('last_order_at',{ascending:false}),
      supabase.from('catalog_events').select('id,business_id,product_id,event_type,created_at').eq('business_id',business.id).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).order('created_at',{ascending:false}),
    ]);
    const firstError = categoryResult.error || productResult.error || settingsResult.error || subscriptionResult.error || planResult.error || orderResult.error || customerResult.error || catalogEventResult.error;
    if (firstError) { setLoadError(firstError.message); setLoading(false); return; }
    const profileName = context.profile?.full_name || String(context.user.user_metadata?.full_name || context.user.email || 'Comercio');
    const biz = {
      id: business.id, owner_id: context.user.id, nombre: business.name, slug: business.slug,
      tipo: business.business_type, telefono: context.profile?.phone || '', estado: ({pending:'pendiente',active:'activo',rejected:'rechazado',suspended:'suspendido'} as Record<string, Business['estado']>)[business.status] || 'pendiente',
      created_at: new Date().toISOString(),
    };
    const categories: Category[] = (categoryResult.data || []).map(c => ({id:c.id,business_id:c.business_id,nombre:c.name,orden:c.sort_order,activo:c.is_active}));
    const products: Product[] = (productResult.data || []).map(p => ({id:p.id,business_id:p.business_id,category_id:p.category_id || '',nombre:p.name,descripcion:p.description || '',precio:Number(p.price),precio_anterior:p.previous_price ? Number(p.previous_price) : undefined,imagen:p.image_url || undefined,activo:p.is_active,disponible:p.is_available,destacado:p.is_featured,stock:p.stock ?? 0,variantes:[],complementos:[]}));
    const s = settingsResult.data;
    const settings: StoreSettings = {
      business_id:business.id,portada:s?.cover_url || '',logo:s?.logo_url || '',color:s?.brand_color || '#7352e8',
      fuente:s?.font_family || 'Manrope',contacto:s?.contact_text || biz.telefono,redes:typeof s?.social_links === 'string' ? s.social_links : '',
      pagos:Array.isArray(s?.payment_methods) ? s.payment_methods.join(', ') : 'Efectivo, Nequi, transferencia',
      entrega:s?.delivery_info || 'Domicilio y recoger en tienda',publicado:Boolean(s?.is_published && business.is_published),tagline:s?.tagline || 'Tu negocio, en su propio lugar.',layout:s?.storefront_layout || 'grid',card_style:s?.product_card_style || 'classic',button_style:s?.button_style || 'rounded',
    };
    const sub = subscriptionResult.data as any;
    const planRow = sub?.plans;
    const plan: Plan = planRow ? {id:planRow.id,nombre:planRow.name,precio:Number(planRow.price),periodicidad:planRow.billing_period,max_productos:planRow.max_products,funciones:planRow.features || [],activo:planRow.is_active} : {id:'default',nombre:'Plan inicial',precio:0,periodicidad:'mes',max_productos:15,funciones:[],activo:true};
    const allPlans: Plan[] = (planResult.data || []).map(p => ({id:p.id,nombre:p.name,precio:Number(p.price),periodicidad:p.billing_period,max_productos:p.max_products,funciones:p.features || [],activo:p.is_active}));
    const data: DemoData = {
      users:[{id:context.user.id,nombre:profileName,email:context.user.email || '',password:'',role:'owner',business_ids:[business.id]}],
      businesses:[biz],categories,products,
      customers:(customerResult.data || []).map(c => ({id:c.id,business_id:c.business_id,nombre:c.name,telefono:c.phone || '',total_pedidos:c.total_orders || 0,total_compras:Number(c.total_spent || 0),ultimo_pedido:c.last_order_at || ''})),
      orders:(orderResult.data || []).map(o => ({
        id:o.id,business_id:o.business_id,numero:Number(o.order_number || 0),customer_id:o.customer_id,
        items:(o.order_items || []).map(item => ({product_id:item.product_id || '',nombre:item.product_name,precio:Number(item.unit_price || 0),cantidad:item.quantity, variante:item.variant_name || undefined,complementos:Array.isArray(item.addons_snapshot) ? item.addons_snapshot : []})),
        total:Number(o.total || 0),estado:({new:'pendiente',pending:'pendiente',confirmed:'confirmado',preparing:'preparando',ready:'listo',out_for_delivery:'en_camino',delivered:'entregado',cancelled:'cancelado'} as Record<string, OrderStatus>)[o.status] || 'pendiente',
        entrega:o.fulfillment_type === 'delivery' ? 'domicilio' : 'recoger',direccion:o.delivery_address || '',observaciones:o.notes || '',metodo_pago:o.payment_method || '—',created_at:o.created_at,
      })),
      plans:allPlans.length ? allPlans : [plan],
      subscriptions:sub ? [{id:sub.id,business_id:sub.business_id,plan_id:sub.plan_id,estado:sub.status,inicio:sub.starts_at || '',vencimiento:sub.ends_at || ''}] : [],
      settings:[settings],audit:[],catalog_events:(catalogEventResult.data || []).map(event => ({id:event.id,business_id:event.business_id,product_id:event.product_id || undefined,tipo:event.event_type === 'visit' ? 'visita' as const : 'consulta' as const,created_at:event.created_at})),platform:{name:'MENUYA',approval:'manual',default_plan:plan.id},
    };
    setRemoteData(data); setLoading(false);
  };
  useEffect(() => { void loadRemoteData(); }, [business?.id]);
  useEffect(() => {
    if (!business?.id) return;
    const channel = supabase.channel(`merchant-dashboard-${business.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${business.id}` }, () => { void loadRemoteData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${business.id}` }, () => { void loadRemoteData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${business.id}` }, () => { void loadRemoteData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [business?.id]);
  const updateRemote = (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => {
    if (!remoteData || !business?.id) return;
    const previous = remoteData;
    const next = fn(previous);
    setRemoteData(next);
    setSavingError('');
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const oldOrders = new Map(previous.orders.map(order => [order.id, order]));
        const nextOrders = new Map(next.orders.map(order => [order.id, order]));
        const statusToDatabase: Record<OrderStatus, string> = {
          pendiente: 'pending',
          confirmado: 'confirmed',
          preparando: 'preparing',
          listo: 'ready',
          en_camino: 'out_for_delivery',
          entregado: 'delivered',
          cancelado: 'cancelled',
        };
        for (const [id, order] of nextOrders) {
          const before = oldOrders.get(id);
          if (!before || before.estado === order.estado) continue;
          const result = await supabase.from('orders')
            .update({ status: statusToDatabase[order.estado], updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('business_id', business.id)
            .select('id,status')
            .maybeSingle();
          if (result.error) throw result.error;
          if (!result.data) throw new Error('No se pudo actualizar el pedido. Verifica los permisos de la cuenta del comercio.');
        }
        const oldCats = new Map(previous.categories.map(x=>[x.id,x]));
        const newCats = new Map(next.categories.map(x=>[x.id,x]));
        for (const [id, item] of newCats) {
          const before = oldCats.get(id);
          if (before === item) continue;
          const payload = {business_id:business.id,name:item.nombre,sort_order:item.orden,is_active:item.activo};
          const result = oldCats.has(id)
            ? await supabase.from('categories').update(payload).eq('id',id).eq('business_id',business.id)
            : await supabase.from('categories').insert(payload);
          if (result.error) throw result.error;
        }
        for (const id of oldCats.keys()) if (!newCats.has(id)) {
          const result=await supabase.from('categories').delete().eq('id',id).eq('business_id',business.id);
          if(result.error) throw result.error;
        }
        const oldProducts = new Map(previous.products.map(x=>[x.id,x]));
        const newProducts = new Map(next.products.map(x=>[x.id,x]));
        for (const [id, item] of newProducts) {
          const before = oldProducts.get(id);
          if (before === item) continue;
          const payload = {business_id:business.id,category_id:item.category_id || null,name:item.nombre,description:item.descripcion,price:item.precio,previous_price:item.precio_anterior ?? null,image_url:item.imagen ?? null,is_active:item.activo,is_available:item.disponible,is_featured:item.destacado,stock:item.stock ?? 0};
          const result = oldProducts.has(id)
            ? await supabase.from('products').update(payload).eq('id',id).eq('business_id',business.id)
            : await supabase.from('products').insert(payload);
          if(result.error) throw result.error;
        }
        for (const id of oldProducts.keys()) if (!newProducts.has(id)) {
          const result=await supabase.from('products').delete().eq('id',id).eq('business_id',business.id);
          if(result.error) throw result.error;
        }

        const oldSettings = previous.settings.find(x=>x.business_id===business.id);
        const nextSettings = next.settings.find(x=>x.business_id===business.id);
        if (nextSettings && JSON.stringify(oldSettings) !== JSON.stringify(nextSettings)) {
          const result = await supabase.from('store_settings').upsert({
            business_id:business.id,
            cover_url:nextSettings.portada || null,
            logo_url:nextSettings.logo || null,
            brand_color:nextSettings.color,
            font_family:nextSettings.fuente,
            contact_text:nextSettings.contacto || null,
            social_links:nextSettings.redes ?? '',
            payment_methods:nextSettings.pagos ? nextSettings.pagos.split(',').map(x=>x.trim()).filter(Boolean) : [],
            delivery_info:nextSettings.entrega || null,
            is_published:nextSettings.publicado,
            tagline:nextSettings.tagline || null,
            storefront_layout:nextSettings.layout,
            product_card_style:nextSettings.card_style,
            button_style:nextSettings.button_style,
          }, {onConflict:'business_id'});
          if (result.error) throw result.error;
          const businessUpdate = await supabase.from('businesses')
            .update({name:next.businesses.find(x=>x.id===business.id)?.nombre || business.name,is_published:nextSettings.publicado})
            .eq('id',business.id);
          if (businessUpdate.error) throw businessUpdate.error;
        } else {
          const oldBusiness = previous.businesses.find(x=>x.id===business.id);
          const nextBusiness = next.businesses.find(x=>x.id===business.id);
          if (oldBusiness && nextBusiness && oldBusiness.nombre !== nextBusiness.nombre) {
            const result = await supabase.from('businesses').update({name:nextBusiness.nombre}).eq('id',business.id);
            if (result.error) throw result.error;
          }
        }
        // No recargar tras cada guardado: una respuesta antigua podía sobrescribir cambios recientes.
      } catch (error) {
        const saveError = error && typeof error === 'object' ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } : null;
        const errorParts = [saveError?.message, saveError?.details, saveError?.hint]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
        const errorCode = typeof saveError?.code === 'string' ? ` [${saveError.code}]` : '';
        const message = errorParts.join(' · ') || (error instanceof Error ? error.message : 'No fue posible guardar los cambios en Supabase.');
        console.error('MENUYA: error guardando la vitrina en Supabase', error);
        setSavingError(message + errorCode);
        await loadRemoteData();
      }
    });
  };
  if (!business) return <div className="auth-layout"><main className="auth-main"><div className="auth-form-wrap"><h2>{context.isPlatformAdmin ? 'Acceso de plataforma' : 'Cuenta autenticada'}</h2><div className="notice notice-error">No encontramos un comercio vinculado a esta cuenta. No se crearán datos de demostración.</div><Button className="full-btn" onClick={onLogout}>Cerrar sesión <LogOut size={16}/></Button></div></main></div>;
  if (loading) return <MerchantDashboardSkeleton />;
  if (loadError || !remoteData) return <div className="auth-form-wrap"><div className="notice notice-error">{loadError || 'No fue posible cargar el comercio.'}</div><Button onClick={() => void loadRemoteData()}>Reintentar</Button></div>;
  const session: Session = {userId:context.user.id,role:'owner'};
  return <AppShell data={remoteData} session={session} update={updateRemote} logout={onLogout} business={remoteData.businesses[0]} activePath={location}>
    {savingError && <div className="notice notice-error" role="alert">{savingError}</div>}
    <MerchantPage path={location} data={remoteData} business={remoteData.businesses[0]} update={updateRemote} />
  </AppShell>;
}

function Router() {
  const [data, setData] = useState<DemoData>(() => repository.load());
  const [remoteContext, setRemoteContext] = useState<MenuyaAuthContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authInitError, setAuthInitError] = useState('');
  const [toast, setToast] = useState('');
  const [, setLocation] = useLocation();
  useEffect(() => { repository.save(data); }, [data]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return () => { mounted = false; };
    }
    getAuthContext()
      .then(async context => context ? (context.isPlatformAdmin ? context : ensureBusinessForCurrentUser()) : null)
      .then(context => { if (mounted) setRemoteContext(context); })
      .catch(error => { if (mounted) setAuthInitError(error instanceof Error ? error.message : 'No se pudo recuperar la sesión.'); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  const update = (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => {
    setData(current => {
      let next = fn(current);
      if (action) {
        const actor = 'Visitante';
        const audit: AuditLog = { id: repository.id(), actor, accion: action, entidad: entity || 'Demo', fecha: repository.date(0) };
        next = { ...next, audit: [audit, ...next.audit].slice(0, 300) };
        setToast(action);
      }
      return next;
    });
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'La conexión de MENUYA aún no está configurada en este entorno.';
    try {
      await signInWithEmail(email, password);
      const authContext = await getAuthContext();
      const context = authContext?.isPlatformAdmin ? authContext : await ensureBusinessForCurrentUser();
      setRemoteContext(context);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'No fue posible iniciar sesión.';
    }
  };

  const register = async (v: Record<string, string>): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'La conexión de MENUYA aún no está configurada en este entorno.';
    try {
      const result = await signUpWithEmail({
        email: v.email,
        password: v.password,
        fullName: v.nombre,
        phone: v.telefono,
        businessName: v.negocio,
        businessType: v.sector,
      });
      if (result.session) {
        const context = await ensureBusinessForCurrentUser();
        setRemoteContext(context);
        setLocation('/app');
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'No fue posible crear la cuenta.';
    }
  };

  const reset = async (password: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'La conexión de MENUYA aún no está configurada en este entorno.';
    try { await updatePassword(password); return null; }
    catch (error) { return error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.'; }
  };

  const forgot = async (email: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'La conexión de MENUYA aún no está configurada en este entorno.';
    try { await sendPasswordRecovery(email); return null; }
    catch (error) { return error instanceof Error ? error.message : 'No fue posible enviar las instrucciones.'; }
  };

  const logout = async () => {
    try { if (isSupabaseConfigured) await signOut(); } finally {
      setRemoteContext(null);

      setLocation('/login');
    }
  };

  const protectedRoute = () => authLoading
    ? <div className="auth-loading"><span className="loader-line" />Comprobando tu sesión...</div>
    : authInitError
      ? <div className="auth-form-wrap"><div className="notice notice-error">{authInitError}</div><Link href="/login" className="text-link">Volver al acceso</Link></div>
      : remoteContext
        ? <RemoteAccessGate context={remoteContext} onLogout={logout} />
        : <RedirectToLogin setLocation={setLocation} />;

  return <RoutedErrorBoundary><Switch>
    <Route path="/"><Landing data={data} /></Route>
    <Route path="/admin/login"><PlatformAdminLogin onLogin={login} /></Route>
    <Route path="/login"><AuthPage mode="login" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/register"><AuthPage mode="register" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/forgot-password"><AuthPage mode="forgot" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/reset-password"><AuthPage mode="reset" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/admin">{authLoading ? <div className="auth-loading"><span className="loader-line" />Comprobando acceso...</div> : remoteContext?.isPlatformAdmin ? <PlatformAdminPage context={remoteContext} onLogout={logout} /> : remoteContext ? <div className="auth-form-wrap"><div className="notice notice-error">Esta cuenta no tiene permisos de Superadmin.</div><Button onClick={logout}>Cerrar sesión</Button></div> : protectedRoute()}</Route>
    {adminLinks.slice(1).map(([path]) => <Route key={path} path={path}>{authLoading ? <div className="auth-loading"><span className="loader-line" />Comprobando acceso...</div> : remoteContext?.isPlatformAdmin ? <PlatformAdminPage context={remoteContext} onLogout={logout} /> : remoteContext ? <div className="auth-form-wrap"><div className="notice notice-error">Esta cuenta no tiene permisos de Superadmin.</div><Button onClick={logout}>Cerrar sesión</Button></div> : protectedRoute()}</Route>)}
    <Route path="/track"><TrackingPage /></Route>
    <Route path="/track/:token"><TrackingRoute /></Route>
    <Route path="/app">{protectedRoute()}</Route>
    {shopLinks.slice(1).map(([path]) => <Route key={path} path={path}>{protectedRoute()}</Route>)}
    <Route path="/:slug"><PublicRoute data={data} update={update} /></Route>
    <Route component={NotFound} />
  </Switch>{toast && <div className="toast-message" role="status" data-testid="status-toast"><CheckCircle2 size={17} />{toast}</div>}</RoutedErrorBoundary>;
}
function TrackingRoute() {
  const params = useParams<{ token: string }>();
  return <TrackingPage initialToken={params.token || ''} />;
}
function TrackingPage({ initialToken = '' }: { initialToken?: string }) {
  const [token, setToken] = useState(initialToken);
  const [order, setOrder] = useState<{ order_number: number; status: string; business_name: string; updated_at: string; created_at: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lookup = async (value: string) => {
    const clean = value.trim();
    if (!clean) { setError('Ingresa el enlace o código de seguimiento.'); return; }
    setLoading(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-order-tracking', { body: { token: clean } });
      if (invokeError) throw invokeError;
      if (!data?.order) throw new Error('No encontramos un pedido con ese código.');
      setOrder(data.order);
    } catch (e) {
      setOrder(null);
      setError(e instanceof Error ? e.message : 'No fue posible consultar el pedido.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!initialToken) return;
    setToken(initialToken);
    void lookup(initialToken);
    const timer = window.setInterval(() => { void lookup(initialToken); }, 12000);
    return () => window.clearInterval(timer);
  }, [initialToken]);
  const steps = [
    ['pending', 'Pedido recibido'], ['confirmed', 'Pedido confirmado'],
    ['preparing', 'En preparación'], ['ready', 'Listo para despacho'],
    ['out_for_delivery', 'En camino'], ['delivered', 'Entregado']
  ];
  const current = order ? steps.findIndex(([key]) => key === order.status) : -1;
  return <main className="tracking-page"><div className="tracking-card"><Brand /><span className="eyebrow">CLICKOK · SEGUIMIENTO</span><h1>Rastrea tu pedido</h1><p className="subtle">Consulta el estado actualizado de tu compra sin crear una cuenta.</p>
    {!initialToken && <form className="tracking-form" onSubmit={e => { e.preventDefault(); void lookup(token); }}><label className="field"><span>Código o enlace de seguimiento</span><input value={token} onChange={e => setToken(e.target.value)} placeholder="Pega aquí tu código" /></label><Button type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Consultar pedido'}</Button></form>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {order && <section className="tracking-result"><span className="eyebrow">{order.business_name}</span><h2>Pedido #{String(order.order_number).padStart(3, '0')}</h2>
      {order.status === 'cancelled' ? <div className="notice notice-error">Este pedido fue cancelado.</div> : <ol className="tracking-steps">{steps.map(([key,label],i) => <li key={key} className={i <= current ? 'tracking-step-done' : ''}><span className="tracking-step-dot">{i < current ? '✓' : i+1}</span><span>{label}</span></li>)}</ol>}
      <small>Última actualización: {new Date(order.updated_at || order.created_at).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}</small>
    </section>}
    <Link href="/" className="tracking-back">Volver a la tienda</Link>
  </div></main>;
}

function RedirectToLogin({ setLocation }: { setLocation: (path: string) => void }) {
  useEffect(() => { setLocation('/login'); }, [setLocation]);
  return <div className="auth-loading"><span className="loader-line" />Redirigiendo a tu acceso...</div>;
}
function PublicRoute({ data, update }: { data: DemoData; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || '';
  const [storeData, setStoreData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setLoadError('');
      try {
        const { data: businessRow, error: businessError } = await supabase
          .from('businesses')
          .select('id,name,slug,business_type,status,is_published')
          .eq('slug', slug).maybeSingle();
        if (businessError) throw businessError;
        if (!businessRow || !businessRow.is_published) {
          if (active) { setStoreData(null); setLoading(false); }
          return;
        }
        const [categoryResult, productResult, settingsResult] = await Promise.all([
          supabase.from('categories').select('id,business_id,name,sort_order,is_active').eq('business_id',businessRow.id).eq('is_active',true).order('sort_order'),
          supabase.from('products').select('id,business_id,category_id,name,description,price,previous_price,image_url,is_active,is_available,is_featured,stock').eq('business_id',businessRow.id).eq('is_active',true).eq('is_available',true).order('created_at',{ascending:false}),
          supabase.from('store_settings').select('business_id,cover_url,logo_url,brand_color,font_family,contact_text,social_links,payment_methods,delivery_info,is_published,tagline,storefront_layout,product_card_style,button_style').eq('business_id',businessRow.id).maybeSingle(),
        ]);
        const queryError = categoryResult.error || productResult.error || settingsResult.error;
        if (queryError) throw queryError;
        if (!settingsResult.data?.is_published) {
          if (active) { setStoreData(null); setLoading(false); }
          return;
        }
        const profile = {
          id:businessRow.id, owner_id:'', nombre:businessRow.name, slug:businessRow.slug,
          tipo:businessRow.business_type || 'Comercio', telefono:'', estado:businessRow.status === 'active' ? 'activo' as const : 'pendiente' as const,
          created_at:new Date().toISOString(),
        };
        const row = settingsResult.data;
        const settings = {
          business_id:businessRow.id, portada:row.cover_url || '', logo:row.logo_url || '',
          color:row.brand_color || '#252525', fuente:row.font_family || 'Manrope',
          contacto:row.contact_text || '', redes:typeof row.social_links === 'string' ? row.social_links : JSON.stringify(row.social_links || {}),
          pagos:Array.isArray(row.payment_methods) ? row.payment_methods.join(', ') : 'Efectivo',
          entrega:row.delivery_info || '', publicado:true, tagline:row.tagline || '',
          layout:row.storefront_layout || 'grid', card_style:row.product_card_style || 'classic', button_style:row.button_style || 'rounded',
        };
        const categories = (categoryResult.data || []).map(c=>({id:c.id,business_id:c.business_id,nombre:c.name,orden:c.sort_order,activo:c.is_active}));
        const products = (productResult.data || []).map(p=>({id:p.id,business_id:p.business_id,category_id:p.category_id || '',nombre:p.name,descripcion:p.description || '',precio:Number(p.price),precio_anterior:p.previous_price ? Number(p.previous_price) : undefined,imagen:p.image_url || undefined,activo:p.is_active,disponible:p.is_available,destacado:p.is_featured,stock:p.stock ?? 0,variantes:[],complementos:[]}));
        const remote: DemoData = {...data,users:[],businesses:[profile],categories,products,customers:[],orders:[],settings:[settings],subscriptions:[],audit:[],catalog_events:[]};
        if (active) { setStoreData(remote); setLoading(false); }
      } catch (error) {
        if (active) { setLoadError(error instanceof Error ? error.message : 'No fue posible cargar la tienda.'); setLoading(false); }
      }
    };
    if (slug && isSupabaseConfigured) void load();
    else { setLoadError('La tienda pública no está configurada.'); setLoading(false); }
    return () => { active = false; };
  }, [slug]);
  if (loading) return <div className="auth-loading"><span className="loader-line" />Cargando tienda...</div>;
  if (loadError) return <div className="store-unavailable"><Brand /><div><span className="eyebrow">NO PUDIMOS CARGAR LA TIENDA</span><h1>Intenta nuevamente.</h1><p>{loadError}</p><Link href="/" className="btn btn-outline">Volver al inicio</Link></div></div>;
  if (!storeData) return <NotFound />;
  return <PublicStore data={storeData} slug={slug} update={update} />;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
