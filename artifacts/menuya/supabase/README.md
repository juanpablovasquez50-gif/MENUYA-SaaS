# MENUYA — autenticación, alta y permisos

Esta rama conecta el acceso con Supabase Auth y prepara la provisión de cada comercio como tenant independiente. El trabajo se está validando dentro del proyecto MENUYA existente; no se crea otro proyecto ni se despliega a Render desde esta rama.

## Variables de entorno

Configura en el entorno de ejecución:

- `VITE_SUPABASE_URL`: URL del proyecto Supabase de MENUYA.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key del proyecto.

No uses la `service_role` key en el navegador ni la incluyas en archivos versionados.

## Migraciones de MENUYA

Orden lógico de las migraciones de esta rama:

1. `202611060001_register_business.sql`: RPC `public.register_business`, con validación, idempotencia, plan gratuito, comercio privado y creación inicial de categoría, vitrina y suscripción. El alta directa por INSERT a `businesses` queda bloqueada; se debe usar la RPC.
2. `202611060002_enforce_business_role_permissions.sql`: aplica autorización por rol a catálogo, pedidos, caja, sucursales, inventario, clientes, ajustes, suscripciones y auditoría.
3. `202611060003_private_schema_function_grants.sql`: permite resolver el helper privado desde las políticas RLS y bloquea la ejecución directa de funciones internas de triggers.

La base de datos MENUYA ya existente contiene las tablas, índices, restricciones, políticas iniciales y triggers. La creación de esa base no está todavía representada por una migración inicial completa en este repositorio; por tanto, estas migraciones no bastan por sí solas para reconstruir un proyecto vacío.

## Matriz de permisos actual

- **owner / admin:** administración del comercio; acceso a suscripción y datos operativos.
- **manager:** sucursales, catálogo, pedidos, clientes, caja, inventario, ajustes y lectura de auditoría.
- **catalog:** productos, categorías, opciones y configuración de vitrina.
- **orders:** pedidos, ítems y clientes.
- **cashier:** pedidos, ítems, clientes, ventas y sesiones de caja.

Las políticas RLS son la autoridad final. La interfaz debe ocultar o deshabilitar acciones según el rol, pero nunca sustituye las políticas de base de datos.

## Validación pendiente

- Probar registro, confirmación de correo, login y recuperación de contraseña con cuentas autorizadas.
- Verificar que el propietario sólo vea los comercios a los que pertenece.
- Probar que un rol sin permiso no pueda escribir en las tablas restringidas.
- Probar que un usuario de otro comercio no pueda leer ni modificar registros ajenos.
- Conectar los módulos de productos, pedidos, clientes, inventario, ventas y editor a consultas reales. En esta etapa esos módulos aún no están migrados desde la demo/localStorage.
- Ejecutar typecheck y build; revisar el PR antes de cualquier merge o despliegue.

No se debe insertar información ficticia en cuentas reales ni desplegar Render o modificar `main` sin aprobación expresa.
