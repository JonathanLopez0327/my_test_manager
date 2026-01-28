This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Roles y permisos

### Roles globales
- `super_admin`: acceso total a toda la plataforma.
- `support`: acceso global de solo lectura (soporte/debug).
- `auditor`: acceso global de solo lectura + métricas/reportes (por ahora solo lectura).

### Roles por proyecto
- `admin`: gestiona el proyecto (planes, miembros, borrar).
- `editor`: crea/edita planes, suites, casos y corridas.
- `viewer`: solo lectura.

### Orden de evaluación
1) Si tiene `super_admin` → permitir todo.  
2) Si tiene `support` o `auditor` → permitir solo lectura.  
3) Si es miembro del proyecto → aplicar rol del proyecto.  
4) Si no cumple → acceso denegado.  

### Reglas especiales
- Crear proyectos: permitido para `super_admin` o usuarios con `MemberRole.admin` en cualquier proyecto existente.
- Al crear un proyecto, el creador queda asignado como `admin` del proyecto.
- Crear usuarios: solo `super_admin` (UI + API).

## API (resumen)

### Users
```
GET  /api/users   # Listar usuarios (super_admin/support/auditor)
POST /api/users   # Crear usuario (solo super_admin)
```

#### Crear usuario (payload)
```
{
  "email": "user@empresa.com",
  "password": "Minimo8",
  "projectId": "uuid-proyecto",
  "projectRole": "admin|editor|viewer",
  "fullName": "Nombre opcional",
  "isActive": true
}
```

## UI

- `/manager/users`: gestión de usuarios (visible en sidebar).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
