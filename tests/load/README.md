# Menuya V2 — baseline de carga seguro

Este test es **solo de lectura**: no inicia sesión, no crea pedidos, no modifica inventario ni escribe filas.
Mide el frontend estático de Render y los endpoints de salud/raíz de Supabase. No representa todavía la carga completa del Superadmin.

## Requisitos

- k6 instalado: https://grafana.com/docs/k6/latest/set-up/install-k6/
- Un proyecto Supabase de pruebas aislado (no producción).
- URL y publishable key del proyecto de pruebas.

## Ejecución

Desde la raíz del repositorio:

```bash
BASE_URL=https://menuya-pruebas-v2.onrender.com \
SUPABASE_URL=https://TU-PROYECTO-DE-PRUEBAS.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_DE_PRUEBAS \
TARGET_VUS=10 \
k6 run tests/load/menuya-v2-readonly.js
```

Ejecutar por separado con TARGET_VUS=10, 25, 50, 100, 200, 500 y 1000.
No subir al siguiente escalón si hay errores, latencia creciente, límites de recursos o alertas.
Para la primera ejecución, mantener TARGET_VUS=10 y confirmar el aislamiento del proyecto.

## Umbrales iniciales

- Tasa de errores HTTP inferior al 1%.
- p95 inferior a 1.500 ms para estos endpoints simples.
- Revisar también CPU, memoria, conexiones y latencia de Supabase.

Estos umbrales son criterios de prueba propuestos, no resultados ni garantía de capacidad.

## Limitación

Este baseline no simula consultas autenticadas del Superadmin ni operaciones de negocio. Esas pruebas requieren cuentas ficticias y datos sembrados en el proyecto aislado, más escenarios específicos de solo lectura.
