# Notificaciones push de CLICKOK

## Qué incluye
- Suscripción por usuario, comercio y dispositivo.
- Preferencia inicial para avisar de nuevos pedidos de vitrina.
- Service worker que muestra avisos y abre el POS al tocar la notificación.
- Envío desde Supabase Edge Functions; las credenciales privadas nunca llegan al navegador.
- Limpieza automática de suscripciones expiradas (HTTP 404/410).

## Configuración requerida antes de activar en producción

1. Genera un par VAPID (clave pública y privada) con una herramienta local de confianza o con `web-push generate-vapid-keys`. No publiques la clave privada.
2. En Supabase > Project Settings > Edge Functions > Secrets, agrega:
   - `VAPID_PUBLIC_KEY`: clave pública VAPID.
   - `VAPID_PRIVATE_KEY`: clave privada VAPID.
   - `VAPID_SUBJECT`: `mailto:soporte@clickok.co` (usa el correo real de soporte si cambia).
   - `CLICKOK_PUSH_DISPATCH_SECRET`: secreto aleatorio largo compartido únicamente entre Edge Functions.
3. En las variables de entorno de compilación de Render agrega `VITE_VAPID_PUBLIC_KEY` con el mismo valor de la clave pública VAPID y vuelve a desplegar el frontend.
4. Despliega las funciones `send-store-order-push` y la versión actualizada de `create-store-order`.
5. Aplica la migración `20261109010000_clickok_push_subscriptions.sql`.

## Pruebas
- Activa notificaciones con una sesión de comercio.
- Crea un pedido de prueba desde la vitrina.
- Verifica que llegue el aviso y que al tocarlo abra el POS.
- Prueba Android/escritorio y, en iPhone, instala primero CLICKOK desde Compartir > Añadir a pantalla de inicio.
- No se debe usar un pedido ni un pago real para validar.

## Consideraciones
- Requiere HTTPS y permiso explícito del usuario.
- Realtime actualiza la interfaz abierta; Web Push entrega avisos cuando la pestaña está en segundo plano o cerrada.
- Cada dispositivo tiene su propia suscripción. Desactivar en uno no desactiva los demás.
- Si el navegador bloqueó permisos, el usuario debe habilitarlos desde los ajustes del navegador.
