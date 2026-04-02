# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server (Turbopack enabled)
npm run build        # Production build
npm run lint         # ESLint via Next.js

# Database
npm run db:push      # Sync Prisma schema to DB (no migration file created)
npm run db:seed      # Seed initial data (admin user + org units)
npm run db:studio    # Open Prisma Studio GUI

# Run a migration (creates migration file + applies it)
npx prisma migrate dev --name <migration_name>

# Sync migrations on another machine (home ↔ office workflow)
npx prisma migrate deploy
```

There is no test suite — the project uses TypeScript strict mode and ESLint for correctness.

## Architecture

**Full-stack Next.js 16 App Router** application with API routes as the backend. All routes are in `src/app/`, components in `src/components/`, shared utilities in `src/lib/`.

### Auth & Sessions
- NextAuth.js v4 with JWT strategy, configured in `src/lib/auth.ts`
- Two roles: `manager` and `member` — role is embedded in the JWT session
- Managers get access to `/admin/users`, `/projects/new`, and team-wide views
- Session user object is extended in `src/types/next-auth.d.ts`

### Database
- **Prisma 7** with `@prisma/adapter-pg` (native `pg` driver adapter, not the default connector)
- Prisma client singleton is in `src/lib/prisma.ts` — import from here, never instantiate directly
- Configuration lives in `prisma.config.ts` (Prisma 7 style), not inside `schema.prisma`
- 11 models: User, Project, Module, Feature, Deliverable, Task, ProjectUpdate, Issue, AuditLog, AppSetting, plus junction tables FeatureDeveloper and ProjectAssignee

### Key Data Relationships
- Projects → Modules → Features/Deliverables → Tasks (hierarchical)
- Features and Deliverables both have Tasks; Tasks link to one or the other (not both)
- Tasks have time tracking fields (`time_started_at`, `time_spent_seconds`, `review_count`)
- Every mutating action should write an AuditLog entry (CREATE/UPDATE/DELETE/LOGIN/LOGOUT)

### API Route Conventions
- All API routes live under `src/app/api/`
- Role checks are done inline by reading the session: `getServerSession(authOptions)`
- File uploads go to `public/uploads/tasks/` via `/api/files/upload`

### Key Libraries
- **`src/lib/pptx.ts`** (52KB) — PPTX report generator using `pptxgenjs`; called from `/api/projects/[id]/export`
- **`src/lib/email.ts`** — Nodemailer wrapper (Gmail SMTP); used for account activation, task notifications, and emailing PPTX reports
- **`src/lib/sdlc-tasks.ts`** — Predefined SDLC task templates used when creating tasks

### Styling
- Tailwind CSS with dark mode via `class` strategy (`next-themes`)
- Custom navy color palette defined in `tailwind.config.ts`
- Theme color is stored in `AppSetting` and applied as a CSS variable in the root layout

### Environment Variables
Required in `.env` (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` + `NEXTAUTH_SECRET`
- `SMTP_HOST/PORT/USER/PASS/FROM` — Gmail SMTP; `SMTP_PASS` must be a Google App Password (16-char), not the account password
