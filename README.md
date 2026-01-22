# FUNDLinkAI

Sistema de Subastas Financieras

## Tecnologías

- React + TypeScript + Vite
- Supabase (PostgreSQL)
- Tailwind CSS
- Zustand (State Management)

## Funcionalidades

### Cliente
- Crear subastas de colocación
- Ver ofertas recibidas en tiempo real
- Aprobar/rechazar ofertas
- Gestionar compromisos
- Exportar contratos PDF

### Banco
- Ver solicitudes disponibles
- Enviar ofertas con tasas
- Sistema de aprobaciones (Admin/Mesa)
- Ver compromisos vigentes

### WebAdmin
- Gestión completa de usuarios
- Vista global del sistema
- Auditoría con filtros
- Estadísticas en tiempo real

## Desarrollo Local
```bash
npm install
npm run dev
```

## Variables de Entorno

Crear archivo `.env` con:
```
VITE_SUPABASE_URL=https://ewcvkvnnixrxmiruzmie.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTg2OTgsImV4cCI6MjA4NDU5NDY5OH0.hOvLsfFlKHMMn9faVQ6NeTbBMBjfLBjjTIudHz2ZExs
```