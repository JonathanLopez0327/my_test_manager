# Test Manager

A modern, comprehensive Test Management System built with **Next.js**, **Prisma**, and **Tailwind CSS**. This dashboard allows QA teams to organize projects, test plans, suites, cases, and track execution runs with detailed metrics.

## 🚀 Features

-   **Project Management**: Create and manage multiple projects.
-   **Test Planning**: Define test plans with start/end dates and status tracking.
-   **Test Case Management**:
    -   Organize cases into structured Test Suites (supports hierarchy/nesting).
    -   Detailed test case steps, preconditions, and priorities.
    -   Automation status tracking.
-   **Execution Tracking**:
    -   Create Test Runs (Manual or Automated).
    -   Record results (Passed, Failed, Skipped etc.).
    -   Upload artifacts (Screenshots, Logs) to runs.
-   **Dashboard & Analytics**:
    -   Real-time statistics on projects, execution rates, and failures.
    -   Automation coverage metrics.
-   **User Management**:
    -   Role-based access control (Admin, Editor, Viewer).
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

-   **Project**: The top-level container.
-   **Test Plan**: A collection of suites/dates for a specific testing phase (e.g., "Release 1.0").
-   **Test Suite**: Grouping mechanism for test cases (supports parent/child hierarchy).
-   **Test Case**: Individual test scenarios with steps and expectations.
-   **Test Run**: An execution instance of a Plan or Suite (contains `TestRunItems` with results).

## ⚡ Getting Started

### Prerequisites

-   Node.js 18+
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
    
    # Optional: S3 for Artifacts
    S3_REGION="us-east-1"
    S3_ACCESS_KEY_ID="your-access-key"
    S3_SECRET_ACCESS_KEY="your-secret-key"
    S3_BUCKET_NAME="your-bucket-name"
    ```

4.  **Database Setup**:
    ```bash
    # Generate Prisma client
    pnpm prisma generate

    # Push schema to database
    pnpm prisma db push

    # (Optional) Seed initial data
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
-   `pnpm db:push`: Push Prisma schema changes to the database.
