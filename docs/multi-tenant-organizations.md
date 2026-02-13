# Multi-Tenant Organization Architecture

## Overview

The application now supports multi-tenant data isolation through an **Organization** model. Every project belongs to exactly one organization, and all downstream entities (test plans, suites, cases, runs) inherit that scope through the project chain. Users can be members of multiple organizations and switch between them at runtime.

### Key Concepts

- **Organization**: A tenant boundary. All projects are scoped to an organization.
- **OrganizationMember**: A user's membership in an organization, with a role that controls org-level permissions.
- **Active Organization**: The organization a user is currently working in, stored in their JWT/session.
- **Data Isolation**: API queries are automatically filtered to the active organization. Users cannot access data from other organizations unless they are a super_admin.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Org `owner`/`admin` get implicit project admin access | Reduces need for explicit `ProjectMember` entries for org-level admins |
| `organizationId` only on `Project` and `AuditLog` | All other entities chain through `Project`, so a single join is sufficient |
| `Project.key` uniqueness is per-org (`@@unique([organizationId, key])`) | Different organizations can reuse the same project key |
| Super admins bypass org scoping | Preserves existing global admin behavior |
| Default Organization created during migration | Ensures backward compatibility; all existing data migrates seamlessly |

---

## Data Model

### New Enum: `OrgRole`

```
owner   - Full org control + implicit project admin for all projects in the org
admin   - Manage projects & members + implicit project admin
member  - Default role. Relies on ProjectMember for project access
billing - Read-only + billing (reserved for future use)
```

### New Tables

#### `organizations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `slug` | TEXT (unique) | URL-friendly identifier, 3-50 chars, lowercase alphanumeric + hyphens |
| `name` | TEXT | Display name |
| `is_active` | BOOLEAN | Default `true` |
| `created_by` | UUID (FK -> users) | Nullable, SET NULL on delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `organization_members`

| Column | Type | Notes |
|--------|------|-------|
| `organization_id` | UUID (PK, FK -> organizations) | CASCADE on delete |
| `user_id` | UUID (PK, FK -> users) | CASCADE on delete |
| `role` | OrgRole | Default `member` |
| `created_at` | TIMESTAMPTZ | |

### Modified Tables

#### `projects`

- **Added**: `organization_id UUID NOT NULL` (FK -> organizations, CASCADE on delete)
- **Changed**: `key` unique constraint from global `@unique` to composite `@@unique([organizationId, key])`
- **Added**: Index on `organization_id`

#### `audit_log`

- **Added**: `organization_id UUID` (nullable, FK -> organizations, SET NULL on delete)
- **Added**: Index on `organization_id`

#### `users`

- **Added relations only** (no column changes):
  - `organizationMemberships` -> `OrganizationMember[]`
  - `createdOrganizations` -> `Organization[]`

### Entity Relationship

```
Organization
  |-- OrganizationMember (userId, role)
  |-- Project (organizationId)
  |     |-- ProjectMember
  |     |-- TestPlan
  |     |     |-- TestSuite
  |     |     |     |-- TestCase
  |     |-- TestRun
  |     |     |-- TestRunItem
  |     |     |-- TestRunArtifact
  |     |     |-- TestRunMetrics
  |-- AuditLog (organizationId)
```

---

## Authentication & Authorization

### Session / JWT

Two new fields are added to the JWT token and session object:

```typescript
interface JWT {
  id?: string;
  globalRoles?: GlobalRole[];
  activeOrganizationId?: string;  // NEW
  organizationRole?: OrgRole;      // NEW
}
```

**Lifecycle:**
1. **Sign-in**: The JWT callback queries `OrganizationMember` for the user's first org (by `createdAt` ASC) and sets `activeOrganizationId` + `organizationRole`.
2. **Org switch**: Client calls `POST /api/organizations/switch`, then triggers a session update with `{ activeOrganizationId }`. The JWT callback validates membership and updates the token.
3. **Session**: The session callback maps these fields from token to session.

### Authorization Evaluation Order

The policy engine (`src/lib/auth/policy-engine.ts`) evaluates permissions in this order:

1. **Global roles** - If any global role (e.g. `super_admin`) grants the permission, allow immediately. No DB query.
2. **Organization role** - If the user's org role (`owner`/`admin`) grants the permission, allow. This provides implicit project admin access across all projects in the org.
3. **Project role** - If a `projectId` is provided, check `ProjectMember` for the user's role in that project.
4. **Ownership rule** - If the user owns the resource and has at least viewer access, allow `:update` actions.

### Organization Role Permissions

| Role | Permissions |
|------|-------------|
| `owner` | All permissions except `user:create` (stays global-only) |
| `admin` | All project-scoped CRUD + `project:create` + `org:update` + `org-member:list` + `org-member:manage` |
| `member` | `project:list` + `org:list` + `org-member:list` (relies on project roles for everything else) |
| `billing` | `project:list` + `org:list` |

### New Permissions

```
org:list          - List organizations
org:create        - Create an organization
org:update        - Update organization details
org:delete        - Delete an organization
org-member:list   - List organization members
org-member:manage - Add/remove/update member roles
```

---

## API Endpoints

### New Organization Routes

#### `GET /api/organizations`
List organizations the current user belongs to. Super admins see all.

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "slug": "my-org",
      "name": "My Organization",
      "isActive": true,
      "_count": { "members": 5, "projects": 3 }
    }
  ]
}
```

#### `POST /api/organizations`
Create a new organization. The creator becomes `owner`.

**Request:**
```json
{
  "slug": "my-org",
  "name": "My Organization"
}
```

**Requires:** `org:create` permission (global role only).

#### `GET /api/organizations/:id`
Get organization details.

#### `PUT /api/organizations/:id`
Update organization name, slug, or active status.

**Requires:** `org:update` permission.

#### `DELETE /api/organizations/:id`
Delete an organization (cascades to all projects).

**Requires:** `org:delete` permission.

#### `GET /api/organizations/:id/members`
List all members of an organization.

**Requires:** `org-member:list` permission.

#### `POST /api/organizations/:id/members`
Add a user to an organization.

**Request:**
```json
{
  "userId": "uuid",
  "role": "member"
}
```

**Requires:** `org-member:manage` permission.

#### `PUT /api/organizations/:id/members/:userId`
Update a member's role.

**Request:**
```json
{
  "role": "admin"
}
```

**Requires:** `org-member:manage` permission.
**Constraint:** Cannot demote or remove the last `owner`.

#### `DELETE /api/organizations/:id/members/:userId`
Remove a member from an organization.

**Requires:** `org-member:manage` permission.
**Constraint:** Cannot remove the last `owner`.

#### `POST /api/organizations/switch`
Switch the active organization. Returns org info for the client to update the session.

**Request:**
```json
{
  "organizationId": "uuid"
}
```

**Response:**
```json
{
  "activeOrganizationId": "uuid",
  "organizationRole": "admin",
  "organization": {
    "id": "uuid",
    "slug": "my-org",
    "name": "My Organization",
    "isActive": true
  }
}
```

After receiving the response, the client must call `update({ activeOrganizationId })` on the NextAuth session to persist the switch in the JWT.

### Modified Routes - Org Scoping

All existing list/create routes now scope queries to the active organization:

| Route | Scoping pattern |
|-------|----------------|
| `GET /api/projects` | `{ organizationId: activeOrganizationId }` |
| `POST /api/projects` | Sets `organizationId` on create; requires active org |
| `PUT/DELETE /api/projects/:id` | Verifies project belongs to active org |
| `GET /api/test-plans` | `{ project: { organizationId } }` |
| `GET /api/test-suites` | `{ testPlan: { project: { organizationId } } }` |
| `GET /api/test-cases` | `{ suite: { testPlan: { project: { organizationId } } } }` |
| `GET /api/test-runs` | `{ project: { organizationId } }` |
| `GET /api/users` | `{ organizationMemberships: { some: { organizationId } } }` (non-super-admin only) |
| `POST /api/users` | Auto-adds new user as `member` of active org |
| Dashboard (`/manager`) | All aggregate queries scoped to active org |

**Behavior for org `owner`/`admin`:**
Users with `owner` or `admin` org role see all projects in the organization without requiring explicit `ProjectMember` entries. The project membership filter is only applied for `member` and `billing` org roles.

**Behavior for super admins:**
Super admins without an active org see all data globally (existing behavior preserved).

---

## Data Migration

Migration file: `prisma/migrations/20260212000000_add_organizations/migration.sql`

The migration performs these steps in order:

1. Creates `organizations` and `organization_members` tables
2. Adds `organization_id` column to `projects` (nullable initially)
3. Inserts a **Default Organization** (slug: `default`)
4. Assigns all existing users as organization members:
   - Users with `super_admin` global role -> org role `owner`
   - All other users -> org role `member`
5. Sets all existing projects' `organization_id` to the default org
6. Makes `organization_id` NOT NULL on `projects`
7. Drops the old global unique constraint on `projects.key`, creates the composite `(organization_id, key)` unique
8. Adds `organization_id` to `audit_log` (nullable), backfills from project where entity_type is `project`
9. Creates indexes and foreign keys

### Running the Migration

```bash
npx prisma migrate deploy
```

For development:
```bash
npx prisma migrate dev
```

---

## Client-Side Integration (Future UI)

### Switching Organizations

```typescript
// 1. Call the switch API
const res = await fetch("/api/organizations/switch", {
  method: "POST",
  body: JSON.stringify({ organizationId: "target-org-id" }),
});
const data = await res.json();

// 2. Update the NextAuth session to persist in JWT
await update({ activeOrganizationId: data.activeOrganizationId });
```

### Reading Active Organization

```typescript
// In a React component
const { activeOrganizationId, organizationRole } = usePermissions();

// In a server component
const session = await getServerSession(authOptions);
const orgId = session?.user?.activeOrganizationId;
```

### Permission Checks

The `useCan()` and `usePermissions()` hooks now account for org role in their synchronous checks:

```typescript
const { can } = usePermissions();

// This returns true for org owners/admins even without a ProjectMember entry
const canCreateProject = can(PERMISSIONS.PROJECT_CREATE);
```

---

## File Inventory

### New Files (6)

| File | Purpose |
|------|---------|
| `src/app/api/organizations/route.ts` | List / create organizations |
| `src/app/api/organizations/[id]/route.ts` | Get / update / delete organization |
| `src/app/api/organizations/[id]/members/route.ts` | List / add org members |
| `src/app/api/organizations/[id]/members/[userId]/route.ts` | Update role / remove member |
| `src/app/api/organizations/switch/route.ts` | Switch active organization |
| `prisma/migrations/20260212000000_add_organizations/migration.sql` | Schema + data migration |

### Modified Files (16)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `OrgRole` enum, `Organization`, `OrganizationMember` models; modified `User`, `Project`, `AuditLog` |
| `src/types/next-auth.d.ts` | Added `activeOrganizationId`, `organizationRole` to session/JWT types |
| `src/lib/auth.ts` | JWT callback loads org on sign-in, handles org switching |
| `src/lib/auth/policy-engine.ts` | Added org role check in `can()` and `canSync()` |
| `src/lib/auth/permissions.constants.ts` | Added 6 org permissions |
| `src/lib/auth/role-permissions.map.ts` | Added `ORG_ROLE_PERMISSIONS` map and `orgRoleHasPermission()` |
| `src/lib/auth/with-auth.ts` | Added org fields to `AuthContext` |
| `src/lib/auth/use-can.ts` | Updated hooks to pass org role |
| `src/lib/auth/require-run-permission.ts` | Added org context parameters |
| `src/lib/auth/index.ts` | Updated barrel exports |
| `src/app/api/projects/route.ts` | Org scoping on list + org ID on create |
| `src/app/api/projects/[id]/route.ts` | Org boundary check on update/delete |
| `src/app/api/test-plans/route.ts` | Org filter via `project.organizationId` |
| `src/app/api/test-suites/route.ts` | Org filter via `testPlan.project.organizationId` |
| `src/app/api/test-cases/route.ts` | Org filter via `suite.testPlan.project.organizationId` |
| `src/app/api/test-runs/route.ts` | Org filter via `project.organizationId` |
| `src/app/api/test-runs/[id]/route.ts` | Org context in permission checks |
| `src/app/api/test-runs/[id]/metrics/route.ts` | Org context in `requireRunPermission` calls |
| `src/app/api/test-runs/[id]/items/route.ts` | Org context in `requireRunPermission` calls |
| `src/app/api/test-runs/[id]/artifacts/route.ts` | Org context in `requireRunPermission` calls |
| `src/app/api/test-runs/[id]/artifacts/[artifactId]/route.ts` | Org context in `requireRunPermission` calls |
| `src/app/api/test-runs/[id]/artifacts/upload/route.ts` | Org context in `requireRunPermission` calls |
| `src/app/api/users/route.ts` | Scope listing to org; auto-add to org on create |
| `src/app/manager/page.tsx` | Scope dashboard stats to active org |
