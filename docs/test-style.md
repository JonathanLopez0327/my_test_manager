# Estilos de Casos de Prueba

---

## 1) Given / When / Then (BDD - Gherkin)

**Útil cuando:** quieres lenguaje de negocio, colaboración con PO/BA y trazabilidad a historias.  
**Estructura:** `Given` (contexto) / `When` (acción) / `Then` (resultado) / `And` (resultado adicional).

### Ejemplo (Gherkin)

- Given el usuario está logueado
- When cambia su contraseña usando la contraseña actual válida
- Then la contraseña queda actualizada
- And el sistema invalida la sesión y solicita iniciar sesión nuevamente

### Reglas para implementación (agente)

- `Given` → **setup** (login, seed de datos, navegación inicial).
- `When` → **acción** (clicks/inputs en UI o request en API).
- `Then/And` → **asserts verificables** (texto visible, status code, redirección, sesión inválida, etc.).
- Evitar `Then` ambiguos: cada `Then/And` debe poder verificarse con una condición concreta.

---

## 2) Data-driven / Scenario Outline (Gherkin con tabla)

**Útil cuando:** repites el mismo flujo con distintos datos (validaciones, edge cases).  
**Estructura:** `Scenario Outline` + `Examples` (tabla).

### Ejemplo (Gherkin)

Scenario Outline: Validar cambio de contraseña  
Given el usuario está logueado  
When intenta cambiar su contraseña a `<new_password>` usando la contraseña actual `<current_password>`  
Then el sistema muestra el mensaje `<expected_message>`

Examples:  
| new_password | current_password | expected_message |
|---|---|---|
| NewPass123! | OldPass123! | Contraseña actualizada correctamente |
| short | OldPass123! | La contraseña debe tener al menos 8 caracteres |
| NewPass123! | wrong | La contraseña actual es incorrecta |

### Reglas para implementación (agente)

- Crear **1 test por cada fila** en `Examples`.
- Reemplazar `<placeholders>` por los valores de cada fila.
- El `Then` debe validar `expected_message` (y opcionalmente el estado final del sistema).
- Mantener nombres de columnas consistentes (`new_password`, `current_password`, etc.).

---

## 3) API-style (Request/Response)

**Útil cuando:** pruebas endpoints, necesitas control granular de request/response o automatización estable.  
**Estructura:** método + endpoint + headers + body + respuesta esperada + asserts.

### Ejemplo

#### Request
- Method: `POST`
- Endpoint: `/api/auth/login`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "email": "[EMAIL_ADDRESS]",
  "password": "[PASSWORD]"
}

#### Expected Response
- Status: 200 OK
- Body:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "[EMAIL_ADDRESS]",
    "name": "Usuario de Prueba"
  }
}
```

### Reglas para implementación (agente)

- Crear un test por endpoint/método.
- Usar variables para tokens, IDs o datos dinámicos.
- Validar **status code**, **body** (schema + valores clave) y **headers** si es relevante.
- Mantener requests y responses en formato JSON o texto plano según el estándar de la API.