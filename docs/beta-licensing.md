# Beta Licensing System

> Rama: `beta/v1`

Este documento describe el sistema de acceso controlado implementado para la fase beta de la plataforma. Cubre dos mecanismos: registro por invitación y cuotas de uso por organización.

---

## Índice

1. [Visión general](#visión-general)
2. [Modelos de base de datos](#modelos-de-base-de-datos)
3. [Códigos de invitación beta](#códigos-de-invitación-beta)
   - [Formato del código](#formato-del-código)
   - [Flujo de registro estándar (email + contraseña)](#flujo-de-registro-estándar)
   - [Flujo de registro con Google OAuth](#flujo-de-registro-con-google-oauth)
4. [Cuotas de uso por organización](#cuotas-de-uso-por-organización)
   - [Límites por defecto](#límites-por-defecto)
   - [Cómo funciona el chequeo](#cómo-funciona-el-chequeo)
   - [Respuesta de cuota excedida](#respuesta-de-cuota-excedida)
5. [API de administración](#api-de-administración)
   - [Listar códigos](#get-apiadminbeta-codes)
   - [Crear códigos](#post-apiadminbeta-codes)
   - [Ver código individual](#get-apiadminbeta-codesid)
   - [Actualizar código](#patch-apiadminbeta-codesid)
   - [Revocar código](#delete-apiadminbeta-codesid)
6. [Formulario de registro](#formulario-de-registro)
7. [Ajustar cuotas de una organización](#ajustar-cuotas-de-una-organización)
8. [Archivos clave](#archivos-clave)

---

## Visión general

Durante la beta, el acceso a la plataforma está restringido de dos formas:

| Mecanismo | Qué controla |
|---|---|
| **Código de invitación** | Quién puede crear una cuenta nueva |
| **Cuotas de organización** | Cuánto puede crear cada organización |

No existe un sistema de billing. Las cuotas son límites estáticos en la tabla `organizations` que un `super_admin` puede ajustar manualmente vía API o base de datos.

---

## Modelos de base de datos

### `BetaCode` (`beta_codes`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `code` | String (único) | El código en formato `BETA-XXXX-XXXX` |
| `email` | String? | Si está presente, el código solo es válido para ese email |
| `usedById` | UUID? | Usuario que canjeó el código |
| `usedAt` | Timestamp? | Momento del canje. `null` = disponible |
| `expiresAt` | Timestamp? | Fecha de expiración. `null` = sin expiración |
| `createdById` | UUID? | Admin que generó el código |
| `createdAt` | Timestamp | Fecha de creación |

Un código queda **bloqueado** si:
- `usedAt` no es `null` (ya fue usado)
- `expiresAt` es menor a `now()` (expirado o revocado)
- `email` no coincide con el email del usuario que intenta registrarse

### Campos de cuota en `Organization` (`organizations`)

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `maxProjects` | Int | `3` | Máximo de proyectos activos |
| `maxMembers` | Int | `5` | Máximo de miembros en la organización |
| `maxTestCases` | Int | `200` | Máximo de test cases (suma de todos los proyectos) |
| `maxTestRuns` | Int | `100` | Máximo de test runs (suma de todos los proyectos) |
| `maxArtifactBytes` | BigInt | `524288000` (500 MB) | Bytes totales de artifacts almacenados (TestRunArtifact + BugAttachment) |

---

## Códigos de invitación beta

### Formato del código

```
BETA-XXXX-XXXX
```

- `XXXX` son 4 caracteres del alfabeto base-32: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Se excluyen `O`, `0`, `I`, `1` para evitar confusión visual
- El campo en el formulario convierte automáticamente a mayúsculas al escribir
- La validación en el schema de Zod usa: `/^BETA-[A-Z0-9]{4}-[A-Z0-9]{4}$/`

Ejemplos válidos: `BETA-AB12-CD34`, `BETA-XZ98-PQ45`

### Flujo de registro estándar

```
[Usuario escribe código + datos]
        │
        ▼
validateBetaCode()  ──── código no existe ────► 403 INVALID_BETA_CODE
        │
        ├── código ya usado (usedAt != null) ──► 409 INVALID_BETA_CODE
        ├── código expirado ──────────────────► 403 INVALID_BETA_CODE
        └── email no coincide ────────────────► 403 INVALID_BETA_CODE
        │
        ▼ (código válido)
[Transacción Prisma]
  1. Crear User
  2. Crear Organization
  3. Crear OrganizationMember (role: owner)
  4. betaCode.updateMany({ where: { code, usedAt: null }, data: { usedById, usedAt } })
     └── si count === 0 → rollback → 409 INVALID_BETA_CODE (race condition)
        │
        ▼
     Registro exitoso → auto sign-in → redirect /manager
```

El `updateMany` con `where: { usedAt: null }` es atómico dentro de la transacción, lo que previene que dos requests simultáneos canjeen el mismo código.

### Flujo de registro con Google OAuth

Para Google OAuth no hay formulario de código: la plataforma busca automáticamente un código válido asociado al email de Google.

```
[Usuario hace clic en "Continue with Google"]
        │
        ▼
Google retorna email del usuario
        │
        ▼
¿El usuario ya existe? ──── sí ────► Sign-in normal (sin chequeo de código)
        │ no
        ▼
¿Existe un BetaCode con:
  - email == email_de_google
  - usedAt == null
  - expiresAt == null O expiresAt > now()
?
        │
  no ──►│ 403 INVALID_BETA_CODE
        │ sí
        ▼
[Transacción Prisma]
  1. Crear User
  2. Crear Organization
  3. Crear OrganizationMember (role: owner)
  4. Marcar código como usado (mismo patrón race-safe)
```

**Requisito para Google OAuth:** el admin debe crear un código con el campo `email` igual al email de la cuenta de Google antes de que el usuario intente registrarse.

---

## Cuotas de uso por organización

### Límites por defecto

Toda organización nueva tiene estos límites al crearse:

| Recurso | Límite |
|---|---|
| Proyectos | 3 |
| Miembros | 5 |
| Test cases | 200 |
| Test runs | 100 |
| Almacenamiento de artifacts | 500 MB |

### Cómo funciona el chequeo

El chequeo ocurre **antes** de la escritura en base de datos, después de que el usuario ya pasó la verificación de permisos.

```ts
// Ejemplo en POST /api/projects
const quota = await checkQuota(prisma, activeOrganizationId, "projects");
if (!quota.allowed) {
  return quotaExceededResponse(quota); // HTTP 402
}
// ... crear proyecto
```

Los recursos y sus queries de conteo:

| Recurso | Query |
|---|---|
| `"projects"` | `project.count({ where: { organizationId } })` |
| `"members"` | `organizationMember.count({ where: { organizationId } })` |
| `"testCases"` | `testCase.count({ where: { suite: { testPlan: { project: { organizationId } } } } })` |
| `"testRuns"` | `testRun.count({ where: { project: { organizationId } } })` |
| `"artifactBytes"` | `SUM(testRunArtifact.sizeBytes) + SUM(bugAttachment.sizeBytes)` (scoped a la org), más los bytes del archivo entrante (`addBytes`) |

Los endpoints protegidos son:

| Endpoint | Recurso chequeado |
|---|---|
| `POST /api/projects` | `"projects"` |
| `POST /api/organizations/[id]/members` | `"members"` |
| `POST /api/test-cases` | `"testCases"` |
| `POST /api/test-runs` | `"testRuns"` |
| `POST /api/test-runs/[id]/artifacts/upload` | `"artifactBytes"` (con `addBytes: file.size`) |
| `POST /api/bugs/[id]/attachments/upload` | `"artifactBytes"` (con `addBytes: file.size`) |

### Respuesta de cuota excedida

Cuando se supera un límite, la API retorna HTTP **402**:

```json
{
  "code": "QUOTA_EXCEEDED",
  "message": "Beta plan limit reached: you have 3 of 3 projects.",
  "limit": 3,
  "current": 3,
  "resource": "projects"
}
```

---

## API de administración

Todos los endpoints bajo `/api/admin/beta-codes` requieren que el usuario tenga el rol global `super_admin`. Cualquier otro usuario recibe `403 Forbidden`.

### GET `/api/admin/beta-codes`

Lista los códigos beta con filtros opcionales.

**Query params:**

| Param | Tipo | Descripción |
|---|---|---|
| `used` | `"true"` \| `"false"` | Filtrar por estado de uso |
| `email` | string | Filtrar por email (búsqueda parcial, insensible a mayúsculas) |
| `page` | number | Página (default: 1) |
| `pageSize` | number | Resultados por página (default: 20, máx: 100) |

**Ejemplo:**
```bash
GET /api/admin/beta-codes?used=false&page=1&pageSize=20
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "BETA-AB12-CD34",
      "email": "user@example.com",
      "usedAt": null,
      "expiresAt": "2026-06-01T00:00:00Z",
      "createdAt": "2026-03-13T00:00:00Z",
      "usedBy": null,
      "createdBy": { "id": "uuid", "email": "admin@app.com", "fullName": "Admin" }
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### POST `/api/admin/beta-codes`

Crea entre 1 y 100 códigos en una sola petición.

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `count` | number | No (default: 1) | Cantidad de códigos a generar (máx: 100) |
| `email` | string | No | Vincular todos los códigos a este email |
| `expiresAt` | string (ISO 8601) | No | Fecha de expiración para todos los códigos |

**Ejemplo — código genérico (cualquier email):**
```bash
POST /api/admin/beta-codes
Content-Type: application/json

{
  "count": 10,
  "expiresAt": "2026-06-01"
}
```

**Ejemplo — código para un email específico (Google OAuth):**
```bash
POST /api/admin/beta-codes
Content-Type: application/json

{
  "email": "newuser@gmail.com",
  "expiresAt": "2026-06-01"
}
```

**Respuesta (201):**
```json
{
  "created": 10,
  "codes": [
    "BETA-XZ98-PQ45",
    "BETA-AB12-CD34",
    ...
  ]
}
```

---

### GET `/api/admin/beta-codes/[id]`

Obtiene los detalles completos de un código por su UUID.

```bash
GET /api/admin/beta-codes/550e8400-e29b-41d4-a716-446655440000
```

---

### PATCH `/api/admin/beta-codes/[id]`

Actualiza los campos `expiresAt` y/o `email` de un código.

```bash
PATCH /api/admin/beta-codes/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "expiresAt": "2026-12-31",
  "email": "otro@ejemplo.com"
}
```

Para eliminar la expiración o el email vinculado, enviar `null`:

```json
{ "expiresAt": null }
```

---

### DELETE `/api/admin/beta-codes/[id]`

**Revocación suave (soft delete):** establece `expiresAt = now()`, lo que bloquea el código inmediatamente pero preserva el registro para auditoría. No elimina la fila.

```bash
DELETE /api/admin/beta-codes/550e8400-e29b-41d4-a716-446655440000
```

Retorna el código actualizado con el nuevo `expiresAt`.

---

## Formulario de registro

El campo de código beta aparece **al inicio del formulario**, antes de los datos personales, ya que es el prerequisito para continuar.

- Se convierte automáticamente a mayúsculas al escribir
- Muestra error inline si el código es inválido (formato, ya usado, expirado, etc.)
- El error del servidor `INVALID_BETA_CODE` se mapea directamente al campo

```
[ Beta invite code * ]       ← nuevo campo (primero)
[ First name ]  [ Last name ]
[ Email ]
[ Password ]
─────── Organization ───────
[ Organization name ]
[ Organization slug ]
```

Debajo del botón de Google se muestra:
> "Google sign-up requires a beta invite sent to your Google email."

---

## Ajustar cuotas de una organización

Las cuotas se guardan directamente en la tabla `organizations`. Para ampliarlas, actualiza los campos `max_projects`, `max_members`, `max_test_cases`, `max_test_runs` de la organización correspondiente.

Si tienes un endpoint `PUT /api/organizations/:id` protegido por `super_admin`, puedes enviar:

```json
{
  "maxProjects": 10,
  "maxMembers": 25,
  "maxTestCases": 1000,
  "maxTestRuns": 500,
  "maxArtifactBytes": 2147483648
}
```

O directamente en base de datos:

```sql
UPDATE organizations
SET max_projects = 10, max_members = 25, max_artifact_bytes = 2147483648
WHERE id = 'uuid-de-la-org';
```

---

## Archivos clave

| Archivo | Propósito |
|---|---|
| `prisma/schema.prisma` | Modelos `BetaCode` y campos de cuota en `Organization` |
| `prisma/migrations/20260313132029_beta_licensing/` | Migración SQL aplicada |
| `src/lib/schemas/sign-up.ts` | Campo `betaCode` en el schema Zod del registro |
| `src/lib/auth/sign-up.ts` | Validación del código y lógica de canje en transacción |
| `src/lib/beta/quota.ts` | `checkQuota()` y `quotaExceededResponse()` |
| `src/app/api/admin/beta-codes/route.ts` | Admin: listar y crear códigos |
| `src/app/api/admin/beta-codes/[id]/route.ts` | Admin: ver, actualizar y revocar un código |
| `src/app/api/projects/route.ts` | Guard de cuota para proyectos |
| `src/app/api/organizations/[id]/members/route.ts` | Guard de cuota para miembros |
| `src/app/api/test-cases/route.ts` | Guard de cuota para test cases |
| `src/app/api/test-runs/route.ts` | Guard de cuota para test runs |
| `src/app/api/test-runs/[id]/artifacts/upload/route.ts` | Guard de cuota de bytes para artifacts de runs |
| `src/app/api/bugs/[id]/attachments/upload/route.ts` | Guard de cuota de bytes para attachments de bugs |
| `src/components/auth/SignupForm.tsx` | Campo de código beta en el formulario UI |
