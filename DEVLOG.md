# Development Log — IT Progress Tracker

Rekod semua perubahan, penambahan feature, dan pembaikan yang dilakukan pada codebase.
Format: **terbaru di atas**.

---

## [Unreleased]
> Perubahan yang sedang dalam pembangunan, belum di-commit/deploy.

---

## 2026-03-18 — Dark / Light Mode + Theme-aware UI

**Branch:** `main`

### Ditambah
- **Dark/Light mode toggle** — Toggle button dalam sidebar (☀ / ☾) untuk tukar tema
- **`next-themes`** — Library untuk manage theme state dengan SSR-safe hydration
- **`ThemeProvider`** dalam `providers.tsx` — default theme: `dark`

### Diubah
- `tailwind.config.ts` — Tambah `darkMode: 'class'`
- `globals.css` — Light mode body: `bg-slate-100`, dark text; dark mode kekal navy
- `layout.tsx` — Tambah `suppressHydrationWarning` pada `<html>`
- `Layout.tsx` — Ganti inline style dengan `bg-slate-100 dark:bg-navy-900`
- `Sidebar.tsx` — Semua warna guna Tailwind `dark:` variants; tambah theme toggle button
- `DashboardClient.tsx` — Semua cards, project list, modals dan forms guna `dark:` variants
- `manager/page.tsx` — Stats cards, unit tables, header rows theme-aware
- `issues/page.tsx` — Table, filter selects, severity badges theme-aware
- `logs/page.tsx` — Table dan action badges theme-aware
- `projects/new/page.tsx` — Form card dan semua inputs theme-aware
- `projects/[id]/page.tsx` — Header card, progress timeline, issues panel theme-aware
- `export/page.tsx` — Preview cards dan unit headers theme-aware
- `admin/users/page.tsx` — Table dan add member form theme-aware
- `login/page.tsx` — Login card dan inputs theme-aware
- `activate/[token]/page.tsx` — Semua states dan form card theme-aware

### Diperbaiki
- Prisma CLI v6/v7 version mismatch — downgrade kedua `prisma` dan `@prisma/client` ke v6, jalankan `prisma generate`
- `middleware.ts` — Ganti re-export syntax dengan `withAuth({})` untuk Next.js 16 compatibility

---

## 2026-03-18 — Initial Release + User Management

**Commit:** `e0bc60f`
**Branch:** `main`

### Ditambah
- **Project setup** — Next.js 14 App Router, Prisma ORM (PostgreSQL), NextAuth v4, Tailwind CSS
- **Authentication** — Login dengan credentials (email + password), JWT session, role-based access (manager / member)
- **Dashboard** — Overview project dan isu mengikut role
- **Manager View** — Ringkasan semua unit dan project status
- **Project Management** — Create, view, dan update project; track progress percentage dan status
- **Issue Tracking** — Log isu projek dengan severity (low / medium / high), resolve/reopen
- **Audit Logs** — Rekod semua tindakan dalam sistem (manager only)
- **Export** — Jana laporan bulanan dalam format PPTX dan hantar via email
- **User Management (`/admin/users`)** — Manager boleh tambah team member
  - Hantar invitation email dengan activation link (expire 24 jam)
  - Member activate account sendiri: set password + verify password
  - Resend invitation jika link expired
  - Remove member dari sistem
- **Prisma schema** — Models: `User`, `Unit`, `Project`, `ProjectUpdate`, `Issue`, `AuditLog`
- **Email service** — Nodemailer SMTP untuk activation email dan export report
- **Seed data** — 3 units, 4 users (1 manager + 3 members), 3 projects, sample updates dan issues

### Schema
```
User         — id, name, email, password_hash, role, unit_id, is_active,
               activation_token, activation_token_expiry, created_at
Unit         — id, name
Project      — id, title, description, unit_id, owner_id, start_date, deadline, status, created_at
ProjectUpdate — id, project_id, user_id, progress_pct, status, notes, created_at
Issue        — id, project_id, user_id, title, description, severity, resolved, created_at
AuditLog     — id, user_id, action, target_type, target_id, metadata, created_at
```

### Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL via Prisma 5 |
| Auth | NextAuth v4 (Credentials + JWT) |
| Email | Nodemailer (SMTP) |
| Styling | Tailwind CSS 3 |
| Language | TypeScript |

---

## Cara Update Log Ini

Setiap kali ada perubahan pada codebase, tambah entry baru **di atas** dengan format berikut:

```markdown
## YYYY-MM-DD — Tajuk ringkas

**Commit:** `<hash>`
**Branch:** `<branch>`

### Ditambah
- ...

### Diubah
- ...

### Diperbaiki
- ...

### Dibuang
- ...
```

Gunakan hanya bahagian yang relevan (`Ditambah`, `Diubah`, `Diperbaiki`, `Dibuang`).

---
