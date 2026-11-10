import './menuya.css';
import './order-tracking.css';
import './team-portal-refresh.css';
import PlatformAdminCenter from '@/components/PlatformAdminCenter';
import PointOfSale from '@/components/pos/PointOfSale';
import PushNotificationsSettings from '@/components/PushNotificationsSettings';
import HelpCenter from '@/components/HelpCenter';
import LegalPages from '@/components/LegalPages';
import RestaurantOperations from '@/components/restaurant/RestaurantOperations';
import WaiterPortal from '@/components/restaurant/WaiterPortal';
import CourierManagement from '@/components/CourierManagement';
import CourierPortal from '@/components/CourierPortal';
import * as React from 'react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { BookOpen, Utensils, Activity, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, CreditCard, ExternalLink, Eye, EyeOff, HelpCircle, ImagePlus, LayoutDashboard, Loader2, LogOut, MapPin, Menu, MoreHorizontal, Package, PawPrint, CalendarDays, Pencil, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Store, Tag, Trash2, TrendingUp, Truck, Upload, Users, X, Zap } from 'lucide-react';
import { type AuditLog, type Business, type CatalogEvent, type Category, type Customer, type DemoData, type Order, type OrderStatus, type Plan, type Product, type ProductChoice, type StoreSettings, repository } from '@/lib/menuya-data';
import { type MenuyaAuthContext, ensureBusinessForCurrentUser, getAuthContext, isSupabaseConfigured, sendPasswordRecovery, preparePasswordRecovery, signInWithEmail, signOut, signUpWithEmail, updatePassword } from '@/lib/menuya-auth';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

const storefrontContrast = (hex: string) => {
  const clean = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#f7f7f5';
  const rgb = [1, 3, 5].map(i => parseInt(clean.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  const text = luminance > .42 ? '#20242b' : '#ffffff';
  const muted = luminance > .42 ? '#59616d' : '#e1e5eb';
  const accentText = (() => {
    const a = [1, 3, 5].map(i => parseInt((/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#7357d9').slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
    return .2126 * a[0] + .7152 * a[1] + .0722 * a[2] > .42 ? '#20242b' : '#ffffff';
  })();
  return { text, muted, accentText };
};
const parseStoreDelivery = (raw: string | null | undefined) => {
  const fallback = raw || 'Domicilio y recoger en tienda';
  try {
    const parsed = JSON.parse(fallback);
    if (parsed && typeof parsed === 'object') return {
      methods: typeof parsed.methods === 'string' ? parsed.methods : 'Domicilio y recoger en tienda',
      address: typeof parsed.address === 'string' ? parsed.address : '',
      time: typeof parsed.time === 'string' ? parsed.time : '',
    };
  } catch {}
  return { methods: fallback, address: '', time: '' };
};
const shortDate = (date: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(date));
const statusLabel: Record<string, string> = { pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'En preparación', listo: 'Listo', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado', activo: 'Activo', rechazado: 'Rechazado', suspendido: 'Suspendido', activa: 'Activa', vencida: 'Vencida' };
const productLimitLabel = (limit: number) => limit >= 999999 ? 'ilimitados' : String(limit);
const adminLinks = [['/admin', 'Resumen', LayoutDashboard], ['/admin/businesses', 'Comercios', Store], ['/admin/requests', 'Solicitudes', ClipboardList], ['/admin/users', 'Usuarios', Users], ['/admin/plans', 'Planes', Tag], ['/admin/subscriptions', 'Suscripciones', CreditCard], ['/admin/settings', 'Ajustes', Settings], ['/admin/audit', 'Auditoría', Activity]] as const;
const shopLinks = [['/app', 'Inicio', LayoutDashboard], ['/app/catalog', 'Catálogo', ShoppingBag], ['/app/products', 'Productos', Package], ['/app/categories', 'Categorías', Tag], ['/app/orders', 'Pedidos', ClipboardList], ['/app/couriers', 'Domiciliarios', Truck], ['/app/customers', 'Clientes', Users], ['/app/editor', 'CLICKOK Studio', Pencil], ['/app/analytics', 'Analítica', BarChart3], ['/app/help', 'Centro de ayuda', HelpCircle], ['/app/settings', 'Ajustes', Settings], ['/app/subscription', 'Mi plan', CreditCard]] as const;
type Session = { userId: string; role: 'admin' | 'owner' } | null;
type FormField = { name: string; label: string; type?: string; value?: string | number | boolean; options?: string[]; optionLabels?: Record<string, string>; required?: boolean };
type CartLine = { key: string; productId: string; cantidad: number; variantes?: { choice: ProductChoice; cantidad: number }[]; complementos: ProductChoice[] };
const choiceText = (choices: ProductChoice[] = []) => choices.map(choice => `${choice.nombre}|${choice.precio_extra}`).join('\n');
const isFoodBusiness = (type: string) => /restaurante|panader[ií]a|cafeter[ií]a|comida|reposter[ií]a|pasteler[ií]a|bar\b/i.test(type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
const optionLabelForBusiness = (type: string) => { const t=type.toLowerCase(); if(/ropa|calzado|zapater|moda/.test(t)) return 'Tallas y colores'; if(/tecnolog|electr[oó]nic|comput/.test(t)) return 'Modelos y especificaciones'; if(/barber|belleza|peluquer/.test(t)) return 'Servicios y modalidades'; return 'Variantes y opciones'; };
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
function ChoiceBuilderField({ field, onChange }: { field: FormField; onChange: (name: string, value: string) => void }) {
  const [rows, setRows] = useState(() => String(field.value || '').split('\n').filter(Boolean).map(line => { const [nombre, precio='0'] = line.split('|'); return { nombre, precio }; }));
  const sync = (next: { nombre: string; precio: string }[]) => { setRows(next); onChange(field.name, next.filter(x => x.nombre.trim()).map(x => `${x.nombre.trim()}|${x.precio || '0'}`).join('\n')); };
  return <section className="choice-builder"><div className="choice-builder-head"><div><b>{field.label}</b><small>Agrega cada opción sin escribir formatos especiales.</small></div><span>{rows.length} opciones</span></div>{rows.map((row,index)=><div className="choice-builder-row" key={index}><input aria-label="Nombre de la opción" placeholder="Ej. Queso extra" value={row.nombre} onChange={e=>sync(rows.map((x,i)=>i===index?{...x,nombre:e.target.value}:x))}/><label><span>$</span><input aria-label="Precio adicional" type="number" min="0" placeholder="0" value={row.precio} onChange={e=>sync(rows.map((x,i)=>i===index?{...x,precio:e.target.value}:x))}/></label><button type="button" aria-label="Eliminar opción" onClick={()=>sync(rows.filter((_,i)=>i!==index))}>×</button></div>)}<button className="choice-builder-add" type="button" onClick={()=>sync([...rows,{nombre:'',precio:'0'}])}>＋ Agregar opción</button></section>;
}
function Field({ field, onChange, businessId }: { field: FormField; onChange: (name: string, value: string | boolean) => void; businessId?: string }) {
  if (field.type === 'choiceBuilder') return <ChoiceBuilderField field={field} onChange={onChange as (name: string, value: string) => void}/>;
  if (field.type === 'image') return <ImageUploadField field={field} value={String(field.value ?? '')} businessId={businessId} onChange={onChange as (name: string, value: string) => void}/>;
  return <label className="field"><span>{field.label}{field.required ? ' *' : ''}</span>
      {field.options ? <select name={field.name} required={field.required} value={String(field.value ?? '')} onChange={e => onChange(field.name, e.target.value)} data-testid={`select-${field.name}`}>{field.options.map(o => <option key={o} value={o}>{field.optionLabels?.[o] || statusLabel[o] || o}</option>)}</select>
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
        {mode === 'register' && <><p className="fine-print">Tu comercio se crea inicialmente privado y pendiente de revisión. No se publicará automáticamente.</p><label className="legal-consent"><input type="checkbox" name="aceptaDatos" required/><span>He leído y acepto la <Link href="/legal/privacidad" target="_blank">Política de tratamiento de datos personales</Link> y los <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link>. Autorizo el tratamiento de mis datos para crear y administrar mi cuenta.</span></label></>}
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
    <div className="wompi-promo" role="note" aria-label="Nueva opción de pagos con Wompi"><div className="wompi-promo-mark" aria-hidden="true"><span className="wompi-promo-dot" /><span className="wompi-promo-dot" /><span className="wompi-promo-dot" /></div><p>Ahora puedes recibir pagos con <strong>Wompi</strong></p><img src="https://wompi.co/assets/downloadble/logos_wompi/Wompi_LogoPrincipal.svg" alt="Wompi" /></div>
    <section className="hero ck-hero stripe-hero" id="plataforma"><div className="stripe-gradient-art"/><div className="hero-copy ck-copy"><span className="eyebrow"><i className="eyebrow-dot"/> COMERCIO DIGITAL, SIN COMPLICACIONES</span><h1>Todo tu negocio.<br/><em>En un solo lugar.</em></h1><p>Crea tu vitrina digital, conecta con tus clientes y gestiona tus ventas desde una plataforma diseñada para hacer crecer tu negocio.</p><div className="hero-ctas"><Link href="/register" className="btn btn-solid btn-large">Crea tu espacio gratis <ArrowRight size={17}/></Link><a href="#soluciones" className="hero-secondary">Conoce la plataforma <ArrowRight size={15}/></a></div><div className="ck-proof"><i/> TU MARCA. TUS PRODUCTOS. TU NEGOCIO.</div></div>
    <div className="hero-art ck-stage stripe-stage"><div className="stripe-glow-orbit"/><div className="stripe-ui-window"><div className="stripe-window-bar"><span/><span/><span/><small>app.clickok.co / mi-tienda</small></div><div className="stripe-store-ui"><aside><b className="stripe-mini-logo">C<span>.</span></b><i/><i/><i/><i/></aside><main><div className="stripe-ui-top"><span>Resumen de tu tienda</span><b>Vista previa ↗</b></div><div className="stripe-ui-welcome"><small>BUENOS DÍAS, CAMILA</small><strong>Tu negocio está en marcha.</strong><span>Este es el resumen de tu actividad.</span></div><div className="stripe-ui-metrics"><div><small>Ventas del mes</small><b>$ 4.850.000</b><em>↗ Actividad reciente</em></div><div><small>Pedidos recibidos</small><b>128</b><em>↗ Nuevos pedidos</em></div></div><div className="stripe-ui-chart"><div><b>Actividad de ventas</b><span>Últimos 7 días</span></div><svg viewBox="0 0 420 105" role="img" aria-label="Gráfico ilustrativo de ventas"><defs><linearGradient id="ckChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#635bff" stopOpacity=".25"/><stop offset="1" stopColor="#635bff" stopOpacity="0"/></linearGradient></defs><path d="M0 82 C35 76 42 53 78 61 S125 84 158 51 S211 58 244 35 S300 52 330 23 S383 37 420 8 L420 105 L0 105Z" fill="url(#ckChart)"/><path d="M0 82 C35 76 42 53 78 61 S125 84 158 51 S211 58 244 35 S300 52 330 23 S383 37 420 8" fill="none" stroke="#635bff" strokeWidth="3" strokeLinecap="round"/></svg></div></main></div></div><div className="stripe-floating-order"><span><CheckCircle2 size={16}/></span><div><small>NUEVO PEDIDO</small><b>Pedido confirmado</b></div><strong>$ 89.000</strong></div><div className="stripe-floating-pill">● TIENDA PUBLICADA</div></div></section>
    <section className="studio-feature-landing" id="clickok-studio"><div className="studio-feature-copy"><span className="eyebrow">06 / DISEÑO A TU MEDIDA</span><h2>Tu vitrina.<br/><em>Tu estilo. Tus reglas.</em></h2><p>Con CLICKOK Studio diseña la apariencia de tu tienda sin complicaciones. Elige una plantilla, ajusta los colores, personaliza tu identidad y visualiza los cambios antes de publicar.</p><ul><li><CheckCircle2 size={16}/> 7 plantillas prediseñadas para empezar</li><li><CheckCircle2 size={16}/> Colores, tipografías y estilos personalizables</li><li><CheckCircle2 size={16}/> Vista previa de tu vitrina mientras editas</li><li><CheckCircle2 size={16}/> Publica una tienda con identidad propia</li></ul><Link href="/register" className="btn btn-solid btn-large">Crea tu vitrina con CLICKOK Studio <ArrowRight size={17}/></Link></div><div className="studio-feature-visual"><div className="studio-feature-window"><div className="studio-feature-top"><span/><span/><span/><small>CLICKOK STUDIO · EDITOR DE VITRINAS</small></div><div className="studio-feature-app"><aside><b>CLICKOK<br/>STUDIO</b><i/><i/><i/><i/><div className="studio-feature-palette"><span/><span/><span/><span/></div></aside><main><div className="studio-feature-toolbar"><b>Personaliza tu vitrina</b><span>● Vista previa activa</span></div><div className="studio-feature-cover"><small>CATÁLOGO DIGITAL</small><strong>Tu marca,<br/>en primer plano.</strong><span>Tu tienda, a tu manera.</span></div><div className="studio-feature-categories"><i/><i/><i/><i/></div><div className="studio-feature-products"><article><span/><b/><i/></article><article><span/><b/><i/></article><article><span/><b/><i/></article></div></main></div></div><div className="studio-feature-float"><span><CheckCircle2 size={16}/></span><div><small>PERSONALIZACIÓN</small><b>Tu identidad, en cada detalle</b></div></div></div></section>
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
    <footer className="landing-footer ck-footer"><Brand/><span>Tu negocio, conectado.</span><span>Una nueva forma de vender y crecer.</span><div className="legal-footer-links"><Link href="/legal/privacidad">Tratamiento de datos</Link><Link href="/legal/terminos">Términos y condiciones</Link></div><Link href="/login">Iniciar sesión <ArrowRight size={14}/></Link><a className="atomlabs-credit" href="https://atomlabs.lat/#top" target="_blank" rel="noreferrer"><span>DESARROLLADO POR</span><b><svg className="atomlabs-symbol" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round"><ellipse cx="32" cy="32" rx="12" ry="27"/><ellipse cx="32" cy="32" rx="12" ry="27" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="12" ry="27" transform="rotate(120 32 32)"/></g><circle cx="32" cy="32" r="4.2" fill="currentColor"/></svg>ATOMLABS<sup>®</sup></b></a></footer>
  </div>;
}


function VeterinaryWorkspace({ businessId }: { businessId: string }) {
  type Patient = { id:string; name:string; species:string; breed:string|null; owner_name:string; owner_phone:string|null };
  type Appointment = { id:string; patient_id:string; scheduled_at:string; reason:string; status:string };
  type Medicine = { id:string; name:string; price:number; stock:number|null; is_active:boolean };
  type Sale = { id:string; total:number; payment_method:string|null; created_at:string };
  const [patients,setPatients]=useState<Patient[]>([]);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [medicines,setMedicines]=useState<Medicine[]>([]);
  const [sales,setSales]=useState<Sale[]>([]);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
  const [tab,setTab]=useState<'pharmacy'|'patients'|'appointments'>('pharmacy');
  const [p,setP]=useState({name:'',species:'Perro',breed:'',owner_name:'',owner_phone:'',sex:'No especificado',birth_date:'',notes:''});
  const [a,setA]=useState({patient_id:'',scheduled_at:'',reason:'Consulta general'});
  const refresh=async()=>{setLoading(true);setError('');const [pr,ar,mr,sr]=await Promise.all([
    supabase.from('vet_patients').select('id,name,species,breed,owner_name,owner_phone').eq('business_id',businessId).eq('is_active',true).order('name'),
    supabase.from('vet_appointments').select('id,patient_id,scheduled_at,reason,status').eq('business_id',businessId).order('scheduled_at',{ascending:false}).limit(100),
    supabase.from('products').select('id,name,price,stock,is_active').eq('business_id',businessId).order('name'),
    supabase.from('sales').select('id,total,payment_method,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(8)
  ]);
  const failed=[pr,ar,mr,sr].find(x=>x.error);
  if(failed?.error)setError(failed.error.message);else{setPatients(pr.data||[]);setAppointments(ar.data||[]);setMedicines(mr.data||[]);setSales(sr.data||[]);}
  setLoading(false);};
  useEffect(()=>{void refresh();},[businessId]);
  const savePatient=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');const {error}=await supabase.from('vet_patients').insert({...p,business_id:businessId,birth_date:p.birth_date||null,breed:p.breed||null,owner_phone:p.owner_phone||null,notes:p.notes||null});if(error)setError(error.message);else{setP({name:'',species:'Perro',breed:'',owner_name:'',owner_phone:'',sex:'No especificado',birth_date:'',notes:''});setNotice('Paciente registrado.');await refresh();}setSaving(false);};
  const saveAppointment=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');const {error}=await supabase.from('vet_appointments').insert({business_id:businessId,patient_id:a.patient_id,scheduled_at:new Date(a.scheduled_at).toISOString(),reason:a.reason});if(error)setError(error.message);else{setA({patient_id:'',scheduled_at:'',reason:'Consulta general'});setNotice('Cita agendada.');setTab('appointments');await refresh();}setSaving(false);};
  const setStatus=async(id:string,status:string)=>{const {error}=await supabase.from('vet_appointments').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('business_id',businessId);if(error)setError(error.message);else await refresh();};
  const visible=patients.filter(x=>(x.name+' '+x.owner_name+' '+x.species+' '+(x.owner_phone||'')).toLowerCase().includes(query.toLowerCase()));
  const visibleMeds=medicines.filter(x=>x.name.toLowerCase().includes(query.toLowerCase()));
  const patientName=(id:string)=>patients.find(x=>x.id===id)?.name||'Paciente';
  const lowStock=medicines.filter(x=>x.stock!==null&&x.stock<=5).length;
  return <section className="vet-workspace">
    <PageTitle eyebrow="FARMACIA VETERINARIA" title="Medicamentos y ventas" description="Administra el inventario farmacéutico y vende medicamentos desde tu punto de venta." action={<Link href="/app/pos" className="btn btn-solid"><ShoppingCart size={16}/> Abrir punto de venta</Link>}/>
    <div className="vet-summary"><article><Package/><b>{medicines.length}</b><span>Productos en catálogo</span></article><article><AlertTriangle/><b>{lowStock}</b><span>Con stock bajo (5 o menos)</span></article><article><TrendingUp/><b>{money(sales.reduce((n,x)=>n+Number(x.total||0),0))}</b><span>Ventas recientes · últimas 8</span></article></div>
    {error&&<div className="notice notice-error">{error}</div>}{notice&&<div className="notice notice-success">{notice}</div>}
    <div className="vet-tabs"><button className={tab==='pharmacy'?'active':''} onClick={()=>setTab('pharmacy')}>Farmacia e inventario</button><button className={tab==='patients'?'active':''} onClick={()=>setTab('patients')}>Pacientes</button><button className={tab==='appointments'?'active':''} onClick={()=>setTab('appointments')}>Citas</button></div>
    {tab==='pharmacy'?<div className="vet-pharmacy-layout">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">INVENTARIO</span><h2>Medicamentos y productos</h2></div><Link href="/app/products" className="text-link">Gestionar catálogo <ArrowRight size={14}/></Link></div>
        <input className="vet-search" placeholder="Buscar medicamento o producto" value={query} onChange={e=>setQuery(e.target.value)}/>
        {loading?<p>Cargando inventario…</p>:visibleMeds.length===0?<p className="subtle">No hay productos registrados. Crea los medicamentos desde el catálogo para comenzar.</p>:<div className="vet-medicine-list">{visibleMeds.map(x=><article key={x.id}><span className="vet-avatar"><Package/></span><div><b>{x.name}</b><small>{money(Number(x.price))} · {x.is_active?'Activo':'Inactivo'}</small></div><span className={x.stock!==null&&x.stock<=5?'vet-stock-low':'vet-stock'}>{x.stock===null?'Sin control':x.stock+' und.'}</span></article>)}</div>}
        <div className="vet-pharmacy-actions"><Link href="/app/products" className="btn btn-outline"><Plus size={15}/> Registrar medicamento</Link><Link href="/app/pos" className="btn btn-solid"><ShoppingCart size={15}/> Vender medicamentos</Link></div>
      </section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">MOVIMIENTO COMERCIAL</span><h2>Ventas recientes</h2></div><Link href="/app/pos" className="text-link">Ir al POS <ArrowRight size={14}/></Link></div>
        {sales.length===0?<p className="subtle">Aún no hay ventas registradas.</p>:<div className="vet-patient-list">{sales.map(x=><article key={x.id}><span className="vet-avatar"><ShoppingCart/></span><div><b>{money(Number(x.total))}</b><small>{new Date(x.created_at).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}</small><small>{x.payment_method||'Pago registrado'}</small></div></article>)}</div>}
        <p className="vet-pharmacy-note">Las ventas se registran en el punto de venta de CLICKOK y descuentan el inventario del producto.</p>
      </section>
    </div>
    :tab==='patients'?<div className="vet-layout"><section className="panel"><div className="panel-head"><div><span className="eyebrow">NUEVO REGISTRO</span><h2>Registrar paciente</h2></div></div><form className="vet-form" onSubmit={savePatient}>
      <label>Nombre de la mascota<input required maxLength={120} value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))}/></label><label>Especie<select value={p.species} onChange={e=>setP(v=>({...v,species:e.target.value}))}>{['Perro','Gato','Ave','Conejo','Reptil','Otro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Raza<input value={p.breed} onChange={e=>setP(v=>({...v,breed:e.target.value}))}/></label><label>Responsable<input required value={p.owner_name} onChange={e=>setP(v=>({...v,owner_name:e.target.value}))}/></label><label>Teléfono<input type="tel" value={p.owner_phone} onChange={e=>setP(v=>({...v,owner_phone:e.target.value}))}/></label><label>Fecha de nacimiento<input type="date" value={p.birth_date} onChange={e=>setP(v=>({...v,birth_date:e.target.value}))}/></label><label>Observaciones<textarea rows={3} value={p.notes} onChange={e=>setP(v=>({...v,notes:e.target.value}))}/></label><Button type="submit" disabled={saving}>{saving?'Guardando…':'Guardar paciente'} <Plus size={15}/></Button></form></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">BASE DE PACIENTES</span><h2>Pacientes registrados</h2></div></div><input className="vet-search" placeholder="Buscar mascota o responsable" value={query} onChange={e=>setQuery(e.target.value)}/>{loading?<p>Cargando…</p>:visible.length===0?<p className="subtle">Aún no hay pacientes registrados.</p>:<div className="vet-patient-list">{visible.map(x=><article key={x.id}><span className="vet-avatar"><PawPrint/></span><div><b>{x.name}</b><small>{x.species}{x.breed?' · '+x.breed:''}</small><small>Responsable: {x.owner_name} · {x.owner_phone||'Sin teléfono'}</small></div></article>)}</div>}</section></div>
    :<div className="vet-layout"><section className="panel"><div className="panel-head"><div><span className="eyebrow">PROGRAMAR ATENCIÓN</span><h2>Nueva cita</h2></div></div><form className="vet-form" onSubmit={saveAppointment}><label>Paciente<select required value={a.patient_id} onChange={e=>setA(v=>({...v,patient_id:e.target.value}))}><option value="">Selecciona</option>{patients.map(x=><option key={x.id} value={x.id}>{x.name} · {x.owner_name}</option>)}</select></label><label>Fecha y hora<input type="datetime-local" required value={a.scheduled_at} onChange={e=>setA(v=>({...v,scheduled_at:e.target.value}))}/></label><label>Motivo<input required value={a.reason} onChange={e=>setA(v=>({...v,reason:e.target.value}))}/></label><Button type="submit" disabled={saving||patients.length===0}>{saving?'Agendando…':'Agendar cita'} <CalendarDays size={15}/></Button>{patients.length===0&&<small>Registra un paciente antes de agendar.</small>}</form></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">AGENDA</span><h2>Citas registradas</h2></div></div>{appointments.length===0?<p className="subtle">No hay citas registradas.</p>:<div className="vet-appointment-list">{appointments.map(x=><article key={x.id}><div><b>{patientName(x.patient_id)}</b><small>{new Date(x.scheduled_at).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})} · {x.reason}</small></div><select aria-label="Estado de la cita" value={x.status} onChange={e=>void setStatus(x.id,e.target.value)}>{['Agendada','Confirmada','En consulta','Completada','Cancelada'].map(st=><option key={st}>{st}</option>)}</select></article>)}</div>}</section></div>}
  </section>;
}
function AppShell({ data, session, update, logout, children, business, activePath, modules = [] }: { data: DemoData; session: Session; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void; logout: () => void; children: ReactNode; business?: Business; activePath: string; modules?: string[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = session?.role === 'admin';
  const links = isAdmin ? adminLinks : [...shopLinks, ['/app/pos', 'Punto de venta', ShoppingCart] as const, ...(business && isFoodBusiness(business.tipo) ? [['/app/restaurant', 'Mesas y meseros', Utensils] as const] : []), ...(modules.includes('pet_store_tools') ? [['/app/veterinary', 'Veterinaria', PawPrint] as const] : [])];
  const [location, setLocation] = useLocation();
  const user = data.users.find(u => u.id === session?.userId);
  const switchBusiness = (id: string) => { localStorage.setItem('menuya-business', id); setLocation('/app'); window.dispatchEvent(new Event('menuya-business-change')); };
  return <div className={`dashboard-shell ${!isAdmin ? 'merchant-dashboard' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="side-brand-row"><Brand inverse /><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>{!isAdmin && <div className="business-select"><span className="business-initial">{business?.nombre.charAt(0)}</span><span><small>TIENDA ACTIVA</small><b>{business?.nombre}</b></span><ChevronDown size={14} /></div>}
      <div className="side-caption">{isAdmin ? 'PLATAFORMA' : 'GESTIONA TU TIENDA'}</div><nav className="side-nav">{links.map(([href, label, Icon]) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`side-link ${activePath === href ? 'side-link-active' : ''} ${href === '/app/editor' ? 'studio-nav-link' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span>{label === 'Pedidos' && data.orders.filter(o => o.business_id === business?.id && o.estado === 'pendiente').length > 0 && <i className="nav-count">{data.orders.filter(o => o.business_id === business?.id && o.estado === 'pendiente').length}</i>}</Link>)}</nav>
      <div className="sidebar-bottom">{!isAdmin && business && <Link href={`/${business.slug}`} className="store-link"><ExternalLink size={15} /> Ver tienda pública <ArrowRight size={13} /></Link>}<div className="sidebar-legal-links"><Link href="/legal/privacidad">Privacidad y datos</Link><Link href="/legal/terminos">Términos</Link></div><div className="user-chip"><span className="user-avatar">{user?.nombre.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span className="user-meta"><b>{user?.nombre}</b><small>{isAdmin ? 'Administrador demo' : 'Propietario'}</small></span><button className="icon-btn logout-btn" aria-label="Cerrar sesión" onClick={logout} data-testid="button-logout"><LogOut size={16} /></button></div></div></aside>
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

function MerchantPage({ path, data, business, update, modules = [] }: { path: string; data: DemoData; business: Business; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void; modules?: string[] }) {
  const foodBusiness = isFoodBusiness(business.tipo);
  const variantLabel = optionLabelForBusiness(business.tipo);
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
  const [showHelpWelcome, setShowHelpWelcome] = useState(false);
  const [posSales, setPosSales] = useState<{ id: string; total: number; created_at: string }[]>([]);
  useEffect(() => {
    let active = true;
    if (path !== '/app' && path !== '/app/' && path !== '/app/analytics') return;
    const loadPosSales = async () => {
      const { data: rows, error } = await supabase.from('sales')
        .select('id,total,created_at')
        .eq('business_id', business.id)
        .gte('created_at', new Date(Date.now() - 60 * 86400000).toISOString())
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) {
        console.error('No fue posible cargar las ventas directas del POS:', error);
        return;
      }
      setPosSales((rows || []).map(row => ({ id: row.id, total: Number(row.total || 0), created_at: row.created_at })));
    };
    void loadPosSales();
    const channel = supabase.channel(`dashboard-pos-sales-${business.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${business.id}` }, () => {
        void loadPosSales();
      })
      .subscribe();
    const handleFocus = () => { void loadPosSales(); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') void loadPosSales(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [business.id, path]);
  const cats = data.categories.filter(c => c.business_id === business.id).sort((a, b) => a.orden - b.orden);
  const products = data.products.filter(p => p.business_id === business.id);
  const orders = data.orders.filter(o => o.business_id === business.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const customers = data.customers.filter(c => c.business_id === business.id);
  const settings = data.settings.find(s => s.business_id === business.id)!;
  useEffect(() => { setDraftStoreColor(settings.color); }, [settings.color, business.id]);
  useEffect(() => { try { if (!window.localStorage.getItem(`clickok-help-welcome-${business.id}`)) setShowHelpWelcome(true); } catch { setShowHelpWelcome(false); } }, [business.id]);
  const dismissHelpWelcome = () => { setShowHelpWelcome(false); try { window.localStorage.setItem(`clickok-help-welcome-${business.id}`, '1'); } catch { /* Storage may be unavailable. */ } };
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
    { name: 'descripcion', label: 'Descripción', type: 'textarea', value: initial?.descripcion }, { name: 'imagen', label: 'Fotografía del producto', type: 'image', value: initial?.imagen || '' }, { name: 'category_id', label: 'Categoría', value: initial?.category_id || cats[0]?.id, options: cats.map(c => c.id), optionLabels: Object.fromEntries(cats.map(c => [c.id, c.nombre])) },
    { name: 'variantes', label: variantLabel, type: 'choiceBuilder', value: choiceText(initial?.variantes) }, ...([{ name: 'complementos', label: foodBusiness ? 'Adiciones y extras' : 'Adiciones, accesorios o extras', type: 'choiceBuilder', value: choiceText(initial?.complementos) }]),
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
  if (path === '/app/veterinary' && modules.includes('pet_store_tools')) return <VeterinaryWorkspace businessId={business.id} />;
  if (path === '/app/couriers') return <CourierManagement businessId={business.id} />;

  if (path === '/app' || path === '/app/') {
    const now = Date.now();
    const currentStart = now - 30 * 86400000;
    const previousStart = now - 60 * 86400000;
    const currentOrders = orders.filter(o => o.estado !== 'cancelado' && new Date(o.created_at).getTime() >= currentStart);
    const previousOrders = orders.filter(o => {
      const time = new Date(o.created_at).getTime();
      return o.estado !== 'cancelado' && time >= previousStart && time < currentStart;
    });
    const currentPosSales = posSales.filter(sale => new Date(sale.created_at).getTime() >= currentStart);
    const previousPosSales = posSales.filter(sale => {
      const time = new Date(sale.created_at).getTime();
      return time >= previousStart && time < currentStart;
    });
    // La tarjeta de ventas usa exclusivamente cobros confirmados y registrados por el POS.
    const currentSales = currentPosSales.reduce((sum, sale) => sum + sale.total, 0);
    const previousSales = previousPosSales.reduce((sum, sale) => sum + sale.total, 0);
    const currentCustomers = new Set(currentOrders.map(order => order.customer_id).filter(Boolean)).size;
    const previousCustomers = new Set(previousOrders.map(order => order.customer_id).filter(Boolean)).size;
    const variation = (current: number, previous: number) => previous > 0
      ? `${current >= previous ? '+' : ''}${Math.round(((current - previous) / previous) * 100)}% vs. período anterior`
      : undefined;
    return <><PageTitle eyebrow="TU NEGOCIO, EN UN VISTAZO" title={`Hola, ${data.users.find(u => u.id === business.owner_id)?.nombre.split(' ')[0] || 'bienvenido'}.`} description="Esto es lo que está pasando en tu tienda." action={<Link href={`/${business.slug}`} className="btn btn-outline" target="_blank"><Eye size={16} /> Ver mi tienda</Link>} />\n      {showHelpWelcome && <section className="help-dashboard-banner"><span className="help-dashboard-icon"><BookOpen size={20}/></span><div><b>¿Primera vez en CLICKOK?</b><p>Explora los tutoriales y aprende a configurar tu vitrina, gestionar pedidos y activar notificaciones.</p></div><Link href="/app/help" onClick={dismissHelpWelcome}>Ver tutoriales <ArrowRight size={15}/></Link><button type="button" onClick={dismissHelpWelcome} aria-label="Cerrar aviso"><X size={16}/></button></section>}
      {business.estado !== 'activo' && <div className="notice notice-warn"><Clock3 size={18} /><span><b>Tu tienda está {statusLabel[business.estado]?.toLowerCase()}.</b> {business.estado === 'pendiente' ? 'La tienda no será visible al público hasta su aprobación.' : 'Contacta al equipo de CLICKOK si necesitas ayuda.'}</span></div>}
      <div className="metrics-grid">
        <Metric label="Pedidos recibidos" value={String(currentOrders.length)} note="Últimos 30 días" icon={ShoppingCart} trend={variation(currentOrders.length, previousOrders.length)} />
        <Metric label="Ventas registradas" value={money(currentSales)} note="" icon={TrendingUp} trend={variation(currentSales, previousSales)} />
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
    {filteredProducts.length ? <DataTable headers={['Producto', 'Categoría', 'Precio', 'Estado', 'Acciones']}>{filteredProducts.map(p => <tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="table-product"><span className="product-thumb">{p.nombre.slice(0, 1)}</span><span><b>{p.nombre}</b><small>{p.destacado ? 'Destacado' : p.descripcion.slice(0, 40)}</small></span></div></td><td>{cats.find(c => c.id === p.category_id)?.nombre || 'Sin categoría'}</td><td><b className="product-current-price">{money(p.precio)}</b>{p.precio_anterior && <small className="old-price">{money(p.precio_anterior)}</small>}</td><td><Status value={p.activo && p.disponible ? 'activo' : 'suspendido'} /></td><td><div className="table-actions"><button title="Editar" onClick={() => createProduct(p)} data-testid={`button-edit-product-${p.id}`}><Pencil size={15} /></button><button title={p.activo ? 'Desactivar' : 'Activar'} onClick={() => update(d => ({ ...d, products: d.products.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x) }), 'Estado del producto actualizado', p.nombre)}><Eye size={15} /></button><button title="Duplicar" onClick={() => update(d => ({ ...d, products: [...d.products, { ...p, id: repository.id(), nombre: `${p.nombre} (copia)` }] }), 'Producto duplicado', p.nombre)}><MoreHorizontal size={15} /></button><button title="Eliminar" onClick={() => { if (confirm(`¿Eliminar ${p.nombre}?`)) update(d => ({ ...d, products: d.products.filter(x => x.id !== p.id) }), 'Producto eliminado', p.nombre); }}><Trash2 size={15} /></button></div></td></tr>)}</DataTable> : <Empty title="No hay productos con ese filtro" text="Prueba otra búsqueda o crea tu primer producto." action={<HeaderAction text="Crear producto" onClick={() => createProduct()} />} />}
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
  if (path === '/app/editor') return <><PageTitle eyebrow="CLICKOK STUDIO" title="CLICKOK Studio" description="Personaliza la identidad de tu tienda y mira los cambios en tiempo real." action={<Link href={`/${business.slug}`} target="_blank" className="btn btn-outline"><Eye size={15} /> Abrir tienda</Link>} /><div className="studio-shell"><aside className="panel studio-controls"><div className="studio-intro"><span className="studio-kicker"><Pencil size={13}/> ESTUDIO DE DISEÑO</span><h2>Tu marca, tus reglas.</h2><p>Los cambios se guardan automáticamente.</p></div><div className="studio-section"><div className="studio-section-title"><span>01</span><div><b>Identidad</b><small>Nombre y personalidad</small></div></div><div className="form-stack"><label className="field"><span>Nombre del negocio</span><input defaultValue={business.nombre} onBlur={e => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, nombre: e.target.value } : b) }), 'Nombre de tienda guardado', business.nombre)} data-testid="input-store-name" /></label><label className="field"><span>Frase de presentación</span><input defaultValue={settings.tagline} onBlur={e => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, tagline: e.target.value } : s) }), 'Presentación guardada', business.nombre)} data-testid="input-store-tagline" /></label><Field field={{ name: 'logo', label: 'Logo de tu negocio', type: 'image', value: settings.logo }} businessId={business.id} onChange={(_, value) => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, logo: String(value) } : s) }), 'Logo actualizado', business.nombre)} /></div></div><div className="studio-section"><div className="studio-section-title"><span>02</span><div><b>Colores</b><small>Elige el tono de tu marca</small></div></div><div className="studio-palette">{[{name:'Coral',value:'#e7785d'},{name:'Océano',value:'#3977a8'},{name:'Esmeralda',value:'#26856f'},{name:'Violeta',value:'#7357d9'},{name:'Carbón',value:'#273449'},{name:'Dorado',value:'#bd9148'}].map(p => <button type="button" key={p.value} className={`studio-swatch ${previewStoreColor.toLowerCase()===p.value?'selected':''}`} style={{'--swatch':p.value} as React.CSSProperties} onClick={() => {setDraftStoreColor(p.value); update(d => ({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,color:p.value}:s)}),'Paleta actualizada',business.nombre);}} aria-label={`Usar color ${p.name}`} title={p.name}><i/></button>)}</div><label className="field"><span>Color personalizado</span><div className="color-field"><input type="color" value={previewStoreColor} onChange={e => setDraftStoreColor(e.target.value)} onBlur={commitStoreColor} onKeyDown={e => {if(e.key==='Enter'){e.preventDefault();commitStoreColor();}}} data-testid="input-store-color"/><span>{previewStoreColor.toUpperCase()}</span><div className="color-swatch" style={{backgroundColor:previewStoreColor}}/></div></label></div><div className="studio-section"><div className="studio-section-title"><span>03</span><div><b>Fondo y tarjetas</b><small>Personaliza la superficie de tu vitrina</small></div></div><div className="form-stack"><label className="field"><span>Color de fondo de la tienda</span><div className="color-field"><input type="color" value={settings.background_color || '#f7f7f5'} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,background_color:e.target.value}:s)}),'Fondo de vitrina actualizado',business.nombre)} data-testid="input-store-background-color"/><span>{(settings.background_color || '#f7f7f5').toUpperCase()}</span><div className="color-swatch" style={{backgroundColor:settings.background_color || '#f7f7f5'}}/></div></label><div className="studio-inline-swatches">{[{name:'Marfil',value:'#fff7e8'},{name:'Blanco',value:'#ffffff'},{name:'Gris claro',value:'#f3f4f6'},{name:'Negro suave',value:'#20242b'}].map(p=><button type="button" key={p.value} title={p.name} aria-label={p.name} style={{background:p.value}} className={`studio-inline-swatch ${(settings.background_color || '#f7f7f5')===p.value?'selected':''}`} onClick={()=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,background_color:p.value}:s)}),'Fondo de vitrina actualizado',business.nombre)}/>)}</div><label className="field"><span>Fondo de las tarjetas de productos</span><div className="color-field"><input type="color" value={settings.card_background_color || '#ffffff'} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,card_background_color:e.target.value}:s)}),'Tarjetas actualizadas',business.nombre)} data-testid="input-store-card-background-color"/><span>{(settings.card_background_color || '#ffffff').toUpperCase()}</span><div className="color-swatch" style={{backgroundColor:settings.card_background_color || '#ffffff'}}/></div></label></div></div><div className="studio-section"><div className="studio-section-title"><span>04</span><div><b>Tipografía</b><small>El carácter de tus textos</small></div></div><label className="field"><span>Estilo de letra</span><select value={settings.fuente} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,fuente:e.target.value}:s)}),'Tipografía actualizada',business.nombre)}><option>Manrope</option><option>DM Sans</option><option>Georgia</option><option>Arial</option></select></label></div><div className="studio-section"><div className="studio-section-title"><span>05</span><div><b>Portada y redes</b><small>Haz que te encuentren</small></div></div><div className="form-stack"><Field field={{ name: 'portada', label: 'Imagen de portada', type: 'image', value: settings.portada }} businessId={business.id} onChange={(_, value) => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, portada: String(value) } : s) }), 'Portada actualizada', business.nombre)} /><label className="field"><span>Contacto visible</span><input defaultValue={settings.contacto} placeholder="WhatsApp o teléfono" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,contacto:e.target.value}:s)}),'Contacto actualizado',business.nombre)}/></label><label className="field"><span>Modalidad de entrega</span><input defaultValue={settings.entrega} placeholder="Domicilios y recoger en tienda" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,entrega:e.target.value}:s)}),'Modalidad de entrega actualizada',business.nombre)}/></label><label className="field"><span>Dirección del negocio</span><input defaultValue={settings.direccion} placeholder="Calle, carrera, número, barrio y ciudad" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,direccion:e.target.value}:s)}),'Dirección actualizada',business.nombre)} data-testid="input-store-address"/></label><label className="field"><span>Tiempo estimado de entrega</span><input defaultValue={settings.tiempo_entrega} placeholder="Ej. 30 – 50 min" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,tiempo_entrega:e.target.value}:s)}),'Tiempo de entrega actualizado',business.nombre)} data-testid="input-store-delivery-time"/></label><label className="field"><span>Usuario de redes sociales</span><input defaultValue={settings.redes} placeholder="@tunegocio" onBlur={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,redes:e.target.value}:s)}),'Redes sociales actualizadas',business.nombre)}/></label></div></div><div className="studio-section studio-templates-section"><div className="studio-section-title"><span>06</span><div><b>Plantillas prediseñadas</b><small>Elige una base visual y personaliza sus colores</small></div></div><div className="studio-template-grid">{[{name:'Editorial',color:'#26364f',layout:'list',card:'minimal',button:'square',font:'Georgia',desc:'Elegante y editorial'},{name:'Minimal',color:'#64748b',layout:'grid',card:'minimal',button:'rounded',font:'DM Sans',desc:'Limpio y esencial'},{name:'Vibrante',color:'#e45b45',layout:'grid',card:'soft',button:'pill',font:'Manrope',desc:'Color y energía'},{name:'Elegante',color:'#9b7845',layout:'grid',card:'classic',button:'rounded',font:'Georgia',desc:'Detalles sofisticados'},{name:'Natural',color:'#47745c',layout:'list',card:'soft',button:'rounded',font:'DM Sans',desc:'Cálido y orgánico'},{name:'Urbano',color:'#30343b',layout:'grid',card:'classic',button:'square',font:'Arial',desc:'Contraste contemporáneo'},{name:'Boutique',color:'#9b6480',layout:'grid',card:'soft',button:'pill',font:'Manrope',desc:'Suave y exclusivo'}].map(t=><button type="button" className="studio-template-card" key={t.name} onClick={()=>{setDraftStoreColor(t.color);update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,color:t.color,layout:t.layout as StoreSettings['layout'],card_style:t.card as StoreSettings['card_style'],button_style:t.button as StoreSettings['button_style'],fuente:t.font}:s)}),`Plantilla ${t.name} aplicada`,business.nombre);}}><span className="studio-template-art" style={{'--template-color':t.color} as React.CSSProperties}><i/><i/><i/><b/></span><strong>{t.name}</strong><small>{t.desc}</small></button>)}</div><p className="studio-template-hint">Después de elegirla, cambia el color en la sección «Colores». También puedes ajustar tipografía, portada y catálogo.</p></div><div className="studio-section"><div className="studio-section-title"><span>07</span><div><b>Diseño de catálogo</b><small>Distribución y estilo de productos</small></div></div><label className="field"><span>Distribución de productos</span><select value={settings.layout} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,layout:e.target.value as StoreSettings['layout']}:s)}),'Distribución actualizada',business.nombre)}><option value="grid">Cuadrícula</option><option value="list">Lista horizontal</option></select></label><label className="field"><span>Estilo de tarjetas</span><select value={settings.card_style} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,card_style:e.target.value as StoreSettings['card_style']}:s)}),'Tarjetas actualizadas',business.nombre)}><option value="classic">Clásico</option><option value="minimal">Minimalista</option><option value="soft">Suave y moderno</option></select></label><label className="field"><span>Forma de botones</span><select value={settings.button_style} onChange={e=>update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,button_style:e.target.value as StoreSettings['button_style']}:s)}),'Botones actualizados',business.nombre)}><option value="rounded">Redondeados</option><option value="pill">Pastilla</option><option value="square">Cuadrados</option></select></label></div><div className="studio-publish"><div><b>{settings.publicado?'Tu vitrina está publicada':'Tu vitrina está oculta'}</b><small>{settings.publicado?'Los clientes pueden visitar tu tienda.':'Publícala cuando esté lista.'}</small></div><button className={`toggle ${settings.publicado?'toggle-on':''}`} onClick={()=>{update(d=>({...d,settings:d.settings.map(s=>s.business_id===business.id?{...s,publicado:!s.publicado}:s)}),settings.publicado?'Tienda despublicada':'Tienda publicada',business.nombre);}} aria-label="Cambiar publicación" data-testid="toggle-store-published"><i/></button></div></aside><section className="studio-preview"><div className="studio-preview-head"><div><span className="studio-kicker">VISTA EN TIEMPO REAL</span><b>Así verán tu tienda</b></div><span className="studio-live"><i/> PREVISUALIZACIÓN</span></div><div className="preview-browser studio-browser"><div className="browser-bar"><i/><i/><i/><span>clickok.co/{business.slug}</span></div><div className={`public-store live-preview public-layout-${settings.layout} public-cards-${settings.card_style} public-buttons-${settings.button_style}`} style={{'--store-color':previewStoreColor,'--store-background':settings.background_color || '#f7f7f5','--store-card-background':settings.card_background_color || '#ffffff','--store-text':storefrontContrast(settings.background_color || '#f7f7f5').text,'--store-muted':storefrontContrast(settings.background_color || '#f7f7f5').muted,'--store-card-text':storefrontContrast(settings.card_background_color || '#ffffff').text,'--store-card-muted':storefrontContrast(settings.card_background_color || '#ffffff').muted,'--store-accent-text':storefrontContrast(previewStoreColor).accentText,'fontFamily':settings.fuente==='Georgia'?'Georgia,serif':settings.fuente==='Arial'?'Arial,sans-serif':settings.fuente==='DM Sans'?'DM Sans,sans-serif':'Manrope,sans-serif'} as React.CSSProperties}>
<header className="public-header"><Brand/><div className="public-header-actions"><span className="public-track-link">Rastrear mi pedido</span><span className="public-powered">UNA TIENDA DE <b>CLICKOK</b></span></div></header>
<section className="public-hero"><div className="public-cover" style={settings.portada?{backgroundImage:`url("${settings.portada}")`,backgroundSize:'100% 100%',backgroundPosition:'center'}:undefined}><span className="cover-kicker">CATÁLOGO DIGITAL</span></div><div className="public-store-intro"><div className="public-logo">{settings.logo?<img src={settings.logo} alt={`Logo de ${business.nombre}`}/>:business.nombre.charAt(0)}</div><div><h1>{business.nombre}</h1><p>{settings.tagline || 'Una tienda local que te atiende de cerca.'}</p></div><span className="open-label"><i/> Abierto</span></div><div className="public-store-details">{settings.direccion&&<div><MapPin size={15}/><span>{settings.direccion}</span></div>}{settings.tiempo_entrega&&<div><Clock3 size={15}/><span>Entrega <b>{settings.tiempo_entrega}</b></span></div>}</div></section>
<main className="public-main"><div className="public-toolbar"><div className="search-field"><Search size={14}/><span>Busca algo que te guste...</span></div></div><div className="public-categories"><button className="category-active">Todo el catálogo</button>{cats.filter(c=>c.activo).slice(0,4).map(c=><button key={c.id}>{c.nombre}</button>)}</div><div className="public-storefront-sections">{products.filter(p=>p.activo&&p.disponible&&p.destacado).length>0&&<section className="public-featured-section"><div className="public-category-heading"><div><span className="eyebrow">HECHO PARA TI</span><h2>Populares</h2></div></div><div className="public-featured-track">{products.filter(p=>p.activo&&p.disponible&&p.destacado).slice(0,5).map((p,i)=><article className={"public-product public-product-" + settings.card_style} key={p.id}><div className={"public-product-art public-art-" + (i % 5)}>{p.imagen ? <img className="public-product-image" src={p.imagen} alt={p.nombre} loading="lazy"/> : <b className="public-product-placeholder">{p.nombre.slice(0,1)}</b>}<span>{p.destacado ? 'DESTACADO' : cats.find(c=>c.id===p.category_id)?.nombre}</span></div><div className="public-product-info"><div><b className="product-title-button">{p.nombre}</b><p>{p.descripcion}</p><b className="product-current-price">{money(p.precio)}</b></div></div></article>)}</div></section>}{cats.filter(c=>c.activo).slice(0,2).map(c=>{const items=products.filter(p=>p.activo&&p.disponible&&p.category_id===c.id);return items.length?<section className="public-category-section" key={c.id}><div className="public-category-heading"><div><span className="eyebrow">DESCUBRE</span><h2>{c.nombre}</h2></div><span>Ver todos →</span></div><div className={`public-products public-products-${settings.layout}`}>{items.slice(0,4).map((p,i)=><article className={"public-product public-product-" + settings.card_style} key={p.id}><div className={"public-product-art public-art-" + (i % 5)}>{p.imagen ? <img className="public-product-image" src={p.imagen} alt={p.nombre} loading="lazy"/> : <b className="public-product-placeholder">{p.nombre.slice(0,1)}</b>}<span>{p.destacado ? 'DESTACADO' : cats.find(c=>c.id===p.category_id)?.nombre}</span></div><div className="public-product-info"><div><b className="product-title-button">{p.nombre}</b><p>{p.descripcion}</p><b className="product-current-price">{money(p.precio)}</b></div></div></article>)}</div></section>:null;})}</div></main></div></div><div className="studio-preview-foot"><span><CheckCircle2 size={14}/> Vista previa interactiva</span><small>Los cambios se guardan automáticamente en tu vitrina.</small></div></section></div></>;
  if (path === '/app/analytics') {
    const now = Date.now();
    const currentStart = now - 30 * 86400000;
    const previousStart = now - 60 * 86400000;
    const completed = orders.filter(o => o.estado !== 'cancelado');
    const currentCompleted = completed.filter(o => new Date(o.created_at).getTime() >= currentStart);
    const previousCompleted = completed.filter(o => { const time = new Date(o.created_at).getTime(); return time >= previousStart && time < currentStart; });
    const currentOrders = orders.filter(o => new Date(o.created_at).getTime() >= currentStart);
    const previousOrders = orders.filter(o => { const time = new Date(o.created_at).getTime(); return time >= previousStart && time < currentStart; });
    const currentPosSales = posSales.filter(sale => new Date(sale.created_at).getTime() >= currentStart);
    const previousPosSales = posSales.filter(sale => {
      const time = new Date(sale.created_at).getTime();
      return time >= previousStart && time < currentStart;
    });
    // Los ingresos y el número de ventas se toman únicamente de registros confirmados en el POS.
    const currentSales = currentPosSales.reduce((a, sale) => a + sale.total, 0);
    const previousSales = previousPosSales.reduce((a, sale) => a + sale.total, 0);
    const currentSaleCount = currentPosSales.length;
    const previousSaleCount = previousPosSales.length;
    const average = currentSaleCount ? Math.round(currentSales / currentSaleCount) : 0;
    const previousAverage = previousSaleCount ? Math.round(previousSales / previousSaleCount) : 0;
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
  if (path === '/app/help') return <HelpCenter businessId={business.id} businessName={business.nombre} businessType={business.tipo}/>;
  if (path === '/app/settings') return <><PageTitle eyebrow="DATOS DEL NEGOCIO" title="Ajustes" description="Mantén al día la información que tus clientes necesitan." /><div className="settings-grid"><section className="panel setting-section"><span className="eyebrow">INFORMACIÓN PÚBLICA</span><h2>Que te encuentren</h2><div className="form-stack"><SettingInput label="Nombre del negocio" value={business.nombre} id="business-name" onSave={v => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, nombre: v } : b) }), 'Datos guardados', 'Negocio')} /><SettingInput label="Teléfono" value={business.telefono} id="business-phone" onSave={v => update(d => ({ ...d, businesses: d.businesses.map(b => b.id === business.id ? { ...b, telefono: v } : b) }), 'Teléfono actualizado', 'Negocio')} /><SettingInput label="Correo de contacto" value={settings.contacto} id="contact-email" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, contacto: v } : s) }), 'Contacto actualizado', 'Negocio')} /><SettingInput label="Redes sociales" value={settings.redes} id="business-social" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, redes: v } : s) }), 'Redes actualizadas', 'Negocio')} /></div></section><section className="panel setting-section"><span className="eyebrow">CÓMO OPERAS</span><h2>Pagos y entregas</h2><div className="form-stack"><SettingInput label="Métodos de pago" value={settings.pagos} id="payment-methods" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, pagos: v } : s) }), 'Métodos de pago guardados', 'Negocio')} /><SettingInput label="Opciones de entrega" value={settings.entrega} id="delivery-methods" onSave={v => update(d => ({ ...d, settings: d.settings.map(s => s.business_id === business.id ? { ...s, entrega: v } : s) }), 'Opciones de entrega guardadas', 'Negocio')} /><div className="settings-info"><CircleHelp size={17} /><p>CLICKOK organiza tus pedidos. El cobro y la coordinación de entrega siguen directamente contigo y tu cliente.</p></div></div></section></div><PushNotificationsSettings businessId={business.id}/></>;
  if (path === '/app/restaurant') return foodBusiness ? <RestaurantOperations businessId={business.id}/> : <Empty title="Módulo exclusivo para restaurantes" text="La gestión de mesas y meseros solo está disponible para negocios del sector restaurante."/>;
  if (path === '/app/pos') return (plan && (/^pro$/i.test(plan.nombre.trim()) || plan.funciones.some(feature => /punto de venta|\\bpos\\b/i.test(feature)))) ? <PointOfSale businessId={business.id} businessType={business.tipo}/> : <Empty title="Desbloquea el punto de venta con Pro" text="El módulo Punto de venta está disponible al adquirir el plan Pro. Actualiza tu suscripción para gestionar ventas presenciales desde CLICKOK." action={<Link href="/app/subscription" className="btn btn-outline">Adquirir plan Pro</Link>} />;
  if (path === '/app/subscription') return <><PageTitle eyebrow="TU TIENDA, A TU RITMO" title="Plan y suscripción" description="Empieza con lo esencial. Cambia cuando tu negocio lo pida." /><div className="current-plan"><div><span className="eyebrow">PLAN ACTUAL</span><h2>{plan?.nombre || 'Gratis'}<span>{money(plan?.precio || 0)} <small>/ mes</small></span></h2><p>Suscripción {statusLabel[subscription?.estado || 'activa']?.toLowerCase()} · Renueva el {shortDate(subscription?.vencimiento || new Date().toISOString())}</p></div><Status value={subscription?.estado || 'activa'} /></div><div className="plans-grid">{data.plans.filter(p => p.activo).map(p => <article className={`plan-card ${p.id === plan?.id ? 'plan-selected' : ''}`} key={p.id}><span className="eyebrow">{p.id === 'pro' ? 'PARA CRECER' : p.id === 'starter' ? 'EL FAVORITO' : 'PARA EMPEZAR'}</span><h3>{p.nombre}</h3><p className="plan-price">{money(p.precio)}<small> / {p.periodicidad === 'year' ? 'año' : 'mes'}</small></p><p className="plan-products">{p.max_productos >= 999999 ? 'Productos ilimitados' : `Hasta ${p.max_productos} productos`}</p><ul>{p.funciones.map(f => <li key={f}><Check size={15} /> {f}</li>)}</ul><Button kind={p.id === plan?.id ? 'soft' : 'outline'} disabled={p.id === plan?.id || p.precio <= 0 || Boolean(checkoutBusy)} onClick={() => void startSubscriptionCheckout(p.id)} testId={`button-plan-${p.id}`}>{p.id === plan?.id ? 'Tu plan actual' : checkoutBusy === p.id ? 'Conectando con Wompi…' : p.precio <= 0 ? 'Plan gratuito' : 'Pagar con Wompi'}</Button></article>)}</div>{checkoutError && <div className="notice notice-error" role="alert">{checkoutError}</div>}<p className="fine-print">Pagos procesados de forma segura por Wompi. Tu plan se activa cuando recibimos la confirmación del pago.</p></>;
  return <Empty title="Página en construcción" text="Este espacio estará disponible pronto." />;
}

function SettingInput({ label, value, id, onSave }: { label: string; value: string; id: string; onSave: (value: string) => void }) {
  const displayValue = id === 'platform-name' && value === 'MENUYA' ? 'CLICKOK' : value;
  return <label className="field"><span>{label}</span><input defaultValue={displayValue} onBlur={e => { if (e.target.value !== value) onSave(e.target.value); }} data-testid={`input-${id}`} /></label>;
}
function ProductGrid({ products, cats }: { products: Product[]; cats: Category[] }) {
  return <div className="managed-product-grid">{products.map((p, i) => <article key={p.id} className="managed-product"><div className={`managed-art managed-art-${i % 5}`}><span>{cats.find(c => c.id === p.category_id)?.nombre}</span><b>{p.nombre.charAt(0)}</b></div><div className="managed-product-info"><h3>{p.nombre}</h3><p>{p.descripcion}</p><b className="product-current-price">{money(p.precio)}</b></div></article>)}</div>;
}
function OrderModal({ order, data, close, update }: { order: Order; data: DemoData; close: () => void; update: (fn: (d: DemoData) => DemoData, action?: string, entity?: string) => void }) {
  const customer = data.customers.find(c => c.id === order.customer_id);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order.estado);
  useEffect(() => { setCurrentStatus(order.estado); }, [order.id, order.estado]);
  const quickStatuses: { value: OrderStatus; label: string; hint: string; tone: string }[] = [
    { value: 'pendiente', label: 'Recibido', hint: 'Nuevo pedido', tone: 'received' },
    { value: 'preparando', label: 'Preparando', hint: 'En cocina o proceso', tone: 'preparing' },
    { value: 'listo', label: 'Listo', hint: 'Para entregar', tone: 'ready' },
    { value: 'entregado', label: 'Entregado', hint: 'Pedido finalizado', tone: 'delivered' },
    { value: 'cancelado', label: 'Cancelar', hint: 'Anular pedido', tone: 'cancelled' },
  ];
  const changeStatus = (value: OrderStatus) => {
    if (value === currentStatus) return;
    setCurrentStatus(value);
    update(d => ({ ...d, orders: d.orders.map(o => o.id === order.id ? { ...o, estado: value } : o) }), `Pedido actualizado: ${statusLabel[value]}`, `Pedido #${order.numero}`);
  };
  return <Modal title={`Pedido #${String(order.numero).padStart(3, '0')}`} close={close}><div className="order-detail"><div className="detail-customer"><span className="customer-avatar">{customer?.nombre.slice(0, 1)}</span><span><b>{customer?.nombre || 'Cliente'}</b><small>{customer?.telefono}</small></span><Status value={currentStatus} /></div><div className="detail-items">{order.items.map((item, i) => <div key={`${item.product_id}-${i}`}><span>{item.cantidad} × {item.nombre}{(item.variante || item.complementos?.length) && <small className="item-options">{[item.variante, ...(item.complementos || []).map(choice => `+ ${choice.nombre}`)].filter(Boolean).join(' · ')}</small>}</span><b>{money(item.precio * item.cantidad)}</b></div>)}</div><div className="detail-total"><span>Total del pedido</span><b>{money(order.total)}</b></div><div className="detail-meta"><span>Entrega<b>{order.entrega === 'domicilio' ? 'Domicilio' : 'Recoger en tienda'}</b></span>{order.direccion && <span>Dirección<b>{order.direccion}</b></span>}<span>Pago<b>{order.metodo_pago}</b></span><span>Fecha<b>{shortDate(order.created_at)}</b></span></div>{order.observaciones && <div className="order-note"><small>OBSERVACIONES</small><p>{order.observaciones}</p></div>}<section className="order-quick-status"><div className="order-quick-status-head"><div><span className="eyebrow">GESTIÓN RÁPIDA</span><b>Actualizar estado</b></div><Status value={currentStatus} /></div><div className="order-status-buttons">{quickStatuses.map((item,index) => <button type="button" key={item.value} className={`order-status-button order-status-${item.tone} ${currentStatus === item.value ? 'is-active' : ''}`} aria-pressed={currentStatus === item.value} onClick={() => changeStatus(item.value)}><span className="order-status-index">{index === 4 ? '×' : String(index + 1).padStart(2,'0')}</span><span><b>{item.label}</b><small>{item.hint}</small></span>{currentStatus === item.value && <CheckCircle2 size={17} />}</button>)}</div><p className="order-status-help">Toca una opción para actualizar el pedido. El cliente verá el cambio en su seguimiento.</p></section><div className="modal-actions"><Button kind="ghost" onClick={close}>Cerrar</Button><Button onClick={close}>Listo <Check size={15} /></Button></div></div></Modal>;
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
      settings: [...d.settings, { business_id: businessId, portada: '', logo: '', color: '#e77a60', background_color: '#f7f7f5', card_background_color: '#ffffff', fuente: 'Manrope', contacto: phone, redes: '', pagos: 'Efectivo, Nequi', entrega: 'Domicilio y recoger en tienda', publicado: state === 'activo', tagline: 'Un negocio local, hecho con cariño.', layout: 'grid', card_style: 'classic', button_style: 'rounded' }],
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
  const [cartChoices, setCartChoices] = useState<Record<string, { variantes?: { choice: ProductChoice; cantidad: number }[]; complementos: ProductChoice[] }>>({});
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [delivery, setDelivery] = useState<'domicilio' | 'recoger'>('domicilio');
  const [success, setSuccess] = useState(false);
  const [trackingToken, setTrackingToken] = useState('');
  const [error, setError] = useState('');
  const [storeServices, setStoreServices] = useState<{id:string;name:string;description:string|null;price:number;duration_minutes:number|null}[]>([]);
  const [serviceRequest, setServiceRequest] = useState<{id:string;name:string;price:number}|null>(null);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState(false);
  const business = data.businesses.find(b => b.slug === slug);
  useEffect(() => {
    const store = data.businesses.find(item => item.slug === slug);
    if (!store) return;
    void supabase.from('catalog_events').insert({ business_id: store.id, event_type: 'visit' }).then(({ error }) => { if (error) console.warn('No se pudo registrar la visita del catálogo:', error.message); });
  }, [slug]);
  useEffect(() => {
    const store = data.businesses.find(item => item.slug === slug);
    if (!store) return;
    void supabase.from('business_services').select('id,name,description,price,duration_minutes').eq('business_id',store.id).eq('is_active',true).order('name').then(({data:rows,error:serviceError}) => {
      if (serviceError) { console.warn('No se pudieron cargar los servicios:',serviceError.message); return; }
      setStoreServices((rows||[]).map(row=>({...row,price:Number(row.price||0)})));
    });
  }, [slug]);
  if (!business) return <NotFound />;
  const settings = data.settings.find(s => s.business_id === business.id);
  const cats = data.categories.filter(c => c.business_id === business.id && c.activo).sort((a, b) => a.orden - b.orden);
  const products = data.products.filter(p => p.business_id === business.id && p.activo && p.disponible && (category === 'todos' || p.category_id === category) && `${p.nombre} ${p.descripcion}`.toLowerCase().includes(search.toLowerCase()));
  const featuredProducts = category === 'todos' && !search ? products.filter(p => p.destacado) : [];
  const cartItems = Object.entries(cart).map(([key, cantidad]) => { const id = key.split('::')[0]; return { key, p: data.products.find(p => p.id === id)!, cantidad, variantes: cartChoices[key]?.variantes || [], complementos: cartChoices[key]?.complementos || [] }; }).filter(x => x.p);
  const itemUnitPrice = (item: (typeof cartItems)[number]) => item.p.precio + item.variantes.reduce((sum, selected) => sum + selected.choice.precio_extra * selected.cantidad, 0) + item.complementos.reduce((sum, choice) => sum + choice.precio_extra, 0);
  const subtotal = cartItems.reduce((a, x) => a + itemUnitPrice(x) * x.cantidad, 0);
  const openProduct = (product: Product) => {
    void supabase.from('catalog_events').insert({ business_id: business.id, product_id: product.id, event_type: 'inquiry' }).then(({ error }) => { if (error) console.warn('No se pudo registrar la consulta del producto:', error.message); });
    setConfiguring(product);
    setVariantQuantities({});
    setAddonQuantities({});
  };
  const addItem = (product: Product) => {
    if (checkout) {
      setCart(current => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
      return;
    }
    openProduct(product);
  };
  const confirmConfiguredItem = (product: Product) => {
    const selectedVariants = (product.variantes || []).filter(choice => (variantQuantities[choice.id] || 0) > 0);
    const complementos = (product.complementos || []).flatMap(choice => Array.from({ length: addonQuantities[choice.id] || 0 }, () => choice));
    const key = selectedVariants.length || complementos.length ? product.id + '::' + crypto.randomUUID() : product.id;
    const variantes = selectedVariants.map(choice => ({ choice, cantidad: variantQuantities[choice.id] || 0 }));
    setCart(current => ({ ...current, [key]: (current[key] || 0) + 1 }));
    setCartChoices(current => ({ ...current, [key]: { variantes, complementos } }));
    setError('');
    setConfiguring(null);
  };
  const setQty = (id: string, amount: number) => setCart(c => { const next = { ...c }; if (amount <= 0) delete next[id]; else next[id] = amount; return next; });
  const submitServiceRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!serviceRequest || serviceBusy) return;
    setError(''); setServiceBusy(true);
    const form = new FormData(e.currentTarget);
    const customerName=String(form.get('service_customer_name')||'').trim();
    const scheduled=String(form.get('service_scheduled_at')||'').trim();
    const notes=String(form.get('service_notes')||'').trim();
    if(!customerName){setError('Escribe tu nombre para solicitar el servicio.');setServiceBusy(false);return;}
    try {
      const {error:insertError}=await supabase.rpc('storefront_request_service_order',{p_business_id:business.id,p_service_id:serviceRequest.id,p_customer_name:customerName,p_scheduled_at:scheduled?new Date(scheduled).toISOString():null,p_notes:notes||null});
      if(insertError)throw insertError;
      setServiceRequest(null);setServiceSuccess(true);
    } catch(err) { setError(err instanceof Error?err.message:'No fue posible enviar la solicitud.'); }
    finally { setServiceBusy(false); }
  };
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
          privacy_consent: form.get('aceptaPrivacidad') === 'on',
          privacy_policy_version: '1.0',
          items: cartItems.map(x => ({
            product_id: x.p.id,
            quantity: x.cantidad,
            variant_selections: x.variantes.map(selected => ({ value_id: selected.choice.id, quantity: selected.cantidad })),
            addon_value_ids: x.complementos.map(choice => choice.id)
          }))
        }
      });
      if (createError) {
        let message = 'No fue posible registrar el pedido. Intenta nuevamente.';
        try {
          const response = (createError as { context?: Response }).context;
          if (response && typeof response.clone === 'function') {
            const payload = await response.clone().json();
            if (typeof payload?.error === 'string' && payload.error.trim()) message = payload.error;
          }
        } catch { /* Conserva el mensaje seguro si la respuesta no contiene JSON. */ }
        throw new Error(message);
      }
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
  const renderStoreProduct = (p: Product, i: number) => <article className={"public-product public-product-" + settings.card_style} key={p.id} data-testid={"card-store-product-" + p.id}><div className={"public-product-art public-art-" + (i % 5)} role="button" tabIndex={0} aria-label={"Ver " + p.nombre} onClick={() => openProduct(p)} onKeyDown={e => { if(e.key === 'Enter' || e.key === ' '){e.preventDefault();openProduct(p);} }}>{p.imagen ? <img className="public-product-image" src={p.imagen} alt={p.nombre} loading="lazy"/> : <b className="public-product-placeholder">{p.nombre.slice(0, 1)}</b>}<span>{p.destacado ? 'DESTACADO' : cats.find(c => c.id === p.category_id)?.nombre}</span><button onClick={e => {e.stopPropagation();addItem(p)}} aria-label={"Agregar " + p.nombre} data-testid={"button-add-" + p.id}><Plus size={19} /></button><em className="product-view-hint">Ver producto <ArrowRight size={13}/></em></div><div className="public-product-info"><div><button className="product-title-button" onClick={() => openProduct(p)}>{p.nombre}</button><p>{p.descripcion}</p><b className="product-current-price">{money(p.precio)}</b>{p.precio_anterior && <del>{money(p.precio_anterior)}</del>}</div>{cart[p.id] ? <div className="quantity-control"><button onClick={() => setQty(p.id, cart[p.id] - 1)} aria-label="Quitar uno">−</button><b>{cart[p.id]}</b><button onClick={() => addItem(p)} aria-label="Agregar uno más">+</button></div> : <button className="add-mobile" onClick={() => addItem(p)}>Agregar <Plus size={14} /></button>}</div></article>;
  if (business.estado !== 'activo' || !settings?.publicado) return <div className="store-unavailable"><Brand /><div><span className="eyebrow">VITRINA NO DISPONIBLE</span><h1>Esta tienda está en pausa.</h1><p>Vuelve a visitarla más adelante.</p><Link href="/" className="btn btn-outline">Conocer CLICKOK</Link></div><small>CLICKOK · Catálogos digitales y pedidos</small></div>;
  return <div className={`public-store public-layout-${settings.layout} public-cards-${settings.card_style} public-buttons-${settings.button_style}`} style={{ '--store-color': settings.color, '--store-background': settings.background_color || '#f7f7f5', '--store-card-background': settings.card_background_color || '#ffffff', '--store-text':storefrontContrast(settings.background_color || '#f7f7f5').text, '--store-muted':storefrontContrast(settings.background_color || '#f7f7f5').muted, '--store-card-text':storefrontContrast(settings.card_background_color || '#ffffff').text, '--store-card-muted':storefrontContrast(settings.card_background_color || '#ffffff').muted, '--store-accent-text':storefrontContrast(settings.color).accentText, fontFamily: settings.fuente==='Georgia'?'Georgia,serif':settings.fuente==='Arial'?'Arial,sans-serif':settings.fuente==='DM Sans'?'DM Sans,sans-serif':'Manrope,sans-serif' } as React.CSSProperties}><header className="public-header"><Brand /><div className="public-header-actions"><Link href="/track" className="public-track-link">Rastrear mi pedido</Link><span className="public-powered">UNA TIENDA DE <b>CLICKOK</b></span></div></header><section className="public-hero"><div className="public-cover" style={settings.portada ? { backgroundImage: `url("${settings.portada}")` } : undefined}><span className="cover-kicker">CATÁLOGO DIGITAL</span><span className="cover-shop-name">{business.nombre}</span></div><div className="public-store-intro"><div className="public-logo">{settings.logo ? <img src={settings.logo} alt={`Logo de ${business.nombre}`} /> : business.nombre.charAt(0)}</div><div><h1>{business.nombre}</h1><p>{settings.tagline || 'Una tienda local que te atiende de cerca.'}</p></div><span className="open-label"><i /> Abierto</span></div><div className="public-store-details">{settings.direccion&&<div><MapPin size={15}/><span>{settings.direccion}</span></div>}{settings.tiempo_entrega&&<div><Clock3 size={15}/><span>Entrega <b>{settings.tiempo_entrega}</b></span></div>}</div></section><main className="public-main"><div className="public-toolbar"><label className="search-field"><Search size={17} /><input placeholder="Busca algo que te guste..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-store-search" /></label>{cartItems.length > 0 && <button className="cart-button" onClick={() => setCheckout(true)} data-testid="button-open-cart"><ShoppingCart size={17} /><span>{Object.values(cart).reduce((a, n) => a + n, 0)}</span>{money(subtotal)}</button>}</div><div className="public-categories"><button className={category === 'todos' ? 'category-active' : ''} onClick={() => setCategory('todos')}>Todo el catálogo</button>{cats.map(c => <button key={c.id} className={category === c.id ? 'category-active' : ''} onClick={() => setCategory(c.id)}>{c.nombre}</button>)}</div><div className="public-section-title"><span className="eyebrow">{category === 'todos' ? 'HECHO PARA TI' : cats.find(c => c.id === category)?.nombre}</span><h2>{search ? 'Resultados' : category === 'todos' ? 'Lo que se te antoje.' : 'Escoge tu favorito.'}</h2></div>{storeServices.length>0&&<section className="public-services"><div className="public-section-title"><span className="eyebrow">SERVICIOS DISPONIBLES</span><h2>También puedes reservar.</h2></div><div className="public-service-grid">{storeServices.map(service=><article className="public-service-card" key={service.id}><div><b>{service.name}</b><p>{service.description||'Servicio disponible en este comercio.'}</p>{service.duration_minutes&&<small>{service.duration_minutes} minutos</small>}</div><strong>{money(service.price)}</strong><button type="button" className="btn btn-solid" onClick={()=>{setServiceRequest({id:service.id,name:service.name,price:service.price});setError('');}}>Solicitar servicio</button></article>)}</div></section>}{category === 'todos' && !search ? <div className="public-storefront-sections">{featuredProducts.length > 0 && <section className="public-featured-section"><div className="public-category-heading"><div><span className="eyebrow">HECHO PARA TI</span><h2>Populares</h2></div></div><div className="public-featured-track">{featuredProducts.map((p,i)=>renderStoreProduct(p,i))}</div></section>}{cats.map(c=>{const categoryProducts=products.filter(p=>p.category_id===c.id);return categoryProducts.length>0?<section className="public-category-section" key={c.id}><div className="public-category-heading"><div><span className="eyebrow">DESCUBRE</span><h2>{c.nombre}</h2></div><button type="button" onClick={()=>setCategory(c.id)}>Ver todos <ArrowRight size={14}/></button></div><div className={"public-products public-products-" + settings.layout}>{categoryProducts.map((p,i)=>renderStoreProduct(p,i))}</div></section>:null;})}</div> : products.length ? <div className={"public-products public-products-" + settings.layout}>{products.map((p,i)=>renderStoreProduct(p,i))}</div> : <Empty title="No encontramos eso" text="Prueba con otra palabra o categoría." />}
    </main><footer className="public-footer"><span>{settings.redes}</span><span>Pedidos directos, cerca de ti.</span><div className="store-legal-links"><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/terminos">Términos</Link></div><Brand /><a className="atomlabs-credit" href="https://atomlabs.lat/#top" target="_blank" rel="noreferrer"><span>DESARROLLADO POR</span><b><svg className="atomlabs-symbol" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round"><ellipse cx="32" cy="32" rx="12" ry="27"/><ellipse cx="32" cy="32" rx="12" ry="27" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="12" ry="27" transform="rotate(120 32 32)"/></g><circle cx="32" cy="32" r="4.2" fill="currentColor"/></svg>ATOMLABS<sup>®</sup></b></a></footer>
    {success && <div className="modal-backdrop"><section className="success-modal"><div className="success-icon"><Check size={24} /></div><span className="eyebrow">PEDIDO ENVIADO</span><h2>¡Ya lo tenemos!</h2><p>Tu pedido <b>#{String(Math.max(0, ...data.orders.filter(o => o.business_id === business.id).map(o => o.numero))).padStart(3, '0')}</b> se envió a {business.nombre}. Puedes consultar sus cambios de estado desde aquí.</p>{trackingToken && <div className="tracking-success-actions"><Link className="btn btn-solid" href={`/track/${trackingToken}`}>Rastrear mi pedido <ArrowRight size={15} /></Link><a className="btn btn-outline" href={`https://wa.me/?text=${encodeURIComponent(`Sigue tu pedido en ${business.nombre}: ${window.location.origin}/track/${trackingToken}`)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a></div>}<Button kind="ghost" onClick={() => setSuccess(false)}>Seguir mirando <ArrowRight size={15} /></Button></section></div>}
    {configuring && <Modal title={configuring.nombre} close={() => setConfiguring(null)}>
      <div className="product-config">
        {configuring.imagen && <img className="product-detail-image" src={configuring.imagen} alt={configuring.nombre}/>}<p className="subtle">{configuring.descripcion}</p><div className="product-detail-price">{money(configuring.precio)}</div>
        {!!configuring.variantes?.length && <section className="field"><span>Variantes</span><div data-testid="product-additions-grid" className="product-extras-compact">{configuring.variantes.map(choice => { const quantity = variantQuantities[choice.id] || 0; const selected = quantity > 0; return <div key={choice.id} className={`product-extra-compact ${selected?'is-selected':''}`}><div className="product-extra-copy"><b>{choice.nombre}</b><small>{choice.precio_extra ? `+${money(choice.precio_extra)} c/u` : 'Precio base'}</small>{selected && <small className="product-extra-subtotal">Extra subtotal {money(choice.precio_extra * quantity)}</small>}</div><div className="product-extra-controls"><button type="button" aria-label={`Quitar una unidad de ${choice.nombre}`} disabled={!selected} onClick={() => setVariantQuantities(current => ({...current,[choice.id]:Math.max(0,(current[choice.id]||0)-1)}))} data-testid={`button-variant-minus-${choice.id}`}>−</button><b aria-live="polite">{quantity}</b><button type="button" aria-label={`Agregar una unidad de ${choice.nombre}`} onClick={() => setVariantQuantities(current => ({...current,[choice.id]:(current[choice.id]||0)+1}))} data-testid={`button-variant-plus-${choice.id}`}>+</button></div></div>})}</div></section>}
        {!!configuring.complementos?.length && <fieldset className="choice-list"><legend>{isFoodBusiness(business.tipo) ? 'Adiciones y extras' : 'Accesorios y complementos'}</legend><div data-testid="product-extras-grid" className="product-extras-compact">{configuring.complementos.map(choice => { const quantity = addonQuantities[choice.id] || 0; const selected = quantity > 0; return <div key={choice.id} className={`product-extra-compact ${selected?'is-selected':''}`}><div className="product-extra-copy"><b>{choice.nombre}</b><small>{choice.precio_extra ? `+${money(choice.precio_extra)} c/u` : 'Incluido'}</small>{selected && <small className="product-extra-subtotal">Subtotal {money(choice.precio_extra * quantity)}</small>}</div><div className="product-extra-controls"><button type="button" aria-label={`Quitar una unidad de ${choice.nombre}`} disabled={!selected} onClick={() => setAddonQuantities(current => ({...current,[choice.id]:Math.max(0,(current[choice.id]||0)-1)}))} data-testid={`button-addon-minus-${choice.id}`}>−</button><b aria-live="polite">{quantity}</b><button type="button" aria-label={`Agregar una unidad de ${choice.nombre}`} onClick={() => setAddonQuantities(current => ({...current,[choice.id]:(current[choice.id]||0)+1}))} data-testid={`button-addon-plus-${choice.id}`}>+</button></div></div>})}</div></fieldset>}
        {!configuring.variantes?.length && !configuring.complementos?.length && <div className="notice notice-info">Este producto no tiene opciones adicionales.</div>}
        <div className="checkout-total"><span>Total</span><b>{money(configuring.precio + (configuring.variantes || []).reduce((sum, choice) => sum + choice.precio_extra * (variantQuantities[choice.id] || 0), 0) + (configuring.complementos || []).reduce((sum, choice) => sum + choice.precio_extra * (addonQuantities[choice.id] || 0), 0))}</b></div>
        <div className="modal-actions"><Button kind="ghost" onClick={() => setConfiguring(null)}>Cancelar</Button><Button onClick={() => confirmConfiguredItem(configuring)} data-testid="button-add-configured-product">Agregar al carrito <Plus size={15} /></Button></div>
      </div>
    </Modal>}
    {serviceSuccess&&<Modal title="Solicitud enviada" close={()=>setServiceSuccess(false)}><div className="notice notice-success">Tu solicitud fue enviada al comercio. El servicio quedó pendiente de pago y podrá cobrarse desde su punto de venta.</div><div className="modal-actions"><Button onClick={()=>setServiceSuccess(false)}>Entendido</Button></div></Modal>}
     {serviceRequest&&<Modal title={`Solicitar ${serviceRequest.name}`} close={()=>setServiceRequest(null)}><form className="checkout-form" onSubmit={submitServiceRequest}><div className="checkout-total"><span>Valor del servicio</span><b>{money(serviceRequest.price)}</b></div><label className="field"><span>Tu nombre *</span><input name="service_customer_name" required maxLength={120}/></label><label className="field"><span>Fecha y hora preferida (opcional)</span><input name="service_scheduled_at" type="datetime-local"/></label><label className="field"><span>Notas (opcional)</span><textarea name="service_notes" maxLength={1000}/></label>{error&&<div className="notice notice-error">{error}</div>}<p className="fine-print">La solicitud quedará pendiente de pago. El comercio confirmará la disponibilidad.</p><div className="modal-actions"><Button kind="ghost" onClick={()=>setServiceRequest(null)}>Cancelar</Button><Button type="submit" disabled={serviceBusy}>{serviceBusy?'Enviando…':'Enviar solicitud'}</Button></div></form></Modal>}
     {checkout && <Modal title="Tu pedido" close={() => setCheckout(false)}><form className="checkout-form" onSubmit={submitOrder}>
      <div className="checkout-items">{cartItems.map(x => <div key={x.key}><span><b>{x.cantidad} × {x.p.nombre}</b><small>{[...x.variantes.map(selected => `${selected.choice.nombre} ×${selected.cantidad}`), ...x.complementos.map(choice => `+ ${choice.nombre}`)].filter(Boolean).join(' · ') || 'Sin opciones'} · {money(itemUnitPrice(x))} c/u</small></span><div className="quantity-control"><button type="button" onClick={() => setQty(x.key, x.cantidad - 1)}>−</button><b>{x.cantidad}</b><button type="button" onClick={() => setQty(x.key, x.cantidad + 1)}>+</button></div><strong>{money(itemUnitPrice(x) * x.cantidad)}</strong></div>)}</div>
      <div className="checkout-total"><span>Total</span><b>{money(subtotal)}</b></div>{error && <div className="notice notice-error">{error}</div>}
      <div className="form-grid">
        <label className="field"><span>Tu nombre *</span><input required name="nombre" autoComplete="name" data-testid="input-checkout-name" /></label>
        <label className="field"><span>Teléfono *</span><input required name="telefono" type="tel" autoComplete="tel" data-testid="input-checkout-phone" /></label>
        <label className="field"><span>¿Cómo lo recibes?</span><select name="entrega" value={delivery} onChange={e => setDelivery(e.target.value as 'domicilio' | 'recoger')} data-testid="select-checkout-delivery"><option value="domicilio">Domicilio</option><option value="recoger">Recoger en tienda</option></select></label>
        <label className="field"><span>Dirección{delivery === 'domicilio' ? ' *' : ' (opcional)'}</span><input required={delivery === 'domicilio'} name="direccion" placeholder={delivery === 'domicilio' ? 'Calle, carrera, barrio...' : 'No se requiere para recoger'} data-testid="input-checkout-address" /></label>
        <label className="field"><span>Método de pago</span><select name="metodo_pago" data-testid="select-checkout-payment">{settings.pagos.split(',').map(x => <option key={x}>{x.trim()}</option>)}</select></label>
        <label className="field"><span>Observaciones</span><textarea name="observaciones" placeholder="¿Alguna indicación para tu pedido?" data-testid="input-checkout-notes" /></label>
      </div>
      <label className="legal-consent"><input type="checkbox" name="aceptaPrivacidad" required/><span>He leído la <Link href="/legal/privacidad" target="_blank">Política de tratamiento de datos de CLICKOK</Link>. Entiendo que mis datos del pedido serán compartidos con <strong>{business.nombre}</strong> para gestionar la compra, entrega y atención.</span></label><p className="fine-print">No necesitas crear una cuenta. {business.nombre} confirmará contigo los detalles de pago y entrega.</p>
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
    <footer className="sa-login-footer">CLICKOK <span>•</span> ATOM LABS <span>•</span> ADMINISTRACIÓN SEGURA</footer>
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

const sectorChoices = [
  { value: 'restaurante', label: 'Restaurante', detail: 'Menús, pedidos y operación gastronómica', icon: '🍽️' },
  { value: 'veterinaria', label: 'Veterinaria', detail: 'Servicios, pacientes y productos para mascotas', icon: '🐾' },
  { value: 'tienda de ropa', label: 'Tienda de ropa', detail: 'Prendas, tallas, colores y colecciones', icon: '👕' },
  { value: 'tecnologia', label: 'Tecnología', detail: 'Equipos, referencias y accesorios', icon: '💻' },
  { value: 'minimercado', label: 'Minimercado', detail: 'Productos de consumo e inventario', icon: '🛒' },
  { value: 'servicios', label: 'Servicios', detail: 'Agenda y servicios de tu negocio', icon: '🧰' },
  { value: 'otro', label: 'Otro tipo de negocio', detail: 'Configura tu operación con módulos generales', icon: '✳️' },
] as const;

function BusinessSectorOnboarding({ businessId, onComplete }: { businessId: string; onComplete: () => void }) {
  const [selected, setSelected] = useState<string>('restaurante');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('configure_business_sector', {
        p_business_id: businessId,
        p_business_type: selected,
      });
      if (rpcError) throw rpcError;
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible configurar el sector. Inténtalo nuevamente.');
    } finally { setBusy(false); }
  };
  return <main className="sector-onboarding">
    <div className="sector-onboarding-card">
      <span className="eyebrow">CONFIGUREMOS TU ESPACIO</span>
      <h1>¿Qué tipo de negocio tienes?</h1>
      <p>Adaptaremos tu panel y activaremos las herramientas que necesitas. Podrás seguir usando los módulos comunes de CLICKOK.</p>
      <div className="sector-choice-grid">
        {sectorChoices.map(choice => <button type="button" key={choice.value} className={selected === choice.value ? 'sector-choice selected' : 'sector-choice'} onClick={() => setSelected(choice.value)} aria-pressed={selected === choice.value}>
          <span className="sector-choice-icon">{choice.icon}</span><span className="sector-choice-copy"><b>{choice.label}</b><small>{choice.detail}</small></span>{selected === choice.value && <CheckCircle2 size={19}/>}
        </button>)}
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <Button className="full-btn" disabled={busy} onClick={() => void submit()}>{busy ? 'Preparando tu espacio…' : 'Continuar a mi panel'} <ArrowRight size={16}/></Button>
      <small className="sector-onboarding-foot">Puedes cambiar el sector más adelante desde la configuración del negocio.</small>
    </div>
  </main>;
}

function RemoteAccessGate({ context, onLogout }: { context: MenuyaAuthContext; onLogout: () => void }) {
  const membership = context.memberships[0];
  const business = membership?.businesses ?? undefined;
  const [location] = useLocation();
  const [remoteData, setRemoteData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingError, setSavingError] = useState('');
  const [sectorConfigured, setSectorConfigured] = useState<boolean | null>(null);
  const [sectorCheckError, setSectorCheckError] = useState('');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const loadRemoteData = async () => {
    if (!business?.id) return;
    setLoading(true); setLoadError('');
    const [categoryResult, productResult, productOptionsResult, productOptionValuesResult, settingsResult, subscriptionResult, planResult, orderResult, customerResult, catalogEventResult] = await Promise.all([
      supabase.from('categories').select('id,business_id,name,sort_order,is_active').eq('business_id',business.id).order('sort_order'),
      supabase.from('products').select('id,business_id,category_id,name,description,price,previous_price,image_url,is_active,is_available,is_featured,stock').eq('business_id',business.id).order('created_at',{ascending:false}),
      supabase.from('product_options').select('id,business_id,product_id,name,option_type,is_required,sort_order').eq('business_id',business.id).order('sort_order'),
      supabase.from('product_option_values').select('id,business_id,option_id,name,extra_price,is_active,sort_order').eq('business_id',business.id).eq('is_active',true).order('sort_order'),
      supabase.from('store_settings').select('business_id,cover_url,logo_url,brand_color,background_color,card_background_color,font_family,contact_text,social_links,payment_methods,delivery_info,is_published,tagline,storefront_layout,product_card_style,button_style').eq('business_id',business.id).maybeSingle(),
      supabase.from('subscriptions').select('id,business_id,plan_id,status,starts_at,ends_at,plans(id,name,price,billing_period,max_products,features,is_active)').eq('business_id',business.id).maybeSingle(),
      supabase.from('plans').select('id,code,name,price,billing_period,max_products,features,is_active').eq('is_active',true).order('price'),
      supabase.from('orders').select('id,business_id,customer_id,order_number,status,fulfillment_type,delivery_address,notes,payment_method,total,created_at,order_items!order_items_order_id_fkey(product_id,product_name,unit_price,quantity,variant_name,addons_snapshot)').eq('business_id',business.id).order('created_at',{ascending:false}),
      supabase.from('customers').select('id,business_id,name,phone,total_orders,total_spent,last_order_at').eq('business_id',business.id).order('last_order_at',{ascending:false}),
      supabase.from('catalog_events').select('id,business_id,product_id,event_type,created_at').eq('business_id',business.id).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).order('created_at',{ascending:false}),
    ]);
    const firstError = categoryResult.error || productResult.error || productOptionsResult.error || productOptionValuesResult.error || settingsResult.error || subscriptionResult.error || planResult.error || orderResult.error || customerResult.error || catalogEventResult.error;
    if (firstError) { setLoadError(firstError.message); setLoading(false); return; }
    const profileName = context.profile?.full_name || String(context.user.user_metadata?.full_name || context.user.email || 'Comercio');
    const biz = {
      id: business.id, owner_id: context.user.id, nombre: business.name, slug: business.slug,
      tipo: business.business_type, telefono: context.profile?.phone || '', estado: ({pending:'pendiente',active:'activo',rejected:'rechazado',suspended:'suspendido'} as Record<string, Business['estado']>)[business.status] || 'pendiente',
      created_at: new Date().toISOString(),
    };
    const categories: Category[] = (categoryResult.data || []).map(c => ({id:c.id,business_id:c.business_id,nombre:c.name,orden:c.sort_order,activo:c.is_active}));
    const products: Product[] = (productResult.data || []).map(p => {
      const groups = (productOptionsResult.data || []).filter(group => group.product_id === p.id);
      const values = (group: any) => (productOptionValuesResult.data || []).filter(value => value.option_id === group.id).map(value => ({id:value.id,nombre:value.name,precio_extra:Number(value.extra_price || 0)}));
      const variants = groups.filter(group => ['variant','variants','variante','variantes'].includes(String(group.option_type).toLowerCase())).flatMap(values);
      const addons = groups.filter(group => ['addon','addons','extra','extras','complemento','complementos'].includes(String(group.option_type).toLowerCase())).flatMap(values);
      return {id:p.id,business_id:p.business_id,category_id:p.category_id || '',nombre:p.name,descripcion:p.description || '',precio:Number(p.price),precio_anterior:p.previous_price ? Number(p.previous_price) : undefined,imagen:p.image_url || undefined,activo:p.is_active,disponible:p.is_available,destacado:p.is_featured,stock:p.stock ?? 0,variantes:variants,complementos:addons};
    });
    const s = settingsResult.data;
    const settings: StoreSettings = {
      business_id:business.id,portada:s?.cover_url || '',logo:s?.logo_url || '',color:s?.brand_color || '#7352e8',background_color:s?.background_color || '#f7f7f5',card_background_color:s?.card_background_color || '#ffffff',
      fuente:s?.font_family || 'Manrope',contacto:s?.contact_text || biz.telefono,redes:typeof s?.social_links === 'string' ? s.social_links : '',
      pagos:Array.isArray(s?.payment_methods) ? s.payment_methods.join(', ') : 'Efectivo, Nequi, transferencia',
      entrega:parseStoreDelivery(s?.delivery_info).methods,direccion:parseStoreDelivery(s?.delivery_info).address,tiempo_entrega:parseStoreDelivery(s?.delivery_info).time,publicado:Boolean(s?.is_published && business.is_published),tagline:s?.tagline || 'Tu negocio, en su propio lugar.',layout:s?.storefront_layout || 'grid',card_style:s?.product_card_style || 'classic',button_style:s?.button_style || 'rounded',
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
      plans:allPlans.some(item => item.id === plan.id) ? allPlans : [...allPlans, plan],
      subscriptions:sub ? [{id:sub.id,business_id:sub.business_id,plan_id:sub.plan_id,estado:sub.status,inicio:sub.starts_at || '',vencimiento:sub.ends_at || ''}] : [],
      settings:[settings],audit:[],catalog_events:(catalogEventResult.data || []).map(event => ({id:event.id,business_id:event.business_id,product_id:event.product_id || undefined,tipo:event.event_type === 'visit' ? 'visita' as const : 'consulta' as const,created_at:event.created_at})),platform:{name:'CLICKOK',approval:'manual',default_plan:plan.id},
    };
    setRemoteData(data); setLoading(false);
  };
  useEffect(() => { void loadRemoteData(); }, [business?.id]);
  useEffect(() => {
    let active = true;
    if (!business?.id || sectorConfigured !== true) return;
    supabase.from('business_modules').select('module_key').eq('business_id',business.id).eq('enabled',true).then(({data,error}) => {
      if (!active) return;
      if (error) { setSectorCheckError(error.message); return; }
      setEnabledModules((data || []).map(row => row.module_key));
    });
    return () => { active = false; };
  }, [business?.id,sectorConfigured]);
  useEffect(() => {
    let active = true;
    if (!business?.id) return;
    supabase.from('businesses').select('sector_configured_at').eq('id', business.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setSectorCheckError(error.message); setSectorConfigured(false); return; }
        setSectorConfigured(Boolean(data?.sector_configured_at));
      });
    return () => { active = false; };
  }, [business?.id]);

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
          if (!oldProducts.has(id) || JSON.stringify(before?.variantes || []) !== JSON.stringify(item.variantes || []) || JSON.stringify(before?.complementos || []) !== JSON.stringify(item.complementos || [])) {
            const oldGroups = await supabase.from('product_options').select('id').eq('product_id',id).eq('business_id',business.id);
            if (oldGroups.error) throw oldGroups.error;
            const oldGroupIds = (oldGroups.data || []).map(group => group.id);
            if (oldGroupIds.length) {
              const removed = await supabase.from('product_options').delete().in('id',oldGroupIds).eq('business_id',business.id);
              if (removed.error) throw removed.error;
            }
            for (const [optionType, optionName, choices] of [['variant','Variantes',item.variantes || []],['addon','Adiciones y extras',item.complementos || []]] as const) {
              if (!choices.length) continue;
              const groupResult = await supabase.from('product_options').insert({business_id:business.id,product_id:id,name:optionName,option_type:optionType,is_required:optionType === 'variant',sort_order:optionType === 'variant' ? 0 : 1}).select('id').single();
              if (groupResult.error) throw groupResult.error;
              const valueResult = await supabase.from('product_option_values').insert(choices.map((choice,index)=>({business_id:business.id,option_id:groupResult.data.id,name:choice.nombre,extra_price:choice.precio_extra || 0,is_active:true,sort_order:index})));
              if (valueResult.error) throw valueResult.error;
            }
          }
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
            background_color:nextSettings.background_color || '#f7f7f5',
            card_background_color:nextSettings.card_background_color || '#ffffff',
            font_family:nextSettings.fuente,
            contact_text:nextSettings.contacto || null,
            social_links:nextSettings.redes ?? '',
            payment_methods:nextSettings.pagos ? nextSettings.pagos.split(',').map(x=>x.trim()).filter(Boolean) : [],
            delivery_info:JSON.stringify({methods:nextSettings.entrega || '',address:nextSettings.direccion || '',time:nextSettings.tiempo_entrega || ''}),
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
        console.error('CLICKOK: error guardando la vitrina en Supabase', error);
        setSavingError(message + errorCode);
        await loadRemoteData();
      }
    });
  };
  if (!business) return <div className="auth-layout"><main className="auth-main"><div className="auth-form-wrap"><h2>{context.isPlatformAdmin ? 'Acceso de plataforma' : 'Cuenta autenticada'}</h2><div className="notice notice-error">No encontramos un comercio vinculado a esta cuenta. No se crearán datos de demostración.</div><Button className="full-btn" onClick={onLogout}>Cerrar sesión <LogOut size={16}/></Button></div></main></div>;
  if (loading) return <MerchantDashboardSkeleton />;
  if (sectorConfigured === null) return <MerchantDashboardSkeleton />;
  if (sectorCheckError) return <div className="auth-form-wrap"><div className="notice notice-error">No fue posible verificar la configuración del negocio: {sectorCheckError}</div><Button onClick={() => window.location.reload()}>Reintentar</Button></div>;
  if (sectorConfigured === false) return <BusinessSectorOnboarding businessId={business.id} onComplete={() => { setSectorConfigured(true); void loadRemoteData(); }} />;
  if (loadError || !remoteData) return <div className="auth-form-wrap"><div className="notice notice-error">{loadError || 'No fue posible cargar el comercio.'}</div><Button onClick={() => void loadRemoteData()}>Reintentar</Button></div>;
  const session: Session = {userId:context.user.id,role:'owner'};
  return <AppShell data={remoteData} session={session} update={updateRemote} logout={onLogout} business={remoteData.businesses[0]} activePath={location} modules={enabledModules}>
    {savingError && <div className="notice notice-error" role="alert">{savingError}</div>}
    <MerchantPage path={location} data={remoteData} business={remoteData.businesses[0]} update={updateRemote} modules={enabledModules} />
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
    if (!isSupabaseConfigured) return 'La conexión de CLICKOK aún no está configurada en este entorno.';
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
    if (!isSupabaseConfigured) return 'La conexión de CLICKOK aún no está configurada en este entorno.';
    if (v.aceptaDatos !== 'on') return 'Debes aceptar la política de tratamiento de datos y los términos para crear tu cuenta.';
    try {
      const result = await signUpWithEmail({
        email: v.email,
        password: v.password,
        fullName: v.nombre,
        phone: v.telefono,
        businessName: v.negocio,
        businessType: v.sector,
        privacyPolicyVersion: '1.0',
        privacyConsentAt: new Date().toISOString(),
        termsVersion: '1.0',
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
    if (!isSupabaseConfigured) return 'La conexión de CLICKOK aún no está configurada en este entorno.';
    try { await updatePassword(password); return null; }
    catch (error) { return error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.'; }
  };

  const forgot = async (email: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'La conexión de CLICKOK aún no está configurada en este entorno.';
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
    <Route path="/legal/privacidad"><LegalPages document="privacy" /></Route>
    <Route path="/legal/terminos"><LegalPages document="terms" /></Route>
    <Route path="/admin/login"><PlatformAdminLogin onLogin={login} /></Route>
    <Route path="/login"><AuthPage mode="login" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/register"><AuthPage mode="register" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/forgot-password"><AuthPage mode="forgot" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/reset-password"><AuthPage mode="reset" data={data} onLogin={login} onRegister={register} onForgot={forgot} onReset={reset} /></Route>
    <Route path="/admin">{authLoading ? <div className="auth-loading"><span className="loader-line" />Comprobando acceso...</div> : remoteContext?.isPlatformAdmin ? <PlatformAdminPage context={remoteContext} onLogout={logout} /> : remoteContext ? <div className="auth-form-wrap"><div className="notice notice-error">Esta cuenta no tiene permisos de Superadmin.</div><Button onClick={logout}>Cerrar sesión</Button></div> : protectedRoute()}</Route>
    {adminLinks.slice(1).map(([path]) => <Route key={path} path={path}>{authLoading ? <div className="auth-loading"><span className="loader-line" />Comprobando acceso...</div> : remoteContext?.isPlatformAdmin ? <PlatformAdminPage context={remoteContext} onLogout={logout} /> : remoteContext ? <div className="auth-form-wrap"><div className="notice notice-error">Esta cuenta no tiene permisos de Superadmin.</div><Button onClick={logout}>Cerrar sesión</Button></div> : protectedRoute()}</Route>)}
    <Route path="/waiter/:slug"><WaiterPortal /></Route>
    <Route path="/repartidor"><CourierPortal /></Route>
    <Route path="/track"><TrackingPage /></Route>
    <Route path="/track/:token"><TrackingRoute /></Route>
    <Route path="/app">{protectedRoute()}</Route>
    {shopLinks.slice(1).map(([path]) => <Route key={path} path={path}>{protectedRoute()}</Route>)}
    <Route path="/app/pos">{protectedRoute()}</Route>
    <Route path="/app/couriers">{protectedRoute()}</Route>
    <Route path="/app/restaurant">{protectedRoute()}</Route>
    <Route path="/app/veterinary">{protectedRoute()}</Route>
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
  const [trackingActive, setTrackingActive] = useState(false);
  const lookup = async (value: string) => {
    const clean = value.trim();
    if (!clean) { setError('Ingresa el enlace o código de seguimiento.'); return; }
    setLoading(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-order-tracking', { body: { token: clean } });
      if (invokeError) throw invokeError;
      if (!data?.order) throw new Error('No encontramos un pedido con ese código.');
      setOrder(data.order);
      setTrackingActive(true);
    } catch (e) {
      setTrackingActive(false);
      setOrder(null);
      setError(e instanceof Error ? e.message : 'No fue posible consultar el pedido.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!initialToken) return;
    setToken(initialToken);
    void lookup(initialToken);
  }, [initialToken]);
  useEffect(() => {
    if (!trackingActive || !token.trim()) return;
    const timer = window.setInterval(() => { void lookup(token); }, 8000);
    return () => window.clearInterval(timer);
  }, [trackingActive, token]);
  const steps = [
    { key: 'pending', label: 'Recibido', detail: 'Tu pedido llegó a la tienda', icon: '01' },
    { key: 'preparing', label: 'En preparación', detail: 'La tienda está preparando tu pedido', icon: '02' },
    { key: 'ready', label: 'Listo', detail: 'Tu pedido está listo', icon: '03' },
    { key: 'delivered', label: 'Entregado', detail: 'Pedido completado', icon: '04' },
    { key: 'cancelled', label: 'Cancelado', detail: 'Este pedido fue cancelado', icon: '×' },
  ];
  const status = order?.status || '';
  const currentKey = status === 'confirmed' ? 'preparing'
    : status === 'out_for_delivery' ? 'ready' : status;
  const current = steps.findIndex(step => step.key === currentKey);
  const isCancelled = currentKey === 'cancelled';
  const copyTrackingCode = async () => {
    try { await navigator.clipboard.writeText(token); }
    catch { setError('No fue posible copiar el código. Puedes seleccionarlo manualmente.'); }
  };
  return <main className="tracking-page"><div className="tracking-card"><Brand /><span className="eyebrow">CLICKOK · SEGUIMIENTO</span><h1>Rastrea tu pedido</h1><p className="subtle">Consulta el estado actualizado de tu compra sin crear una cuenta.</p>
    {!initialToken && <form className="tracking-form" onSubmit={e => { e.preventDefault(); void lookup(token); }}><label className="field"><span>Código o enlace de seguimiento</span><input value={token} onChange={e => { setToken(e.target.value); setTrackingActive(false); }} placeholder="Pega aquí tu código" /></label><Button type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Consultar pedido'}</Button></form>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {order && <section className="tracking-result">
      <div className="tracking-order-heading"><span className="eyebrow">{order.business_name}</span><h2>Pedido #{String(order.order_number).padStart(3, '0')}</h2></div>
      <div className="tracking-code-panel"><div><span className="tracking-code-label">CÓDIGO DE SEGUIMIENTO</span><strong title={token}>{token}</strong></div><button type="button" className="tracking-copy-button" onClick={() => void copyTrackingCode()} aria-label="Copiar código de seguimiento">Copiar código</button></div>
      <div className={`tracking-3d-track ${isCancelled ? 'is-cancelled' : ''}`} aria-label={`Estado actual: ${steps[Math.max(current, 0)].label}`}>
        <div className="tracking-track-orbit" aria-hidden="true" />
        <ol className="tracking-3d-stages">{steps.map((step, i) => <li key={step.key} className={`tracking-3d-stage ${i === current ? 'is-current' : i < current && !isCancelled ? 'is-complete' : ''} ${step.key === 'cancelled' ? 'is-alternative' : ''}`}>
          <span className="tracking-3d-node">{i < current && !isCancelled ? '✓' : step.icon}</span><strong>{step.label}</strong><small>{step.detail}</small>
        </li>)}</ol>
      </div>
      <div className="tracking-current-state"><span className="tracking-live-dot" /><div><small>ESTADO ACTUAL</small><strong>{isCancelled ? 'Pedido cancelado' : (steps[current]?.label || 'Pedido recibido')}</strong></div></div>
      <small className="tracking-updated">Última actualización: {new Date(order.updated_at || order.created_at).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}</small>
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
        const [categoryResult, productResult, productOptionsResult, productOptionValuesResult, settingsResult] = await Promise.all([
          supabase.from('categories').select('id,business_id,name,sort_order,is_active').eq('business_id',businessRow.id).eq('is_active',true).order('sort_order'),
          supabase.from('products').select('id,business_id,category_id,name,description,price,previous_price,image_url,is_active,is_available,is_featured,stock').eq('business_id',businessRow.id).eq('is_active',true).eq('is_available',true).order('created_at',{ascending:false}),
          supabase.from('product_options').select('id,business_id,product_id,name,option_type,is_required,sort_order').eq('business_id',businessRow.id).order('sort_order'),
          supabase.from('product_option_values').select('id,business_id,option_id,name,extra_price,is_active,sort_order').eq('business_id',businessRow.id).eq('is_active',true).order('sort_order'),
          supabase.from('store_settings').select('business_id,cover_url,logo_url,brand_color,background_color,card_background_color,font_family,contact_text,social_links,payment_methods,delivery_info,is_published,tagline,storefront_layout,product_card_style,button_style').eq('business_id',businessRow.id).maybeSingle(),
        ]);
        const queryError = categoryResult.error || productResult.error || productOptionsResult.error || productOptionValuesResult.error || settingsResult.error;
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
          color:row.brand_color || '#252525', background_color:row.background_color || '#f7f7f5', card_background_color:row.card_background_color || '#ffffff', fuente:row.font_family || 'Manrope',
          contacto:row.contact_text || '', redes:typeof row.social_links === 'string' ? row.social_links : JSON.stringify(row.social_links || {}),
          pagos:Array.isArray(row.payment_methods) ? row.payment_methods.join(', ') : 'Efectivo',
          entrega:parseStoreDelivery(row.delivery_info).methods,direccion:parseStoreDelivery(row.delivery_info).address,tiempo_entrega:parseStoreDelivery(row.delivery_info).time, publicado:true, tagline:row.tagline || '',
          layout:row.storefront_layout || 'grid', card_style:row.product_card_style || 'classic', button_style:row.button_style || 'rounded',
        };
        const categories = (categoryResult.data || []).map(c=>({id:c.id,business_id:c.business_id,nombre:c.name,orden:c.sort_order,activo:c.is_active}));
        const products = (productResult.data || []).map(p=>{
          const groups=(productOptionsResult.data || []).filter(group=>group.product_id===p.id);
          const values=(group: any)=>(productOptionValuesResult.data || []).filter(value=>value.option_id===group.id).map(value=>({id:value.id,nombre:value.name,precio_extra:Number(value.extra_price || 0)}));
          const variants=groups.filter(group=>['variant','variants','variante','variantes'].includes(String(group.option_type).toLowerCase())).flatMap(values);
          const addons=groups.filter(group=>['addon','addons','extra','extras','complemento','complementos'].includes(String(group.option_type).toLowerCase())).flatMap(values);
          return {id:p.id,business_id:p.business_id,category_id:p.category_id || '',nombre:p.name,descripcion:p.description || '',precio:Number(p.price),precio_anterior:p.previous_price ? Number(p.previous_price) : undefined,imagen:p.image_url || undefined,activo:p.is_active,disponible:p.is_available,destacado:p.is_featured,stock:p.stock ?? 0,variantes:variants,complementos:addons};
        });
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
