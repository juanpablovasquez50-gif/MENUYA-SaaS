# MENUYA — autenticación y alta de comercios

Esta rama conecta el formulario de acceso con Supabase Auth y prepara el alta de cada comercio como tenant independiente.

## Variables de entorno

Configura en el entorno de desarrollo:

- `VITE_SUPABASE_URL`: URL del proyecto Supabase de MENUYA.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key del proyecto.

No uses la `service_role` key en el navegador ni la incluyas en archivos versionados.

## Migración de registro

La función RPC `public.register_business` está definida en:

`supabase/migrations/202611060001_register_business.sql`

La función crea, dentro de una sola transacción:

1. El comercio en estado `pending` y no publicado.
2. La membresía del propietario (mediante el trigger existente).
3. La categoría inicial.
4. La configuración privada de la vitrina.
5. La suscripción al plan `free` en estado `pending`.

La función es idempotente para evitar duplicar el tenant si se reintenta el alta.

## Orden seguro de validación

1. Crear un entorno Supabase de desarrollo separado del proyecto de producción.
2. Aplicar allí la migración SQL.
3. Configurar las variables de entorno en un entorno de preview, nunca en producción.
4. Probar registro con confirmación de correo, login, creación del tenant, recuperación de contraseña y aislamiento entre usuarios.
5. Ejecutar typecheck y build desde GitHub Actions.
6. Solo después de aprobar las pruebas, planificar la migración y despliegue de producción.

**No ejecutar esta migración ni cambiar variables del servicio de producción como parte de esta rama.**

## Alcance actual

El acceso y la provisión inicial del tenant usan Supabase. Los módulos de productos, pedidos, clientes, inventario y editor todavía no se han migrado de la demo/localStorage a consultas reales. Por eso, después de autenticar se muestra una pantalla segura de estado y no se cargan datos de demostración en una cuenta real.
