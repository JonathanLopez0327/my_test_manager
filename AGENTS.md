# AGENTS.md

## Contexto del proyecto
**Test Manager** es un sistema moderno de gestión de pruebas (TMS): proyectos, planes, suites, casos y ejecuciones (runs), con métricas en dashboard.  
Stack principal:
- Next.js (App Router)
- Prisma + PostgreSQL
- NextAuth.js (auth)
- Tailwind CSS
- React Hook Form + Zod
- S3 (AWS SDK v3) para artefactos (screenshots/logs)

## Objetivo de este documento
Definir reglas claras para que cualquier agente/colaborador:
- implemente features sin romper convenciones,
- mantenga consistencia visual/arquitectónica,
- entregue cambios fáciles de revisar,
- preserve trazabilidad del modelo de datos (Prisma).

---

## Lineamientos de desarrollo (obligatorios)

### 1) Sigue la dirección visual del proyecto
- No inventes estilos nuevos si ya existen patrones.
- Reutiliza layouts, spacing, tipografías y componentes existentes.
- Si agregas UI nueva: incluye `loading`, `empty`, `error` y accesibilidad básica.

### 2) Reutiliza componentes existentes
- Antes de crear componentes nuevos, busca en `src/components/` y `src/layout/`.
- Si creas un componente nuevo:
  - Debe ser reutilizable (props claras, no acoplado a una sola pantalla).
  - Debe documentarse con 2–3 líneas (comentario o README del módulo si aplica).

### 3) Cambios pequeños y trazables
- Prefiere PRs pequeños.
- Evita mezclar refactors con features.
- Cada PR debe incluir: “qué” + “por qué” + “cómo validar”.

### 4) Seguridad y roles (no negociable)
- Toda ruta/pantalla sensible debe estar protegida.
- Respeta RBAC (roles) en UI y en server (no confiar solo en el front).
- Para endpoints: valida sesión/rol antes de operar.

---

## Estructura del repo (referencia)

### Raíz
- `src/` → app (App Router) + UI + lógica
- `prisma/` → esquema/migraciones/semillas
- `docs/` → documentación del proyecto (modelo/decisiones)
- `db/` → utilidades relacionadas a DB (si aplica)
- `minio_local/` → utilidades para storage local tipo S3 (si aplica)
- `public/` → assets públicos
- `jest.config.ts`, `jest.setup.ts` → testing
- `eslint.config.mjs` → lint
- `prisma.config.ts` → config Prisma (v7+)
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` → pnpm

### Dentro de `src/` (convención recomendada)
- `src/app/` → rutas, layouts, pages, route handlers (API)
- `src/components/` → UI reusable (presentacional)
- `src/layout/` → shells/wrappers/nav (layout estructural)
- `src/lib/` → clientes/SDKs/config compartida (Prisma, S3, auth helpers)
- `src/server/` (si existe o se crea) → lógica server-only (services/repos)
- `src/hooks/` → hooks reutilizables
- `src/types/` → tipos compartidos
- `src/styles/` → estilos globales/tokens (si aplica)

> Nota: si hoy no existen algunas carpetas, solo créalas cuando tengas una razón clara. No “muevas todo” en un PR.

---

## Convenciones de código

### Naming
- Componentes: `PascalCase` (ej: `TestRunTable.tsx`)
- Hooks: `useSomething` (ej: `useProject.ts`)
- Variables/funciones: `camelCase`
- Rutas/segmentos (app router): `kebab-case` (ej: `/test-runs/[run-id]`)

### App Router: reglas prácticas
- **Pantallas** en `src/app/**` deben “orquestar” (fetch/compose) y delegar UI a componentes.
- Usa `route.ts` para endpoints del App Router (evitar mezclar “handlers” ad-hoc).
- Separa componentes `client` vs `server` conscientemente (solo `"use client"` si hace falta).

### Límite de responsabilidades (anti-caos)
- UI reusable: `src/components/**`
- Layout estructural: `src/layout/**`
- Acceso a datos / side-effects (DB/S3/auth): `src/lib/**` y/o `src/server/**`
- Validación: Zod schemas en módulo cercano a la feature (ideal: `src/server/.../schemas.ts` o similar)

### Validación y tipos
- Para forms: `react-hook-form` + `zod`.
- Para endpoints: valida input con Zod (no confíes en “types” del front).

---

## Dominio del producto (modelo mental)
Entidades principales:
- **Project**
- **Test Plan** (colección de suites/dates/estado)
- **Test Suite** (jerarquía parent/child)
- **Test Case** (steps, preconditions, priority, automation status)
- **Test Run** (manual/automated) + items con resultados (Passed/Failed/Skipped, etc.)
- **Artifacts** (screenshots/logs) asociados a runs (storage tipo S3)

Regla: Si cambias entidades/relaciones, debes actualizar Prisma + docs (ver sección “Modelo de datos”).

---

## Modelo de datos (Prisma) — reglas obligatorias
- Cambios en DB viven en `prisma/` (schema y migraciones/seed según estrategia).
- Evita “romper” nombres existentes: mantén consistencia entre UI, DB y textos.
- Toda nueva tabla/campo debe:
  - tener naming consistente,
  - incluir índices/unique cuando aplique,
  - contemplar soft-delete o audit fields si el proyecto ya lo usa (revisar esquema actual).

### Migraciones / push
- Para cambios locales rápidos se permite `prisma db push` si así está definido en el repo.
- Si el proyecto adopta migraciones formales, no mezclar enfoques en el mismo PR.
- Seeds: si agregas entidades base (roles, estados), actualiza `prisma db seed`.

---

## Storage de artefactos (S3)
- Los uploads de screenshots/logs deben:
  - ocurrir server-side,
  - guardar metadata mínima en DB (runId, key, filename, contentType, size, createdAt),
  - manejar errores y reintentos de forma segura.
- No hardcodear bucket/region/keys: todo vía `.env`.

---

## Calidad mínima antes de entregar (checklist)
Antes de PR:
- `pnpm lint`
- `pnpm build`
- (si aplica) `pnpm test`

Antes de merge:
- Validar flujo principal: crear proyecto → plan → suite/case → run → registrar resultados → adjuntar artefacto.

---

## Scripts del repo (referencia)
- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm db:push` (si está definido)

---

## Convenciones de PR
Incluye en el PR:
1) **Qué cambia** (1–3 bullets)
2) **Por qué** (contexto)
3) **Cómo probar** (pasos concretos)
4) **Screenshots** (si hay UI)
5) **Riesgo / rollback** (si toca auth/DB)

---

## Cosas que NO se deben hacer
- Duplicar componentes existentes (primero busca y reutiliza).
- Meter estilos hardcodeados si ya hay patrones.
- Introducir dependencias nuevas sin justificar (y sin revisar alternativas).
- Saltarte validación en endpoints.
- Cambiar el enfoque de estructura/arquitectura “porque sí” (si hay refactor, PR separado).

---

## Cuando haya duda
1) Busca un patrón existente en `src/components` / `src/layout`.
2) Replica el estilo base (naming, estructura, props).
3) Si hay tradeoff, documenta 2–3 líneas en el PR explicando la decisión.