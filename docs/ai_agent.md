# Integracion AI Agent (LangGraph) en MTM

Esta documentacion refleja la implementacion real en este repositorio.

## Flujo

1. UI en `manager/ai-chat` crea/consulta conversaciones via `GET|POST /api/ai/conversations`.
2. UI envia mensaje a `POST /api/ai/chat`.
3. El route handler valida sesion + RBAC + acceso al proyecto/conversacion.
4. El server obtiene/rota un token dedicado del agente para el usuario y organizacion activa.
5. El server crea thread en LangGraph si la conversacion no tiene `threadId`.
6. El server inicia `runs/stream`, retransmite SSE al frontend y persiste respuesta.
7. El frontend parsea `data:` y muestra respuesta incremental.

## Endpoint

### `GET /api/ai/conversations?projectId=<uuid>`

Retorna hasta 5 conversaciones activas del usuario actual para el proyecto indicado.

Respuesta:

```json
{
  "items": [
    {
      "id": "conversation_id",
      "title": "Explain run #123 failures",
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "environment": "DEV",
      "createdAt": "2026-03-02T20:00:00.000Z",
      "updatedAt": "2026-03-02T20:05:00.000Z",
      "lastMessageAt": "2026-03-02T20:05:00.000Z",
      "messages": []
    }
  ],
  "total": 1
}
```

### `POST /api/ai/conversations`

Body:

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "environment": "DEV"
}
```

Crea una conversacion en estado `active` con titulo inicial `New conversation`.  
Politica de retencion: maximo 5 activas por `userId + projectId`; excedentes pasan a `archived`.

### `POST /api/ai/chat`

Body:

```json
{
  "message": "Explain latest run failures",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "conversationId": "1a2b3c4d-1111-2222-3333-444455556666"
}
```

Validaciones:
- `message`: requerido, 1..4000.
- `projectId`: UUID requerido.
- `conversationId`: UUID requerido, debe pertenecer al usuario/proyecto/organizacion activa.

Respuesta:
- `200` con `text/event-stream`.
- Header `X-Thread-Id` con thread activo.
- Persiste mensajes `user` y `assistant` en DB.

Errores:
- `400` payload invalido.
- `403` sin acceso al proyecto/organizacion.
- `502` error aguas arriba de LangGraph.
- `504` timeout al conectar con LangGraph.

## Variables de entorno

Agregar en `.env`:

```env
LANGGRAPH_API_URL=http://localhost:8123
LANGGRAPH_QA_ID=qa_agent
AI_AGENT_TOKEN_ENCRYPTION_KEY=<base64 32 bytes>
AI_AGENT_TOKEN_TTL_DAYS=90
AI_AGENT_TOKEN_ROTATE_BEFORE_DAYS=7
```

Notas:
- `LANGGRAPH_API_URL` es obligatorio en produccion.
- `AI_AGENT_TOKEN_ENCRYPTION_KEY` es obligatorio para cifrar/descifrar token del agente.
- Generar key de 32 bytes (base64), por ejemplo: `openssl rand -base64 32`.

## Modelo de datos

Se agregan tablas para historial QA chat:

- `ai_conversations`
  - scope por `organization_id`, `project_id`, `user_id`
  - `status` (`active|archived`)
  - `last_message_at` para orden de historial
  - `thread_id` para continuidad con LangGraph
- `ai_conversation_messages`
  - `conversation_id`
  - `role` (`user|assistant`)
  - `content`
  - `created_at`

Persisten ademas `agent_token_secrets` y `api_tokens` para auth del agente.

## Seguridad

- El token del agente nunca se expone al cliente.
- El route handler valida acceso real al proyecto dentro de la organizacion activa.
- El token del agente se rota si esta cerca de expirar.
- Si el secreto cifrado falta/corrompe, se revoca y regenera token.

## UI actual

`AiChatWorkspace`:
- conserva la interfaz existente;
- usa streaming SSE real;
- mantiene `threadId` por conversacion en estado cliente;
- bloquea envio si el contexto esta en `All projects`.

## Limites de esta fase

- Adjuntos en chat solo enriquecen el prompt (no upload al agente todavia).
- No se incluyo rate limiting distribuido.
