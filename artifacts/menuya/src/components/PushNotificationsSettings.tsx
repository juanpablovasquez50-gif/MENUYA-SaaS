import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './PushNotificationsSettings.css';

type Props = { businessId: string };
type SubscriptionRow = { endpoint: string; preferences: { new_order?: boolean } | null };

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export default function PushNotificationsSettings({ businessId }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const canPush = typeof window !== 'undefined'
        && 'Notification' in window
        && 'serviceWorker' in navigator
        && 'PushManager' in window;
      if (!active) return;
      setSupported(canPush);
      if (!canPush) return;
      setPermission(Notification.permission);
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user || !active) return;
      const { data, error: queryError } = await supabase
        .from('push_subscriptions')
        .select('endpoint,preferences')
        .eq('business_id', businessId)
        .eq('user_id', userResult.user.id);
      if (!active) return;
      if (queryError) { setError('No fue posible consultar el estado de las notificaciones.'); return; }
      setEnabled(Boolean(data?.some((row: SubscriptionRow) => row.preferences?.new_order !== false)));
    };
    void load();
    return () => { active = false; };
  }, [businessId]);

  const activate = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidKey) throw new Error('Falta configurar la clave pública VAPID en el entorno de CLICKOK.');
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') throw new Error('Debes permitir las notificaciones en el navegador.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const subscription = existing || await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(vapidKey),
      });
      const json = subscription.toJSON();
      const keys = json.keys;
      if (!keys?.p256dh || !keys.auth) throw new Error('El navegador no entregó las claves de la suscripción.');
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userResult.user) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: userResult.user.id,
        business_id: businessId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        preferences: { new_order: true },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint,business_id' });
      if (saveError) throw saveError;
      setEnabled(true);
      setNotice('Notificaciones de nuevos pedidos activadas en este dispositivo.');
      void registration;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar las notificaciones.');
    } finally { setBusy(false); }
  };

  const deactivate = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const { error: deleteError } = await supabase.from('push_subscriptions')
          .delete().eq('business_id', businessId).eq('endpoint', endpoint);
        if (deleteError) throw deleteError;
      }
      setEnabled(false);
      setNotice('Notificaciones desactivadas en este dispositivo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible desactivar las notificaciones.');
    } finally { setBusy(false); }
  };

  return <section className="panel push-settings-card">
    <div className="push-settings-heading">
      <span className="push-settings-icon"><Bell size={19}/></span>
      <div><span className="eyebrow">AVISOS EN TIEMPO REAL</span><h2>Notificaciones</h2><p>Recibe un aviso cuando llegue un nuevo pedido a tu vitrina, incluso si CLICKOK no está abierto.</p></div>
    </div>
    {!supported ? <div className="push-settings-note"><Smartphone size={16}/> Este navegador no admite notificaciones push. Prueba con Chrome, Edge, Firefox o Safari compatible.</div>
    : <div className="push-settings-action">
      <div><b>{enabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}</b><small>{permission === 'denied' ? 'El permiso está bloqueado en la configuración del navegador.' : 'La activación se guarda para este comercio y dispositivo.'}</small></div>
      <button className="btn btn-solid" type="button" disabled={busy || permission === 'denied'} onClick={() => void (enabled ? deactivate() : activate())}>
        {busy ? <Loader2 size={16} className="push-spin"/> : enabled ? <BellOff size={16}/> : <Bell size={16}/>}
        {busy ? 'Procesando…' : enabled ? 'Desactivar' : 'Activar notificaciones'}
      </button>
    </div>}
    {notice && <p className="push-settings-success"><CheckCircle2 size={15}/>{notice}</p>}
    {error && <p className="push-settings-error" role="alert">{error}</p>}
    <small className="push-settings-footnote">En iPhone, agrega CLICKOK a la pantalla de inicio y abre la app instalada antes de activar las notificaciones.</small>
  </section>;
}
