# Development Log — IT Progress Tracker

Rekod semua perubahan, penambahan feature, dan pembaikan yang dilakukan pada codebase.
Format: **terbaru di atas**.

---

## [Unreleased]
> Perubahan yang sedang dalam pembangunan, belum di-commit/deploy.

---

## 2026-03-30 — Deliverables, Gantt Dual-Bar & Manager Kanban Restrictions

### Ditambah
- **`Deliverable` model (Prisma)** — Model baharu untuk work breakdown dalam project: `project_id`, `module_id?`, `title`, `description`, `status`, `mandays`, `planned_start DateTime?`, `planned_end DateTime?`, `actual_start DateTime?`, `actual_end DateTime?`, `order`, `created_at`
- **Migration `20260330100000_add_deliverables`** — Create `Deliverable` table; tambah `deliverable_id` pada `Task`; buat `Task.feature_id` nullable
- **Migration `20260330110000_add_dates_to_module_deliverable`** — Tambah `start_date`, `end_date` pada `Module`; `planned_start`, `planned_end` pada `Deliverable`
- **`GET/POST /api/projects/[id]/deliverables`** — List dan create deliverables untuk sesebuah project; task tidak lagi dijana secara SDLC — kosong dan ditambah secara manual
- **`PUT/DELETE /api/deliverables/[id]`** — Kemaskini dan padam deliverable (cascade tasks)
- **`src/components/DeliverableSection.tsx`** — Komponen baharu "Modules & Deliverables":
  - Manager boleh tambah module (dengan `start_date`/`end_date`) kemudian deliverable di bawahnya, atau terus tambah deliverable tanpa module
  - Header badge tunjuk bilangan modul (biru) dan deliverable (indigo)
  - Setiap modul bertanda badge "MODULE" biru; setiap deliverable bertanda "DELIVERABLE" violet
  - Butang "View Tasks" tunjuk kiraan semasa `Tasks (N)`
  - Papar planned & actual dates bersebelahan dalam kad deliverable
  - Validasi tarikh: mesti dalam julat tarikh projek; start tidak boleh melebihi end

### Diubah
- **`GanttChart.tsx`** — Prop `features` → `deliverables` (`GanttDeliverable`); tambah `embedded?: boolean` prop untuk strip outer card border apabila dirender dalam kad lain; setiap baris kini render dua bar: planned (kelabu nipis, atas) + actual (berwarna, bawah); legend tambah "Planned"; `computeRange` ambil kira `planned_start`/`planned_end`
- **`src/app/projects/[id]/page.tsx`** — Buang FeaturesSection, Progress Timeline, dan Issues grid; Gantt chart dipindahkan masuk ke dalam header kad projek (divider `border-b`); `GanttChart` guna prop `embedded`; `DeliverableSection` terima `projectStartDate` dan `projectDeadline`
- **`src/app/projects/[id]/timeline/page.tsx`** & **`/api/projects/[id]/timeline/route.ts`** — Fetch `deliverables` (bukan `featureLinks`); kembalikan `planned_start`/`planned_end` dalam response
- **`GET /api/tasks/team`** — Tukar query dari feature-only kepada OR query: cari task melalui `feature.project_links` atau `deliverable.project_id`; normalize output kepada bentuk `context: { type: 'feature'|'deliverable', id, title, module, project }`
- **`GET/POST /api/tasks`** — Sokong `?feature_id=` atau `?deliverable_id=`; POST terima sama ada `feature_id` atau `deliverable_id`
- **`GET/POST /api/modules`** & **`PUT /api/modules/[id]`** — Terima `start_date` dan `end_date`
- **`PUT /api/tasks/[id]`** — Fix: `recalculateFeatureDates` hanya dipanggil jika `task.feature_id != null`
- **`POST /api/tasks/[id]/self-assign`** — Fix: guna optional chaining `task.feature?.project_links.some(...) ?? false` (feature kini nullable)
- **`FeatureTaskList.tsx`** — Prop `featureId` kini optional; tambah `deliverableId?: number`; query API guna parameter yang berkenaan
- **`TeamKanbanBoard.tsx`** — Interface `Task` guna `context` (bukan `feature`); card papar badge `Deliv`/`Feat`; manager hanya nampak butang "Review" (kuning) untuk task berstatus `InReview` — tidak boleh kemaskini task Todo/InProgress ahli pasukan

### Diperbaiki
- **`PUT /api/tasks/[id]`** — TypeScript error: `feature_id` kini `number | null`, dilindungi dengan null check sebelum panggil `recalculateFeatureDates`
- **`POST /api/tasks/[id]/self-assign`** — TypeScript error: `task.feature` kini optional, guna `?.` untuk elak crash

### Dibuang
- **Predefined SDLC tasks** — Deliverable tidak lagi auto-generate task SDLC semasa creation
- **FeaturesSection** dari halaman detail projek — digantikan oleh `DeliverableSection`
- **Progress Timeline & Issues grid** dari halaman detail projek

---

## 2026-03-29 — Projects Page: List, New Project & Features Management

### Ditambah
- **`src/app/projects/page.tsx`** — Halaman baru `/projects` dengan tiga tab:
  - **Projects** — Senarai semua projek dalam grid kad; klik untuk navigasi ke detail projek; butang "+ New Project" untuk beralih ke tab New Project; tunjuk status, progress bar berdasarkan tarikh, assignee avatars, overdue indicator, dan issue count
  - **New Project** — Borang inline untuk cipta projek baru (dipindah dari `/projects/new`); redirect balik ke tab Projects selepas berjaya
  - **Features** — Dipindah dari Settings > Features tab; pilih projek, tambah feature dengan auto-calc mandays berdasarkan hari bekerja (Mon-Fri)

### Diubah
- **`src/components/Sidebar.tsx`** — Tukar "New Project" menu kepada "Projects" (`/projects`); active prefix termasuk `/projects/*`; Dashboard active prefix tidak lagi termasuk `/projects/`
- **`src/app/settings/page.tsx`** — Buang tab "Features" (dipindah ke halaman Projects)

---

## 2026-03-29 — TaskUpdateModal: Thumbnail Grid for Attachments

### Diubah
- **`TaskUpdateModal.tsx`** — Preview sebelum submit: tambah file count label, video tunjuk play icon overlay (▶), filename di bawah thumbnail
- **`TaskUpdateModal.tsx`** — Update history: media kini dipapar sebagai 80×80 thumbnail grid (konsisten dengan preview); klik thumbnail buka full view dalam tab baru; video tunjuk poster + play overlay; dokumen (PDF/DOCX/XLSX) tunjuk icon + label ext

---

## 2026-03-29 — Kanban: Task Update Modal Overhaul + Status Flow Fix

### Diperbaiki
- **`POST /api/tasks/[id]/updates`** — Bug `Forbidden`: `session.user.id` adalah string, `task.assigned_to` adalah number; kini guna `Number(userId)` untuk comparison yang betul
- **`POST /api/tasks/[id]/updates`** — Tambah time tracking: Todo→InProgress set `time_started_at`; InProgress→InReview accumulate `time_spent_seconds` dan clear `time_started_at`

### Diubah
- **`KanbanBoard.tsx`** — Block drag dari `InReview` → `Todo` (hanya boleh ke `InProgress`); block arrow `←` dari `InReview` jika destination adalah `Todo`
- **`KanbanBoard.tsx`** — Hantar `moduleTitle` prop ke `TaskUpdateModal`
- **`TaskUpdateModal.tsx`** — Tambah `moduleTitle` prop; header kini tunjuk `Module › Feature · Project`
- **`TaskUpdateModal.tsx`** — Tukar "Mark Complete" → **"Submit for Review"** (kuning), hanya visible pada `InProgress`
- **`TaskUpdateModal.tsx`** — Butang submit tukar label mengikut status: `Todo` → "Start & Save Note", `InProgress` → "Save Note"
- **`TaskUpdateModal.tsx`** — Form **dikunci** bila `InReview` atau `Done` — banner informatif dipaparkan, developer tidak boleh submit lagi

---

## 2026-03-29 — Kanban: Animated Timer on InProgress Cards

### Diubah
- **`KanbanBoard.tsx`** — Timer kini tunjuk **animated ping dot** (orange, `animate-ping`) pada kad bila status `InProgress`; dot hilang bila paused/done; masa teks guna `tabular-nums` untuk elak layout shift setiap saat

---

## 2026-03-29 — Kanban: Task Time Tracking + Module on Cards

### Ditambah
- **`Task` model** — Tambah `time_started_at DateTime?` dan `time_spent_seconds Int @default(0)`
- **Migration `20260329020000_task_time_tracking`** — Add kedua-dua kolum baru pada table `Task`

### Diubah
- **`PUT /api/tasks/[id]`** — Time tracking logic:
  - Task → `InProgress`: set `time_started_at = now()`
  - Task keluar `InProgress` (ke Todo/InReview/Done): kira elapsed seconds, tambah ke `time_spent_seconds`, clear `time_started_at`
  - Jika task dikembalikan ke Todo, timer **pause** (tidak terus) — akan resume semula bila balik ke InProgress
- **`GET /api/tasks/my`** — Include `module` dalam `feature` select
- **`KanbanBoard.tsx`**:
  - Kad task kini tunjuk nama **Module** (purple) di atas feature title
  - Tunjuk **masa elapsed** (⏱) pada kad — orange & live ticking jika InProgress, kelabu jika paused
  - `setInterval` 1s untuk refresh timer cards yang sedang InProgress
  - `handleDragEnd` & `moveTask` kemas kini board state daripada API response (bukan optimistic sahaja) — supaya `time_started_at` tepat
  - **Module kini wajib** (`*`) jika project ada modules; validation sebelum submit
  - `visibleFeatures` hanya tunjuk features dalam module yang dipilih

---

## 2026-03-29 — Upload: Support Mounted Share / Absolute Path

### Ditambah
- **`GET /api/files/[...path]`** — Endpoint serve files dari `UPLOAD_PATH` (absolute atau relative); require session; path traversal dilindungi; cache `immutable 1yr`; MIME type dari extension
- **`UPLOAD_PUBLIC_URL`** env var — URL prefix untuk stored attachment URLs

### Diubah
- **`POST /api/upload`** — Fix absolute path support: guna `path.isAbsolute(UPLOAD_PATH)` untuk resolve filesystem path dengan betul; bina URL dari `UPLOAD_PUBLIC_URL` (bukan hardcode strip `public/`)

### .env dev
```
UPLOAD_PATH="public/uploads"
UPLOAD_PUBLIC_URL="/uploads"
```

### .env production (mounted share)
```
UPLOAD_PATH="/uploads"
UPLOAD_PUBLIC_URL="/api/files"
```

---

## 2026-03-29 — Kanban: File Upload + Inline Feature Creation for Members

### Diubah
- **`POST /api/features`** — Buka akses untuk member; member boleh create feature dalam project yang mereka di-assign sahaja (semakan `ProjectAssignee`)
- **`POST /api/upload`** — Guna `UPLOAD_PATH` dari `.env`; tambah doc types (PDF, DOCX, XLSX, DOC, XLS), max 50MB
- **`.env`** — Tambah `UPLOAD_PATH="public/uploads"`
- **`KanbanBoard.tsx` (`AddTaskModal`)** — Tambah inline feature creation form (title, start, end, mandays); media upload (imej/video) dengan `URL.createObjectURL` preview; document upload (PDF/DOCX/XLSX) dengan icon preview; remove file dengan revoke object URL; upload dilakukan selepas task dicipta

---

## 2026-03-29 — Kanban: Always Show 4 Columns + Add Task Modal

### Diubah
- **`KanbanBoard.tsx`** — 4 kolum (Todo/In Progress/In Review/Done) kini sentiasa dipaparkan walaupun tiada task; butang `+` dalam header kolum Todo dan empty state dashed border untuk tambah task
- **`AddTaskModal`** (dalam KanbanBoard) — Form popup: pilih Project → Module (optional) → Feature → Task Title + Description; task dicipta terus assigned kepada developer semasa
- **`POST /api/tasks`** — Buka akses untuk member (sebelum ini manager sahaja); member akan auto-assign task kepada diri sendiri

---

## 2026-03-29 — Module Layer & Developer Task Self-Assignment

### Ditambah
- **`Module` model (Prisma)** — Lapisan baru antara Project dan Feature: `Module` → `Feature` → `Task`
- **Migration `20260329010000_add_modules`** — Create `Module` table, add `module_id` (nullable) pada `Feature`
- **`GET/POST /api/modules?project_id=X`** — List modules (with nested features+tasks) & create module
- **`PUT/DELETE /api/modules/[id]`** — Edit & delete module; delete akan unlink features (set `module_id = null`)
- **`POST /api/tasks/[id]/self-assign`** — Developer assign diri sendiri pada task dalam project mereka
- **`GET /api/tasks/browse?project_id=X`** — Return tasks grouped by module/feature untuk developer browse
- **`GET /api/features`** — Include `module_id` dan `module` info dalam response

### Diubah
- **`POST /api/features`** — Terima `module_id` optional
- **`FeaturesSection.tsx`** — Rewrite: tunjuk hierarki Module → Feature → Task; manager boleh add/edit/delete modules dan features; module boleh expand/collapse
- **`AddFeatureModal.tsx`** — Terima prop `moduleId` optional
- **`KanbanBoard.tsx`** — Tambah panel "Browse & Add Tasks": developer pilih project → browse module/feature/task tree → click "+ Add to Board" untuk self-assign

---

## 2026-03-29 — Project Assignees: Replace Single Owner with Multiple Assignees

### Diubah (Breaking Schema Change)
- **`prisma/schema.prisma`** — Buang `owner_id` dari `Project`; tambah model `ProjectAssignee` (join table many-to-many antara `Project` dan `User`)
- **Migration `20260329000000_replace_owner_with_assignees`** — Drop `owner_id`, create `ProjectAssignee` table
- **`POST /api/projects`** — Terima `assignee_ids: number[]`, create `ProjectAssignee` records
- **`PUT /api/projects/[id]`** — Terima `assignee_ids`, replace assignees sepenuhnya
- **`GET /api/projects`** & **`dashboard/page.tsx`** — Filter project untuk member berdasarkan `assignees` (bukan `owner_id`)
- **`GET /api/projects/[id]`** — Include `assignees` dengan user details
- **`POST /api/export`** — Guna `assignees` untuk field owner dalam PPTX export
- **`projects/new/page.tsx`** — Gantikan dropdown owner dengan senarai checkbox (multiple selection)
- **`DashboardClient.tsx`** — Update interface, edit modal guna checkboxes, display tunjuk semua assignees
- **`projects/[id]/page.tsx`** — Tunjuk semua assignees dalam project detail
- **`prisma/seed.ts`** — Update untuk guna `assignees` instead of `owner_id`

---

## 2026-03-29 — Dashboard: % Label Inside Circle Progress

### Diubah
- **`DashboardClient.tsx` (`CircleProgress`)** — Pindahkan label `%` dari bawah bulatan ke dalam bulatan menggunakan `position: absolute` overlay

---

## 2026-03-29 — Developer Analytics: 4-Week Trend Charts

### Diubah
- **`GET /api/analytics/developers`** — Tukar metric mingguan (7 hari) kepada trend 4 minggu; kini mengembalikan `weeklyTasksTrend` dan `weeklyTimeTrend` (array 4 titik: W1–W4) sebagai ganti `weeklyTasksAssigned` & `weeklyTimeSpentHours`
- **`DeveloperAnalytics.tsx`** — Gantikan static bar indicator dengan:
  - **Line chart** (recharts) untuk "Tasks Assigned Trend" — satu line per developer, 4 minggu
  - **Bar chart** (recharts) untuk "Time Spent Trend (hrs)" — grouped bars per developer, 4 minggu
- Install **`recharts`** sebagai chart library

---

## 2026-03-22 — Kanban Task Update Form, Assignee Fix & Sidebar Active State

### Ditambah
- **`TaskUpdate` model (Prisma)** — Model baharu untuk simpan rekod kemaskini tugas: `notes`, `media_urls` (array), `user_id`, `created_at`
- **`POST /api/upload`** — Endpoint upload fail (imej & video, max 50MB); disimpan dalam `public/uploads/tasks/[id]/`
- **`GET/POST /api/tasks/[id]/updates`** — Endpoint untuk ambil & hantar kemaskini tugas
  - `POST` auto-tukar status: `Todo` → `InProgress` apabila pertama kali dikemaskini
  - `mark_complete: true` → tukar status ke `InReview` (menunggu semakan manager)
- **`TaskUpdateModal` component** — Modal progress update dalam Kanban Board
  - Textarea nota kemajuan
  - Lampiran imej/video dengan preview sebelum hantar
  - Butang **Submit Update** dan **Mark Complete**
  - Sejarah kemaskini dengan avatar, timestamp & media
- **Butang "Update"** pada setiap kad Kanban — Buka `TaskUpdateModal`

### Diubah
- **`KanbanBoard.tsx`** — Integrasi `TaskUpdateModal`; `handleStatusChange` untuk kemas kini state kad tanpa reload
- **`FeaturesSection.tsx`** — Senarai ahli yang boleh di-assign kini memuatkan **semua** ahli (bukan terhad kepada unit projek sahaja), melalui `GET /api/users` tanpa `unit_id`
- **`Sidebar.tsx`** — Tambah `activePrefixes` pada nav item supaya menu kekal aktif (highlighted) ketika berada di halaman detail projek (`/projects/[id]`)

### Diperbaiki (Build)
- **`/api/activate/[token]`** — Tukar params kepada `Promise<{ token: string }>` (Next.js 15+ async params)
- **`/api/admin/users/[id]` POST** — Tukar params kepada `Promise<{ id: string }>`
- **`/api/features/[id]` DELETE** — Tukar params kepada `Promise<{ id: string }>`
- **`src/lib/pptx.ts`** — Tukar `fill: 'hex'` kepada `fill: { color: 'hex' }` mengikut spec `ShapeFillProps` pptxgenjs

---

## 2026-03-21 — Manager Delete Project

**Commit:** `50f6e30`
**Branch:** `claude/add-manager-delete-project-ZQACW`

### Ditambah
- **DELETE `/api/projects/[id]`** — Endpoint baharu untuk padam projek; hanya boleh diakses oleh `manager`
  - Cascade delete dalam satu Prisma transaction: `Task` → `FeatureDeveloper` → `Feature` → `ProjectUpdate` → `Issue` → `Project`
  - Audit log `DELETE` dicatat selepas projek berjaya dipadam
- **Butang "Delete" dalam Dashboard** (`DashboardClient.tsx`) — Visible hanya kepada manager
  - Confirmation dialog sebelum padam (`window.confirm`)
  - State `deletingId` untuk disable butang semasa proses delete berlangsung
  - UI dikemas kini secara optimistic (project dibuang daripada senarai tanpa reload)

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
