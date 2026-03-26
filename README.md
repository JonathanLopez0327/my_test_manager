# Test Manager

A modern, comprehensive Test Management System built with **Next.js**, **Prisma**, and **Tailwind CSS**. This dashboard allows QA teams to organize projects, test plans, suites, cases, and track execution runs with detailed metrics.

## 🚀 Features

-   **Multi-tenant Organizations**: Workspaces scoped by organization with membership and role controls.
-   **Project Management**: Create and manage multiple projects inside each organization.
-   **Test Planning**: Define test plans with start/end dates and status tracking.
-   **Test Case Management**:
    -   Organize cases into structured Test Suites (supports hierarchy/nesting).
    -   Detailed test case steps, preconditions, and priorities.
    -   Multiple styles: step-by-step, Gherkin, data-driven, and API-style cases.
    -   Automation status tracking.
-   **Execution Tracking**:
    -   Create Test Runs (Manual or Automated).
    -   Record results (Passed, Failed, Skipped etc.).
    -   Upload artifacts (Screenshots, Logs) to runs.
-   **Bug Tracking**:
    -   Link defects to test cases and run items.
    -   Track severity, status, assignee, comments, and lifecycle updates.
-   **AI Chat Workspace**:
    -   Project-scoped AI conversations with persisted chat history.
    -   API-token based secure agent integration.
-   **Dashboard & Analytics**:
    -   Real-time statistics on projects, execution rates, and failures.
    -   Automation coverage metrics.
-   **Landing Feedback Capture**:
    -   Public landing form to collect platform feedback and improvement requests.
-   **User Management**:
    -   Project roles (Admin, Editor, Viewer).
    -   Organization roles (Owner, Admin, Member, Billing).
    -   Global roles (Super Admin, Support, Auditor).

## 🛠 Tech Stack

-   **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
-   **Database**: [PostgreSQL](https://www.postgresql.org/)
-   **ORM**: [Prisma](https://www.prisma.io/)
-   **Authentication**: [NextAuth.js](https://next-auth.js.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
-   **Storage**: AWS S3 (via `@aws-sdk/client-s3`) for artifacts.

## 📦 Data Model

The core entities in the system are:

-   **Organization**: Tenant boundary for members, projects, audit logs, and tokens.
-   **Project**: Container for plans, runs, bugs, and AI conversations.
-   **Test Plan**: A collection of suites/dates for a specific testing phase.
-   **Test Suite**: Grouping mechanism for test cases (supports parent/child hierarchy).
-   **Test Case**: Individual test scenarios with steps and expectations.
-   **Test Run**: An execution instance of a Plan or Suite (contains `TestRunItems` with results).
-   **Artifacts**: Evidence files (logs/screenshots/reports/links) attached to runs or run items.
-   **Bug**: Defect records associated with project, test case, and/or run item.
-   **ApiToken / AgentTokenSecret**: Token infrastructure for integrations and AI agents.
-   **AiConversation / AiConversationMessage**: Persistent project chat history.
-   **PlatformFeedback**: Public feedback submissions captured from the landing page.

## ⚡ Getting Started

### Prerequisites

-   Node.js 20+
-   PostgreSQL database
-   pnpm (recommended)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd my_test_manager
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/test_manager?schema=public"
    NEXTAUTH_SECRET="your-super-secret-key"
    NEXTAUTH_URL="http://localhost:3000"
    GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET="your-google-client-secret"

    # S3/MinIO storage for artifacts
    S3_ENDPOINT="http://localhost:9000"
    S3_ACCESS_KEY="your-access-key"
    S3_SECRET_KEY="your-secret-key"
    S3_REGION="us-east-1"
    S3_BUCKET="test-manager-artifacts"
    S3_PUBLIC_URL="http://localhost:9000"

    # AI chat integration
    LANGGRAPH_API_URL="http://localhost:2024"
    LANGGRAPH_QA_ID="your-assistant-id"
    NEXT_PUBLIC_LANGGRAPH_API_KEY="your-langgraph-api-key"
    AI_AGENT_TOKEN_ENCRYPTION_KEY="base64-encoded-32-byte-key"

    # Optional AI token lifecycle controls
    AI_AGENT_TOKEN_TTL_DAYS="90"
    AI_AGENT_TOKEN_ROTATE_BEFORE_DAYS="7"
    ```

4.  **Database Setup**:
    ```bash
    # Generate Prisma client
    pnpm prisma generate

    # Apply migrations
    pnpm prisma migrate dev

    # Seed base data
    pnpm prisma db seed
    ```

5.  **Run Development Server**:
    ```bash
    pnpm dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Scripts

-   `pnpm dev`: Start the development server.
-   `pnpm build`: Build the application for production.
-   `pnpm start`: Start the production server.
-   `pnpm lint`: Run ESLint.
-   `pnpm test`: Run Jest tests.
-   `pnpm test:watch`: Run Jest in watch mode.

## ✅ Deployment Checklist

### Pre-deploy

1. Configure environment variables (see `.env.example`):
   - Required in runtime: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_PUBLIC_URL`, `LANGGRAPH_API_URL`, `LANGGRAPH_QA_ID`, `NEXT_PUBLIC_LANGGRAPH_API_KEY`, `AI_AGENT_TOKEN_ENCRYPTION_KEY`
   - Seed-only variables: `SEED_QA_EMAIL`, `SEED_QA_PASSWORD`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`
   - Optional controls: `AI_AGENT_TOKEN_TTL_DAYS`, `AI_AGENT_TOKEN_ROTATE_BEFORE_DAYS` (when `NEXT_PUBLIC_LANGGRAPH_API_KEY` is missing, chat falls back only in development and fails in production).
   - `NODE_ENV` is set by the hosting platform.
2. Ensure auth guard is active for manager routes via `src/proxy.ts` matcher (`/manager/:path*`).
3. Validate quality gates:
   ```bash
   pnpm lint
   pnpm test -- --runInBand
   pnpm build
   ```
4. Confirm DB schema compatibility (`pnpm exec prisma validate`) and run migrations in target environment (if needed by your release).

### Post-deploy smoke test

1. Sign in and verify unauthenticated access to `/manager/*` redirects to `/login`.
2. Validate core flow: create project -> plan -> suite/case -> run -> record result -> upload artifact.
3. Verify AI chat endpoint can resolve `LANGGRAPH_API_URL` and responds without 500 errors.
4. Confirm artifact upload/download works against configured S3 bucket and URL.


