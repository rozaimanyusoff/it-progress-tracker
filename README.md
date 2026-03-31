# IT Progress Tracker

A web application for IT teams to track project progress, manage features and tasks, log issues, and generate monthly progress reports.

Built with **Next.js 16**, **Prisma 7**, **PostgreSQL**, and **NextAuth.js v4**.

---

## Features

- Role-based access: **Manager** and **Member** roles
- Project management with status tracking and timelines
- Feature & task breakdown per project (SDLC-aware)
- Kanban board for task management
- Issue tracking with severity levels
- Developer analytics dashboard
- Monthly PPTX progress report export with email delivery
- Account activation via email
- Audit log for all key actions

---

## Tech Stack

| Layer     | Technology              |
| --------- | ----------------------- |
| Framework | Next.js 16 (App Router) |
| Language  | TypeScript              |
| Database  | PostgreSQL              |
| ORM       | Prisma 7                |
| Auth      | NextAuth.js v4          |
| Styling   | Tailwind CSS            |
| Email     | Nodemailer (Gmail SMTP) |
| Reports   | pptxgenjs               |

---

## Directory Structure

```
it-progress-tracker/
├── prisma/
│   ├── migrations/          # Database migration history
│   ├── schema.prisma        # Database schema (no url — moved to prisma.config.ts)
│   └── seed.ts              # Seed data (units, default manager)
├── prisma.config.ts         # Prisma 7 config — datasource URL & migrations path
├── public/
│   └── uploads/tasks/       # Uploaded task media files
├── src/
│   ├── app/
│   │   ├── activate/        # Account activation & password setup
│   │   ├── admin/           # Admin panel (user management)
│   │   ├── api/
│   │   │   ├── admin/users/ # User CRUD + resend activation email
│   │   │   ├── analytics/   # Developer productivity analytics
│   │   │   ├── auth/        # NextAuth.js handler
│   │   │   ├── export/      # Monthly PPTX report generation & email
│   │   │   ├── features/    # Feature management
│   │   │   ├── issues/      # Issue tracking
│   │   │   ├── logs/        # Audit logs
│   │   │   ├── projects/    # Project CRUD
│   │   │   ├── tasks/       # Task management & task updates
│   │   │   ├── units/       # Organisational units
│   │   │   ├── updates/     # Project progress updates
│   │   │   ├── upload/      # Media file uploads
│   │   │   └── users/       # User profile
│   │   ├── dashboard/       # Main dashboard
│   │   ├── export/          # Export report UI
│   │   ├── issues/          # Issues page
│   │   ├── kanban/          # Kanban board
│   │   ├── login/           # Login page
│   │   ├── logs/            # Audit log viewer
│   │   ├── manager/         # Manager-specific views
│   │   └── projects/        # Projects listing & detail
│   ├── components/          # Reusable React components
│   │   ├── AddFeatureModal.tsx
│   │   ├── DeveloperAnalytics.tsx
│   │   ├── FeatureTaskList.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── GanttChart.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   └── TaskUpdateModal.tsx
│   ├── lib/
│   │   ├── auth.ts          # NextAuth configuration
│   │   ├── email.ts         # Email sending (activation, export)
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── pptx.ts          # PPTX report builder
│   │   └── sdlc-tasks.ts    # Predefined SDLC task templates
│   └── types/
│       └── next-auth.d.ts   # NextAuth session type extensions
├── .env.example             # Environment variable template
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (running locally or remote)
- A Gmail account with **App Password** enabled (for email features)

### 1. Clone and install

```bash
git clone <repo-url>
cd it-progress-tracker
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/it_tracker"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret"   # openssl rand -base64 32

# Gmail SMTP — must use an App Password, not your Gmail login password
# See: https://myaccount.google.com/apppasswords
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"              # 16-char Google App Password
SMTP_FROM="IT Tracker <your-email@gmail.com>"
```

> **SMTP_PASS must be a Google App Password.**
> Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create an app password for "Mail", and paste the 16-character code here.
> Your normal Gmail password will not work — Gmail blocks it when 2-Step Verification is enabled.

### 3. Set up the database

```bash
# Apply all migrations
npx prisma migrate deploy

# (Optional) Seed initial data — creates units and a default manager account
npm run db:seed
```

> **Prisma 7 note:** This project uses Prisma 7, which requires a driver adapter.
> The database URL is configured in `prisma.config.ts` (not in `schema.prisma`).
> The `PrismaClient` in `src/lib/prisma.ts` uses `@prisma/adapter-pg` automatically.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default credentials (after seeding)

| Email            | Password   | Role    |
| ---------------- | ---------- | ------- |
| `admin@it.local` | `admin123` | Manager |

---

## Available Scripts

| Script              | Description                            |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Start development server               |
| `npm run build`     | Build for production                   |
| `npm run start`     | Start production server                |
| `npm run db:push`   | Push schema changes without migrations |
| `npm run db:seed`   | Seed the database                      |
| `npm run db:studio` | Open Prisma Studio (DB GUI)            |

---

## User Roles

| Role        | Capabilities                                                          |
| ----------- | --------------------------------------------------------------------- |
| **Manager** | Full access — manage users, projects, features, tasks, export reports |
| **Member**  | View assigned projects, update task progress, log issues              |

---

## Syncing Migrations Between Machines (Office ↔ Home)

This project uses two separate local PostgreSQL databases — one at the office and one at home. Whenever the schema changes on one machine, the other machine must be synced manually.

### Workflow: After pulling latest code from Git

Always run these commands after `git pull` to ensure your local DB is in sync:

```bash
git pull

npm install                   # in case new packages were added
npx prisma generate           # regenerate Prisma Client
npx prisma migrate deploy     # apply any new migrations to your local DB
```

### Workflow: When you add a new migration

When you create a schema change and generate a new migration:

```bash
# 1. Edit prisma/schema.prisma with your changes
# 2. Create and apply the migration
npx prisma migrate dev --name describe_your_change

# 3. Commit and push the new migration file
git add prisma/migrations/
git commit -m "migration: describe_your_change"
git push
```

Then on the **other machine**, after pulling:

```bash
git pull
npx prisma migrate deploy
```

### Common migration errors and fixes

| Error                                                    | Cause                                                    | Fix                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `Migration history diverged`                             | A migration exists in DB but not in `prisma/migrations/` | Run `npx prisma migrate resolve --applied <migration_name>` or reset |
| `Drift detected`                                         | DB schema doesn't match migration history                | Run `npx prisma migrate dev` and follow prompts                      |
| `Cannot find module '@prisma/client/runtime/library.js'` | Prisma Client not regenerated                            | Run `npx prisma generate`                                            |
| `PrismaClientConstructorValidationError`                 | Missing driver adapter                                   | Ensure `src/lib/prisma.ts` uses `@prisma/adapter-pg`                 |

### ⚠️ Never use `prisma migrate reset` in production

`prisma migrate reset` **drops all data**. Only use it in local dev when you are okay losing all data and reseeding from scratch:

```bash
npx prisma migrate reset   # drops DB, re-runs all migrations, then seeds
```
