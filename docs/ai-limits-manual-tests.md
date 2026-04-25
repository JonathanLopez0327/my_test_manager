# Tests manuales — Límites de uso de AI

> Lista de verificaciones que **no** están cubiertas por los tests automatizados y que deben correrse antes de habilitar el feature para un usuario beta.

## Cobertura automatizada previa

Estos archivos cubren las partes que se pueden testear con mocks. Corrélos antes de empezar con los manuales:

```bash
pnpm test src/lib/ai/usage.test.ts
pnpm test src/lib/keygen/client.test.ts
pnpm test src/app/api/ai/chat/route.test.ts
pnpm test src/app/api/webhooks/keygen/route.test.ts
```

Si algún archivo falla, **parar acá** — no hay sentido en seguir con tests manuales hasta que el código base pase los unitarios.

---

## 1. Sync real Keygen → DB (crítico)

**Por qué es manual:** requiere interactuar con la cuenta real de Keygen. No se mockea en CI.

**Precondición:** la org de prueba debe tener `keygen_license_id` poblado. Verificar con:
```sql
SELECT id, name, keygen_license_id, ai_token_limit_monthly
FROM organizations
WHERE id = '<org-id>';
```

### 1.a Editar el `metadata.value` de un entitlement (fan-out)

Keygen dispara `entitlement.updated` cuyo `resource` es el entitlement (no una license). El webhook hace **fan-out** a todas las orgs con `keygen_license_id` no nulo — ver `src/app/api/webhooks/keygen/route.ts:98-125`.

**Pasos:**
1. En el dashboard de Keygen, abrir el entitlement `ai_token_limit_monthly`.
2. Cambiar `metadata.value` de `250000` a `300000` y guardar.
3. Revisar logs del server Next — deberían aparecer, en orden:
   ```
   [keygen] webhook received event=entitlement.updated resourceType=entitlements resourceId=...
   [keygen] entitlement.updated refreshed N/N orgs
   ```
4. Re-consultar la DB para **cada** org linkeada:
   ```sql
   SELECT id, ai_token_limit_monthly FROM organizations WHERE keygen_license_id IS NOT NULL;
   ```

**Resultado esperado:** todas las orgs linkeadas quedan en `300000`. Si alguna org falla su `getLicenseQuotas`, el log `[keygen] entitlement refresh failed for org=...` lo reporta y el resto sigue actualizándose.

### 1.b Attach/detach de un entitlement a una license

Keygen dispara `license.entitlements.attached` o `license.entitlements.detached` cuyo resource **sí** es la license. El webhook los trata como alias de `license.updated`.

**Pasos:**
1. En Keygen, attach o detach un entitlement a la license de la org de prueba.
2. Revisar logs:
   ```
   [keygen] webhook received event=license.entitlements.attached resourceType=licenses resourceId=<licenseId>
   ```
3. Verificar que la org actualizó solo su fila (no hay fan-out aquí).

**Si no se actualiza ninguna org (1.a) o la org del evento (1.b):**
- El entitlement `code` probablemente quedó en mayúsculas. Ver `src/lib/keygen/client.ts:217-225` — el match es case-sensitive.
- Fix: normalizar con `.toLowerCase()` en la comparación. Hay un test en `src/lib/keygen/client.test.ts` que documenta este caso con el título "falls back to defaults when the entitlement code is uppercase".

**Cleanup:** revertir el entitlement a `250000` al terminar.

---

## 2. UI del `AiUsageCard` con estados reales

**Por qué es manual:** no hay Playwright/Cypress instalado. `@testing-library/react` podría validar clases CSS pero no cubre percepción visual real.

**Pasos:**
1. Abrir la app logueado con la org de prueba.
2. Ir a la sección donde aparece `AiUsageCard` (Settings / org details).
3. Verificar render inicial: muestra `used / limit`, barra color `bg-brand-500` (celeste/marca), porcentaje < 80%.
4. En SQL, simular 80% de uso:
   ```sql
   UPDATE ai_usage_periods
   SET total_tokens = 200000, input_tokens = 120000, output_tokens = 80000
   WHERE organization_id = '<org-id>' AND period_end > NOW();
   ```
5. Recargar la página → barra **amarilla** (`bg-warning-500`) + mensaje `quotaNear`.
6. Simular 100%:
   ```sql
   UPDATE ai_usage_periods SET total_tokens = 250000, input_tokens = 150000, output_tokens = 100000
   WHERE organization_id = '<org-id>' AND period_end > NOW();
   ```
7. Recargar → barra **roja** (`bg-danger-500`) + mensaje `quotaExceeded`.

**Cleanup:**
```sql
UPDATE ai_usage_periods SET total_tokens = 0, input_tokens = 0, output_tokens = 0
WHERE organization_id = '<org-id>' AND period_end > NOW();
```

---

## 3. UI del chat frente al HTTP 402

**Por qué es manual:** el backend devuelve 402 (ya cubierto por `route.test.ts`), pero **qué renderiza el frontend** cuando el stream viene con ese status no está testeado.

**Pasos:**
1. Bajar el límite a casi cero:
   ```sql
   UPDATE organizations SET ai_token_limit_monthly = 100 WHERE id = '<org-id>';
   ```
2. Abrir el chat de AI como usuario de esa org.
3. Mandar un mensaje que vaya a consumir > 100 tokens.
4. Mandar un segundo mensaje.

**Resultado esperado:**
- El segundo mensaje falla con un mensaje claro al usuario (algo como "Se agotó la cuota mensual de AI. El límite se reinicia el DD/MM/YYYY").
- No debe aparecer un stack trace, ni mensaje en inglés genérico, ni un estado colgado con spinner eterno.

**Si el frontend muestra un error genérico de 5xx o se queda cargando**, hay que manejar el 402 explícitamente en el cliente del chat antes del beta. Buscar donde se consume `POST /api/ai/chat` y leer `response.status === 402` para mostrar el mensaje de `periodEnd` y `limit` del body.

**Cleanup:** `UPDATE organizations SET ai_token_limit_monthly = 250000 WHERE id = '<org-id>';`

---

## 4. Stream cortado a mitad no deja inconsistencias

**Por qué es manual:** reproducir un stream parcial de LangGraph de manera determinística en un unit test es frágil.

**Pasos:**
1. Abrir el chat, mandar un mensaje.
2. Mientras LangGraph está respondiendo (server local), matar el proceso de LangGraph (`Ctrl+C` o `kill`).
3. En la DB revisar:
   ```sql
   SELECT source, input_tokens, output_tokens, total_tokens, created_at
   FROM ai_usage_events
   WHERE organization_id = '<org-id>'
   ORDER BY created_at DESC LIMIT 3;

   SELECT total_tokens FROM ai_usage_periods
   WHERE organization_id = '<org-id>' AND period_end > NOW();
   ```

**Resultado esperado:** o bien el evento no se creó (flush no corrió), o se creó una sola vez con los tokens parciales observados. El `total_tokens` del período debe matchear la suma de eventos.

**Rojo:** si aparecen eventos duplicados o el período quedó con más tokens que la suma de eventos, hay un bug en el `flush` del `TransformStream` (`src/app/api/ai/chat/route.ts:365-422`).

---

## 5. Concurrencia real en primer acceso

**Por qué es manual (o requiere infra extra):** el test unitario cubre el handling de `P2002` en `ensureCurrentPeriod`, pero no ejercita una carrera real contra Postgres.

**Pasos:**
1. Elegir una org **sin** filas en `ai_usage_periods` para este mes:
   ```sql
   DELETE FROM ai_usage_events WHERE organization_id = '<org-id>';
   DELETE FROM ai_usage_periods WHERE organization_id = '<org-id>';
   ```
   (⚠️ **solo en entorno de test**.)
2. Desde el navegador o con un script, disparar 3 requests al chat simultáneamente.
3. Verificar:
   ```sql
   SELECT COUNT(*) FROM ai_usage_periods
   WHERE organization_id = '<org-id>' AND period_end > NOW();
   ```

**Resultado esperado:** `1`. Si aparece `> 1`, la recuperación del `P2002` no está funcionando en runtime aunque el test la cubra.

---

## 6. Rollover de período mensual

**Por qué es manual:** mockear `Date` en unit test cubre la lógica de cálculo, pero no que Postgres acepte el nuevo `periodStart`/`periodEnd` sin chocar con la constraint `uq_ai_usage_periods_org_start`.

**Pasos:**
1. Bajar el `period_end` del período actual al pasado:
   ```sql
   UPDATE ai_usage_periods
   SET period_end = NOW() - INTERVAL '1 day'
   WHERE organization_id = '<org-id>'
   ORDER BY period_start DESC LIMIT 1;
   ```
2. Mandar un mensaje al chat desde esa org.
3. Verificar que existen ahora dos filas para la org:
   ```sql
   SELECT period_start, period_end, total_tokens
   FROM ai_usage_periods
   WHERE organization_id = '<org-id>'
   ORDER BY period_start DESC;
   ```

**Resultado esperado:** el período más reciente tiene `period_start` = primer día del mes actual, `total_tokens` > 0. El período viejo queda intacto con su `total_tokens` anterior.

---

## 7. `ai_token_limit_monthly = 0` permite uso ilimitado (comportamiento documentado)

**Por qué es manual:** es una decisión de producto, no un bug. El test unitario documenta la semántica actual pero hay que confirmarla a nivel de producto antes del beta.

**Contexto:** `checkOrgQuota` solo bloquea cuando `limit > 0` y `used >= limit` (`src/lib/ai/usage.ts:81`). Si una org quedase con `ai_token_limit_monthly = 0` (por ejemplo, falla del sync con Keygen), el chequeo **permite uso ilimitado** en vez de bloquear.

**Decisión a tomar:**
- ✅ Si es intencional (porque 0 = "sin licencia válida, bloquear por otra vía"): documentar en el handbook del beta y monitorear.
- ❌ Si no: cambiar la condición en `src/lib/ai/usage.ts:81` a `limit >= 0` o agregar un check aparte en `checkOrgQuota` que niegue cuando `limit <= 0`. Actualizar el test `allows everything when limit is 0` de `src/lib/ai/usage.test.ts` cuando cambie la semántica.

---

## 8. Observabilidad del `record_usage_failed`

**Por qué es manual:** requiere inspeccionar dónde se ruta el log.

**Pasos:**
1. Buscar en los logs del server los prefijos `[ai-chat] record_usage_failed` y `[ai-chat] persist_assistant_failed`.
2. Confirmar que llegan al sistema de logs que monitoreás (Vercel logs, Datadog, etc).

**Resultado esperado:** alguien va a recibir alertas si estos aparecen. Si se pierden en stdout de un server que nadie lee, un usuario beta podría consumir sin contabilizarse y nadie se entera.

---

## Checklist de go/no-go

Antes de habilitar el feature para el primer usuario beta:

- [ ] Tests unitarios pasan (`pnpm test`).
- [ ] Test manual **1** (sync Keygen → DB) OK.
- [ ] Test manual **2** (estados UI del card) OK.
- [ ] Test manual **3** (UI frente a 402) OK — o, si falla, manejarlo en el frontend antes de habilitar.
- [ ] Decisión tomada sobre punto **7** (límite = 0).
- [ ] Punto **8** confirmado (logs observables).
- [ ] Tests manuales 4–6 corridos al menos una vez — no son bloqueantes si pasan, pero sí si revelan inconsistencia en DB.
