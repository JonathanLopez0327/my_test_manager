# AGENTS.md - Estructura del Proyecto

## 📋 Información General

**Nombre del Proyecto**: my_test_manager  
**Versión**: 0.1.0  
**Descripción**: Sistema de gestión de pruebas (Test Manager) construido con Next.js y Prisma  
**Fecha de Documentación**: Enero 28, 2026

---

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico

- **Framework**: Next.js 16.1.5 (App Router)
- **Runtime**: React 19.2.3
- **ORM**: Prisma 7.3.0
- **Base de Datos**: PostgreSQL (con adaptador @prisma/adapter-pg)
- **Autenticación**: NextAuth.js 4.24.13
- **Estilos**: Tailwind CSS 4
- **Lenguaje**: TypeScript 5
- **Fuente**: Sora (Google Fonts)
- **Iconos**: Heroicons 2.2.0
- **Encriptación**: bcryptjs 2.4.3

### Gestión de Dependencias

- **Package Manager**: pnpm
- **Workspace**: Configurado con pnpm-workspace.yaml

---

## 📁 Estructura de Directorios

```
my_test_manager/
├── db/                          # Scripts de base de datos
│   └── dbStructureV1.sql       # Estructura SQL inicial
│
├── prisma/                      # Configuración Prisma
│   ├── schema.prisma           # Schema principal de la BD
│   ├── seed.ts                 # Script de datos iniciales
│   └── migrations/             # Historial de migraciones
│       ├── migration_lock.toml
│       ├── 20260127162136_v1/
│       └── 20260128153027_added_global_roles/
│
├── public/                      # Archivos estáticos públicos
│
├── src/                         # Código fuente principal
│   ├── app/                    # App Router (Next.js 13+)
│   │   ├── layout.tsx          # Layout raíz de la aplicación
│   │   ├── page.tsx            # Página principal
│   │   ├── providers.tsx       # Proveedores de contexto
│   │   ├── globals.css         # Estilos globales
│   │   │
│   │   ├── api/                # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts        # Configuración NextAuth
│   │   │   ├── projects/
│   │   │   │   ├── route.ts            # CRUD de proyectos
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts        # Operaciones por ID
│   │   │   └── test-plans/
│   │   │       ├── route.ts            # CRUD de planes de prueba
│   │   │       └── [id]/
│   │   │           └── route.ts        # Operaciones por ID
│   │   │
│   │   ├── login/              # Página de autenticación
│   │   │   └── page.tsx
│   │   │
│   │   └── manager/            # Área de gestión principal
│   │       ├── page.tsx        # Dashboard del manager
│   │       ├── projects/
│   │       │   └── page.tsx    # Vista de proyectos
│   │       └── test-plans/
│   │           └── page.tsx    # Vista de planes de prueba
│   │
│   ├── components/             # Componentes React
│   │   ├── icons.tsx          # Componentes de iconos
│   │   │
│   │   ├── auth/              # Componentes de autenticación
│   │   │   └── LoginForm.tsx
│   │   │
│   │   ├── dashboard/         # Componentes del dashboard
│   │   │   ├── ActivityCard.tsx
│   │   │   ├── MonthlyCard.tsx
│   │   │   ├── ProgressCard.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── SuiteCard.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── TrendCard.tsx
│   │   │
│   │   ├── manager/           # Shell del gestor
│   │   │   └── ManagerShell.tsx
│   │   │
│   │   ├── projects/          # Gestión de proyectos
│   │   │   ├── ProjectFormModal.tsx
│   │   │   ├── ProjectsHeader.tsx
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── ProjectsTable.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── test-plans/        # Gestión de planes de prueba
│   │   │   ├── TestPlanFormModal.tsx
│   │   │   ├── TestPlansHeader.tsx
│   │   │   ├── TestPlansPage.tsx
│   │   │   ├── TestPlansTable.tsx
│   │   │   └── types.ts
│   │   │
│   │   └── ui/                # Componentes UI reutilizables
│   │       ├── Avatar.tsx
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Pagination.tsx
│   │
│   ├── generated/             # Código auto-generado por Prisma
│   │   └── prisma/
│   │       ├── browser.ts
│   │       ├── client.ts
│   │       ├── commonInputTypes.ts
│   │       ├── enums.ts
│   │       ├── models.ts
│   │       ├── internal/
│   │       └── models/        # Modelos individuales
│   │           ├── AuditLog.ts
│   │           ├── Project.ts
│   │           ├── ProjectMember.ts
│   │           ├── TestCase.ts
│   │           ├── TestPlan.ts
│   │           ├── TestRun.ts
│   │           ├── TestRunArtifact.ts
│   │           ├── TestRunItem.ts
│   │           ├── TestRunMetrics.ts
│   │           ├── TestSuite.ts
│   │           ├── User.ts
│   │           ├── UserGlobalRole.ts
│   │           └── UserSession.ts
│   │
│   ├── lib/                   # Utilidades y configuraciones
│   │   ├── auth.ts           # Configuración de autenticación
│   │   └── prisma.ts         # Cliente Prisma singleton
│   │
│   ├── types/                 # Definiciones de tipos TypeScript
│   │   ├── css.d.ts          # Tipos para CSS
│   │   └── next-auth.d.ts    # Extensiones de tipos NextAuth
│   │
│   └── middleware.ts          # Middleware de Next.js
│
├── eslint.config.mjs          # Configuración ESLint
├── next-env.d.ts              # Tipos de Next.js
├── next.config.ts             # Configuración Next.js
├── package.json               # Dependencias y scripts
├── pnpm-lock.yaml            # Lock de dependencias
├── pnpm-workspace.yaml       # Configuración workspace
├── postcss.config.mjs        # Configuración PostCSS
├── prisma.config.ts          # Configuración adicional Prisma
├── tsconfig.json             # Configuración TypeScript
└── README.md                 # Documentación básica
```

---

## 🗄️ Modelo de Datos (Prisma Schema)

### Entidades Principales

#### **Users & Authentication**

1. **User**
   - ID, email, fullName, passwordHash
   - Control: isActive, lastLoginAt
   - Relaciones: sesiones, proyectos, membresías, roles globales

2. **UserSession**
   - Gestión de sesiones con tokens
   - Expiración automática

3. **UserGlobalRole**
   - Roles: super_admin, support, auditor

#### **Projects & Organization**

4. **Project**
   - Contenedor principal de planes de prueba
   - Campos: key (único), name, description, isActive
   - Relaciones: miembros, planes de prueba, ejecuciones

5. **ProjectMember**
   - Roles: admin, editor, viewer
   - Relación muchos-a-muchos entre User y Project

#### **Test Planning**

6. **TestPlan**
   - Estados: draft, active, completed, archived
   - Fechas de inicio/fin (startsOn, endsOn)
   - Relaciones: proyecto, suites, runs

7. **TestSuite**
   - Organización jerárquica de casos de prueba
   - Soporte para suites anidadas (parentSuiteId)
   - displayOrder para ordenamiento

8. **TestCase**
   - Estados: draft, ready, deprecated
   - Campos: título, descripción, precondiciones, pasos (JSON)
   - Soporte para automatización:
     - isAutomated, automationType, automationRef
     - Propietario de automatización
   - Prioridad (1-5)
   - externalKey para integración con sistemas externos

#### **Test Execution**

9. **TestRun**
   - Tipos: manual, automated
   - Estados: queued, running, completed, canceled, failed
   - Metadatos CI/CD:
     - environment, buildNumber, branch, commitSha
     - ciProvider, ciRunUrl
   - Timestamps: startedAt, finishedAt

10. **TestRunItem**
    - Resultado individual por caso de prueba
    - Estados: passed, failed, skipped, blocked, not_run
    - Duración (durationMs)
    - Error tracking: errorMessage, stacktrace

11. **TestRunArtifact**
    - Tipos: screenshot, video, log, report, link, other
    - Almacena: URL, mimeType, sizeBytes, checksumSha256
    - Metadata flexible (JSON)

12. **TestRunMetrics**
    - Estadísticas agregadas de ejecución
    - Contadores: total, passed, failed, skipped, blocked, notRun
    - passRate calculado
    - Duración total

#### **Audit & Compliance**

13. **AuditLog**
    - Registro de todas las acciones importantes
    - Campos: actorUserId, entityType, entityId, action
    - Detalles flexibles (JSON)

---

## 🔐 Sistema de Autenticación

### Configuración NextAuth

- **Estrategia**: JWT (sin base de datos de sesiones)
- **Provider**: Credentials (email/password)
- **Página de Login**: `/login`
- **Encriptación**: bcryptjs para hashing de contraseñas

### Flujo de Autenticación

1. Usuario envía credenciales (email + password)
2. Validación en `authorize()`:
   - Email normalizado (lowercase, trim)
   - Verificación de usuario activo
   - Comparación de hash de contraseña
3. Retorno de objeto de usuario para JWT

### Protección de Rutas

- Implementado en `src/middleware.ts`
- Protege rutas bajo `/manager/*`

---

## 🎨 Sistema de Componentes UI

### Componentes Base (src/components/ui/)

- **Avatar**: Avatares de usuario
- **Badge**: Etiquetas de estado
- **Button**: Botones reutilizables
- **Card**: Contenedores de contenido
- **Input**: Campos de entrada
- **Modal**: Diálogos modales
- **Pagination**: Paginación de tablas

### Componentes de Dominio

#### Dashboard
- Tarjetas de estadísticas y métricas
- Gráficos de tendencia y progreso
- Navegación (Sidebar, Topbar)

#### Projects
- CRUD completo de proyectos
- Gestión de miembros y permisos

#### Test Plans
- Creación y gestión de planes
- Visualización de suites y casos
- Ejecución y resultados

---

## 🛣️ Rutas API

### Autenticación
```
POST   /api/auth/signin
POST   /api/auth/signout
GET    /api/auth/session
```

### Projects
```
GET    /api/projects          # Listar proyectos
POST   /api/projects          # Crear proyecto
GET    /api/projects/[id]     # Obtener proyecto
PUT    /api/projects/[id]     # Actualizar proyecto
DELETE /api/projects/[id]     # Eliminar proyecto
```

### Test Plans
```
GET    /api/test-plans        # Listar planes
POST   /api/test-plans        # Crear plan
GET    /api/test-plans/[id]   # Obtener plan
PUT    /api/test-plans/[id]   # Actualizar plan
DELETE /api/test-plans/[id]   # Eliminar plan
```

---

## 🚀 Scripts de Desarrollo

```bash
# Desarrollo
pnpm dev              # Inicia servidor desarrollo (puerto 3000)

# Producción
pnpm build            # Construye aplicación optimizada
pnpm start            # Inicia servidor producción

# Calidad de Código
pnpm lint             # Ejecuta ESLint

# Base de Datos
npx prisma migrate dev     # Aplica migraciones en desarrollo
npx prisma migrate deploy  # Aplica migraciones en producción
npx prisma studio          # Abre GUI para explorar datos
npx prisma db seed         # Ejecuta seed.ts
npx prisma generate        # Regenera cliente Prisma
```

---

## 🔧 Configuraciones Clave

### Next.js (next.config.ts)
- Configuración de App Router
- Optimizaciones de build

### TypeScript (tsconfig.json)
- Strict mode activado
- Path aliases configurados
- Resolución de módulos

### Prisma (prisma.config.ts)
- Output personalizado: `src/generated/prisma`
- Formato CommonJS para compatibilidad
- Seed script con ts-node

### Tailwind CSS
- Versión 4 (configuración moderna)
- PostCSS integrado
- Variables CSS personalizadas

---

## 📊 Flujos de Trabajo Principales

### 1. Gestión de Proyectos
```
Crear Proyecto → Asignar Miembros → Definir Permisos → Activar
```

### 2. Planificación de Pruebas
```
Crear Test Plan → Definir Suites → Añadir Test Cases → Activar Plan
```

### 3. Ejecución de Pruebas
```
Crear Test Run → Ejecutar Cases → Registrar Resultados → Generar Métricas
```

### 4. Auditoría
```
Acción del Usuario → Log Automático → Registro en AuditLog
```

---

## 🔒 Seguridad

### Implementaciones

1. **Autenticación**
   - JWT tokens seguros
   - Hashing bcryptjs (salt rounds)
   - Validación de sesiones

2. **Autorización**
   - Roles a nivel global (UserGlobalRole)
   - Roles a nivel proyecto (ProjectMember)
   - Middleware de protección de rutas

3. **Base de Datos**
   - Prepared statements (Prisma)
   - Validación de tipos en runtime
   - Índices para performance

4. **Auditoría**
   - Log completo de acciones
   - Trazabilidad de cambios
   - Retención de metadata

---

## 🎯 Características Clave

### Funcionalidades Implementadas

- ✅ Sistema de autenticación completo
- ✅ Gestión multi-proyecto
- ✅ Control de acceso basado en roles
- ✅ Organización jerárquica de pruebas
- ✅ Soporte para pruebas manuales y automatizadas
- ✅ Tracking de ejecuciones
- ✅ Métricas y reportes
- ✅ Gestión de artefactos (screenshots, logs, etc.)
- ✅ Auditoría completa
- ✅ Integración CI/CD ready

### Casos de Uso

1. **QA Teams**: Gestión centralizada de casos de prueba
2. **Development Teams**: Integración con pipelines CI/CD
3. **Project Managers**: Dashboard de métricas y progreso
4. **Compliance**: Trazabilidad completa con audit logs

---

## 📦 Dependencias Críticas

### Producción
- `next`: Framework principal
- `react` / `react-dom`: UI
- `@prisma/client`: ORM
- `next-auth`: Autenticación
- `pg`: Driver PostgreSQL
- `bcryptjs`: Encriptación
- `@heroicons/react`: Iconografía

### Desarrollo
- `typescript`: Tipado estático
- `tailwindcss`: Estilos
- `eslint`: Linting
- `prisma`: CLI y tooling
- `ts-node`: Ejecución TypeScript

---

## 🗂️ Convenciones de Código

### Nomenclatura

- **Componentes React**: PascalCase (`ProjectsTable.tsx`)
- **Utilidades**: camelCase (`auth.ts`)
- **Tipos**: PascalCase con interfaz/type explícito
- **Constantes**: UPPER_SNAKE_CASE
- **Rutas API**: kebab-case (`test-plans`)

### Estructura de Archivos

- Un componente por archivo
- Tipos co-localizados cuando son específicos
- Tipos compartidos en `/types`
- Exportaciones nombradas preferidas

### Base de Datos

- snake_case en BD (mapping automático)
- camelCase en código TypeScript
- UUID como identificadores primarios
- Timestamps automáticos (createdAt, updatedAt)

---

## 🧪 Testing

### Estrategia (Planificada)

- Unit tests: Componentes y utilidades
- Integration tests: API routes
- E2E tests: Flujos críticos
- Database tests: Migraciones y seeds

---

## 📈 Métricas del Proyecto

### Conteo de Archivos (aproximado)

- **Modelos Prisma**: 13 entidades
- **Componentes React**: 25+ componentes
- **API Routes**: 6+ endpoints
- **Páginas**: 5+ rutas de navegación

### Base de Código

- **Lenguajes**: TypeScript (100%)
- **Líneas de Código**: ~3000+ LOC
- **Migraciones**: 2 migraciones aplicadas

---

## 🌐 Deployment

### Plataformas Recomendadas

1. **Vercel** (recomendado para Next.js)
2. **Railway** (incluye PostgreSQL)
3. **Render**
4. **AWS / Azure / GCP**

### Requisitos de Producción

- Node.js 20+
- PostgreSQL 14+
- Variables de entorno configuradas
- Migraciones aplicadas
- Seed data (opcional)

### Variables de Entorno Críticas

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://..."
NEXTAUTH_SECRET="..."
```

---

## 🤝 Contribución

### Flujo de Trabajo

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Add: nueva funcionalidad'`)
4. Push rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Standards

- Código linted (ESLint)
- Types válidos (TypeScript strict)
- Migraciones documentadas
- Commits descriptivos

---

## 📞 Soporte y Contacto

### Documentación

- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- NextAuth: https://next-auth.js.org

### Issues

Reportar problemas en el repositorio del proyecto con:
- Descripción detallada
- Steps to reproduce
- Logs relevantes
- Entorno (OS, Node version, etc.)

---

## 📝 Changelog

### v0.1.0 (Actual)
- ✅ Estructura base del proyecto
- ✅ Schema Prisma completado
- ✅ Autenticación implementada
- ✅ CRUD Projects y Test Plans
- ✅ Dashboard básico

### Roadmap Futuro
- 🔜 Ejecución de pruebas en UI
- 🔜 Reportes avanzados
- 🔜 Integración webhooks CI/CD
- 🔜 Notificaciones en tiempo real
- 🔜 API pública documentada

---

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

---

**Última actualización**: 28 de Enero, 2026  
**Mantenedor**: @jonat  
**Estado**: En desarrollo activo 🚧
