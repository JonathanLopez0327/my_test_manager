# API README - Test Manager

Documentacion de endpoints expuestos en `src/app/api/**`.

## Base URL
- Local: `http://localhost:3000`
- Prefijo API: `/api`

## Autenticacion y autorizacion
- Casi todos los endpoints usan `withAuth(...)` y requieren sesion valida (si no: `401`).
- Los permisos se validan por RBAC global/organizacional/proyecto (si no: `403`).
- Error comun de validacion: `400`.
- Errores no controlados: `500`.

## Convenciones generales
- Paginacion comun: `page`, `pageSize`.
- Orden comun: `sortBy`, `sortDir` (`asc|desc`).
- Respuesta de listas: `{ items, total, page, pageSize }`.

## Auth

### `GET|POST /api/auth/[...nextauth]`
- Handler de NextAuth (login, callback, session, csrf, etc).
- Implementado con `NextAuth(authOptions)`.

## Organizaciones

### `GET /api/organizations`
- Permiso: autenticado (`withAuth(null)`).
- Devuelve organizaciones visibles para el usuario.
- Query: `sortBy` (`name|slug|members|projects|isActive`), `sortDir`.

### `POST /api/organizations`
- Permiso: `ORG_CREATE`.
- Body:
```json
{ "slug": "qa-team", "name": "QA Team" }
```
- Crea organizacion; si el creador no es super admin, lo agrega como `owner`.

### `GET /api/organizations/{id}`
- Permiso: autenticado + acceso por membresia o permiso global.
- Retorna detalle de organizacion con conteos.

### `PUT /api/organizations/{id}`
- Permiso: `ORG_UPDATE`.
- Body parcial:
```json
{ "name": "Nuevo nombre", "slug": "nuevo-slug", "isActive": true }
```

### `DELETE /api/organizations/{id}`
- Permiso: `ORG_DELETE`.
- Elimina organizacion.

### `POST /api/organizations/switch`
- Permiso: autenticado.
- Body:
```json
{ "organizationId": "org_id" }
```
- Valida membresia y retorna datos para actualizar sesion activa.

## Miembros de organizacion

### `GET /api/organizations/{id}/members`
- Permiso: `ORG_MEMBER_LIST`.
- Query: `sortBy` (`name|email|role|isActive`), `sortDir`.

### `POST /api/organizations/{id}/members`
- Permiso: `ORG_MEMBER_MANAGE`.
- Body:
```json
{ "userId": "user_id", "role": "member" }
```
- Roles validos: `owner|admin|member|billing`.

### `PUT /api/organizations/{id}/members/{userId}`
- Permiso: `ORG_MEMBER_MANAGE`.
- Body:
```json
{ "role": "admin" }
```
- No permite dejar la organizacion sin owners.

### `DELETE /api/organizations/{id}/members/{userId}`
- Permiso: `ORG_MEMBER_MANAGE`.
- No permite eliminar el ultimo owner.

## Usuarios

### `GET /api/users`
- Permiso: `USER_LIST`.
- Query: `page`, `pageSize`, `query`, `sortBy` (`email|fullName|isActive|organization|role|global`), `sortDir`.
- Scope por organizacion activa (excepto super admin).

### `POST /api/users`
- Permiso: `USER_CREATE`.
- Body:
```json
{
  "email": "user@acme.com",
  "fullName": "User Name",
  "password": "password123",
  "isActive": true,
  "memberships": [{ "organizationId": "org_id", "role": "member" }]
}
```

### `PUT /api/users/{id}`
- Permiso: `USER_UPDATE`.
- Body (actualiza perfil, password opcional y reemplaza memberships):
```json
{
  "fullName": "User Name",
  "isActive": true,
  "password": "newpassword123",
  "memberships": [{ "organizationId": "org_id", "role": "admin" }]
}
```

## Proyectos

### `GET /api/projects`
- Permiso: `PROJECT_LIST`.
- Query: `page`, `pageSize`, `query`, `sortBy` (`key|name|description|isActive`), `sortDir`.

### `POST /api/projects`
- Permiso: `PROJECT_CREATE`.
- Requiere `activeOrganizationId` en sesion.
- Body:
```json
{
  "key": "TMS",
  "name": "Test Manager",
  "description": "Optional",
  "context": "Optional",
  "isActive": true
}
```

### `PUT /api/projects/{id}`
- Permiso: `PROJECT_UPDATE`.
- Valida pertenencia a organizacion activa.

### `DELETE /api/projects/{id}`
- Permiso: `PROJECT_DELETE`.

## Test Plans

### `GET /api/test-plans`
- Permiso: `TEST_PLAN_LIST`.
- Query: `page`, `pageSize`, `query`, `projectId`, `sortBy` (`name|project|status|startsOn|endsOn`), `sortDir`.

### `POST /api/test-plans`
- Permiso: `TEST_PLAN_CREATE`.
- Body:
```json
{
  "projectId": "proj_id",
  "name": "Regression Q1",
  "description": "Optional",
  "status": "draft",
  "startsOn": "2026-03-01",
  "endsOn": "2026-03-15"
}
```
- `status`: `draft|active|completed|archived`.

### `PUT /api/test-plans/{id}`
- Permiso: `TEST_PLAN_UPDATE` (proyecto actual y nuevo si cambia).

### `DELETE /api/test-plans/{id}`
- Permiso: `TEST_PLAN_DELETE`.

## Test Suites

### `GET /api/test-suites`
- Permiso: `TEST_SUITE_LIST`.
- Query: `page`, `pageSize`, `query`, `testPlanId`, `projectId`, `sortBy` (`name|plan|parent|displayOrder`), `sortDir`.

### `POST /api/test-suites`
- Permiso: `TEST_SUITE_CREATE`.
- Body:
```json
{
  "testPlanId": "plan_id",
  "parentSuiteId": null,
  "name": "Smoke",
  "description": "Optional",
  "displayOrder": 10
}
```

### `PUT /api/test-suites/{id}`
- Permiso: `TEST_SUITE_UPDATE`.
- No permite `parentSuiteId === id`.

### `DELETE /api/test-suites/{id}`
- Permiso: `TEST_SUITE_DELETE`.

## Test Cases

### `GET /api/test-cases`
- Permiso: `TEST_CASE_LIST`.
- Query: `page`, `pageSize`, `query`, `suiteId`, `tag`, `testPlanId`, `projectId`, `status`, `sortBy` (`case|suite|status|tags|priority|automation`), `sortDir`.
- `status`: `draft|ready|deprecated`.

### `POST /api/test-cases`
- Permiso: `TEST_CASE_CREATE`.
- Body:
```json
{
  "suiteId": "suite_id",
  "title": "Login works",
  "style": "step_by_step",
  "description": "Optional",
  "preconditions": "Optional",
  "steps": [],
  "tags": ["smoke"],
  "status": "draft",
  "priority": 3,
  "isAutomated": false,
  "automationType": null,
  "automationRef": null
}
```

### `GET /api/test-cases/tags`
- Permiso: `TEST_CASE_LIST`.
- Query opcional: `suiteId`.
- Retorna tags unicos: `{ items: string[] }`.

### `PUT /api/test-cases/{id}`
- Permiso: `TEST_CASE_UPDATE`.

### `DELETE /api/test-cases/{id}`
- Permiso: `TEST_CASE_DELETE`.

## Test Runs

### `GET /api/test-runs`
- Permiso: `TEST_RUN_LIST`.
- Query: `page`, `pageSize`, `query`, `projectId`, `testPlanId`, `suiteId`, `status`, `runType`, `sortBy` (`run|project|planSuite|status|metrics|runType|dates`), `sortDir`.
- `status`: `queued|running|completed|canceled|failed`.
- `runType`: `manual|automated`.

### `POST /api/test-runs`
- Permiso: `TEST_RUN_CREATE`.
- Body:
```json
{
  "projectId": "proj_id",
  "testPlanId": "plan_id",
  "suiteId": "suite_id",
  "runType": "manual",
  "status": "queued",
  "name": "Regression run",
  "environment": "staging",
  "buildNumber": "2026.03.02.1",
  "branch": "main",
  "commitSha": "abc123",
  "ciProvider": "github",
  "ciRunUrl": "https://...",
  "startedAt": null,
  "finishedAt": null,
  "createItems": true
}
```
- Si `createItems=true`, crea `testRunItems` desde suite/plan y recalcula metricas.

### `PUT /api/test-runs/{id}`
- Permiso: `TEST_RUN_UPDATE`.

### `DELETE /api/test-runs/{id}`
- Permiso: `TEST_RUN_DELETE`.

## Items y metricas de runs

### `GET /api/test-runs/{id}/items`
- Permiso: `TEST_RUN_ITEM_LIST`.
- Query: `page`, `pageSize`, `search`, `status`, `testCaseId`, `includeArtifacts`.

### `POST /api/test-runs/{id}/items`
- Permiso: `TEST_RUN_ITEM_UPDATE`.
- Body:
```json
{
  "items": [
    {
      "testCaseId": "case_id",
      "status": "passed",
      "durationMs": 1200,
      "executedById": "user_id",
      "executedAt": "2026-03-02T15:00:00.000Z",
      "errorMessage": null,
      "stacktrace": null,
      "artifacts": [
        {
          "type": "log",
          "name": "Console log",
          "url": "https://...",
          "mimeType": "text/plain",
          "sizeBytes": 1234,
          "checksumSha256": "...",
          "metadata": {}
        }
      ]
    }
  ],
  "recalculateMetrics": true
}
```

### `GET /api/test-runs/{id}/metrics`
- Permiso: `TEST_RUN_METRICS_VIEW`.
- Query opcional: `refresh=true` para recalcular.

### `POST /api/test-runs/{id}/metrics`
- Permiso: `TEST_RUN_METRICS_UPDATE`.
- Recalcula metricas manualmente.

## Artefactos de runs

### `GET /api/test-runs/{id}/artifacts`
- Permiso: `ARTIFACT_LIST`.
- Query: `page`, `pageSize`, `runItemId`, `type` (`screenshot|video|log|report|link|other`).
- Retorna URLs firmadas cuando el archivo esta en S3 del proyecto.

### `POST /api/test-runs/{id}/artifacts`
- Permiso: `ARTIFACT_UPLOAD`.
- Body JSON:
```json
{
  "artifacts": [
    {
      "runItemId": "item_id",
      "type": "screenshot",
      "name": "Login failure",
      "url": "https://...",
      "mimeType": "image/png",
      "sizeBytes": 25000,
      "checksumSha256": "...",
      "metadata": {}
    }
  ]
}
```

### `POST /api/test-runs/{id}/artifacts/upload`
- Permiso: `ARTIFACT_UPLOAD`.
- `multipart/form-data`.
- Campos: `file` (obligatorio), `runItemId` (opcional), `type` (opcional), `name` (opcional).
- Sube binario a S3 y crea registro en DB.

### `DELETE /api/test-runs/{id}/artifacts/{artifactId}`
- Permiso: `ARTIFACT_DELETE`.
- Elimina en S3 (si aplica) y en DB.

## Export de runs

### `GET /api/test-runs/{id}/export`
- Genera reporte de run en `html` o `pdf`.
- Query: `format=html|pdf` (default `html`).
- Content-Disposition de descarga: `run-{projectKey}-{id}.html|pdf`.
- Nota: esta ruta no usa `withAuth` actualmente.

## Bugs

### `GET /api/bugs`
- Permiso: `BUG_LIST`.
- Query: `page`, `pageSize`, `query`, `projectId`, `status`, `severity`, `type`, `assignedToId`, `sortBy` (`bug|status|severity|type|priority|assignedTo|comments`), `sortDir`.

### `POST /api/bugs`
- Permiso: `BUG_CREATE`.
- Body:
```json
{
  "projectId": "proj_id",
  "title": "Login button does not work",
  "description": "Optional",
  "severity": "high",
  "priority": 2,
  "status": "open",
  "type": "bug",
  "assignedToId": "user_id",
  "testRunItemId": "item_id",
  "testCaseId": "case_id",
  "reproductionSteps": "...",
  "expectedResult": "...",
  "actualResult": "...",
  "environment": "staging",
  "tags": ["ui", "smoke"]
}
```

### `GET /api/bugs/stats`
- Permiso: `BUG_LIST`.
- Retorna conteos agregados por estado, severidad y tipo.

### `GET /api/bugs/{id}`
- Permiso: `BUG_LIST`.
- Retorna detalle del bug + comentarios (hasta 50).

### `PUT /api/bugs/{id}`
- Permiso: `BUG_UPDATE`.
- Body parcial permitido (campos del bug).

### `DELETE /api/bugs/{id}`
- Permiso: `BUG_DELETE`.

## Comentarios de bugs

### `GET /api/bugs/{id}/comments`
- Permiso: `BUG_LIST`.
- Query: `page`, `pageSize`.

### `POST /api/bugs/{id}/comments`
- Permiso: `BUG_COMMENT_CREATE`.
- Body:
```json
{ "content": "Necesita mas contexto" }
```

### `DELETE /api/bugs/{id}/comments/{commentId}`
- Permiso: autor del comentario o `BUG_COMMENT_DELETE`.

## Códigos de estado mas comunes
- `200`: OK.
- `201`: creado.
- `400`: validacion o payload invalido.
- `401`: no autenticado.
- `403`: sin permisos.
- `404`: recurso no encontrado.
- `409`: conflicto de unicidad.
- `500`: error interno.
