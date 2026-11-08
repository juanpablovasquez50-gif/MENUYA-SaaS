# Usuarios de restaurante y límite de meseros

Estado: especificación funcional para implementar en Menuya. No habilita todavía cuentas de mesero.

## Regla de producto

El límite de usuarios operativos adicionales (meseros) aplica exclusivamente a comercios cuyo sector configurado sea restaurante. Los demás sectores no reciben este límite ni el panel de meseros.

Los cupos incluidos se determinan por el plan vigente del comercio. La matriz comercial debe ser configurable por plan; valores iniciales propuestos para validar con Producto: Básico 1, intermedio 3 y Pro 5 meseros. Estos números son una propuesta, no una tarifa ni condición contractual definitiva.

## Comportamiento esperado

- El propietario/admin del restaurante invita o crea cuentas de mesero vinculadas al mismo comercio.
- Cada mesero inicia sesión con credenciales propias; nunca comparte la cuenta del propietario.
- El rol mesero tiene permisos mínimos: consultar/crear pedidos y operar las mesas que se le asignen. No puede administrar planes, usuarios, configuración, inventario sensible ni integraciones de pago.
- El backend valida el sector y el cupo antes de crear/reactivar una membresía. La interfaz solo refleja la regla; no es el control de seguridad.
- Al alcanzar el cupo, se bloquea la creación y se informa cuántos cupos están ocupados y qué plan permite ampliarlos.
- Al bajar de plan, no se borran usuarios ni historial: se impide crear/reactivar usuarios por encima del nuevo cupo y se solicita al propietario ajustar los accesos.
- Al cambiar el sector a uno distinto de restaurante, el panel y los permisos de mesero dejan de estar disponibles. No se eliminan cuentas ni datos históricos automáticamente.

## Implementación técnica pendiente

1. Confirmar el modelo actual de membresías/roles y cómo se identifica el plan activo.
2. Añadir una matriz de cupos por plan y un rol waiter asociado al comercio.
3. Crear una operación transaccional/RPC con autorización para invitar/activar meseros y comprobar el cupo en servidor.
4. Aplicar RLS para aislar datos por comercio y limitar las operaciones del rol mesero.
5. Añadir la pantalla de gestión de equipo y el panel de mesero solo al sector restaurante.
6. Probar límites concurrentes, cambio de plan, cambio de sector, revocación y aislamiento entre comercios.
7. Desplegar en el servicio de pruebas y validar con cuentas de prueba antes de producción.

## Texto para incorporar al futuro documento de Términos y Condiciones

**Usuarios adicionales y perfiles de mesero en restaurantes.** La cantidad de perfiles de mesero que un comercio puede habilitar depende del plan contratado y de los cupos publicados para dicho plan. Esta funcionalidad está disponible exclusivamente para comercios registrados en la categoría de restaurantes. Los límites y condiciones aplicables se informarán en la descripción vigente de cada plan. Si el comercio cambia de plan, el número de perfiles habilitados podrá ajustarse al nuevo cupo; Menuya podrá restringir la creación o reactivación de perfiles que excedan dicho límite, sin eliminar automáticamente el historial de operaciones. El titular del comercio es responsable de asignar, custodiar y revocar los accesos de su personal.

Este texto es un borrador de producto y debe revisarse jurídicamente antes de publicarse. Los cupos numéricos no se fijan aquí hasta aprobar la matriz comercial definitiva.
