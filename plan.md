# Plan: Flujo de Autorizaciones Cliente (cliente_admin / cliente_usuario)

## Resumen
Agregar roles `cliente_admin` y `cliente_usuario`, igual que banco tiene banco_admin/banco_mesa.
- `cliente_usuario`: puede crear subastas, ver todo, pero NO puede aprobar ofertas de bancos
- `cliente_admin`: aprueba ofertas y tiene la ultima palabra en su entidad
- `cliente` (legacy): sigue funcionando como antes con privilegios completos
- Usuarios de la misma entidad comparten visibilidad de subastas, ofertas, compromisos

## Archivos a crear/modificar

### 1. NUEVO: `supabase/migrations/008_cliente_admin_usuario_flow.sql`
- Helpers SQL: `is_cliente_admin()`, `get_user_entidad()`, `get_entidad_user_ids()`
- Actualizar `is_cliente()` para incluir los 3 roles
- RLS: visibilidad entity-wide (subastas, ofertas, compromisos, limites, KYC)
- RLS: solo admin puede UPDATE ofertas e INSERT compromisos
- Triggers: `validate_oferta()` y `update_limite_utilizado()` con lookup entity-wide
- RPCs: `obtener_compromisos_usuario`, `obtener_bancos_disponibles` entity-wide

### 2. `src/types/database.ts`
- Agregar `'cliente_admin' | 'cliente_usuario'` a UserRole

### 3. `src/App.tsx`
- `user.role === 'cliente'` -> `user.role.startsWith('cliente')` (4 lugares)

### 4. `src/pages/ClienteSubastas.tsx`
- Ocultar botones Aprobar/Rechazar ofertas para `cliente_usuario`
- Quitar filtro `s.cliente_id === user?.id` (RLS ya filtra por entidad)

### 5. `src/pages/ClienteCompromisos.tsx`
- Ocultar boton "+ Agregar Compromiso" para `cliente_usuario`
- Ocultar boton "Eliminar" para `cliente_usuario`

### 6. `src/pages/WebAdminUsuarios.tsx`
- Agregar roles `Cliente - Admin` y `Cliente - Usuario` al dropdown
- Auto-set onboarding y aprobacion para `cliente_usuario`

### 7. `src/pages/WebAdminAprobaciones.tsx` y `WebAdminDashboard.tsx`
- Actualizar filtros de rol para incluir nuevos roles cliente

### 8. `supabase/functions/create-auth-user/index.ts`
- Aceptar `onboarding_completado` y `aprobado_por_admin` del body

### 9. `src/pages/ClienteDashboard.tsx`
- Filtro entity-wide para compromisos (no solo por user.id)
