# Development Log — IT Progress Tracker

Rekod semua perubahan, penambahan feature, dan pembaikan yang dilakukan pada codebase.
Format: **terbaru di atas**.

---

## [Unreleased]

> Perubahan yang sedang dalam pembangunan, belum di-commit/deploy.

---

## 2026-04-05 — Module Template System (Parts 1–5) + Production Seed Guide

### Skema DB (Prisma)
- Tambah enum `DeliverableType`: `database | backend | frontend | testing | documentation`
- Tambah model `ModuleTemplate` (code, display_name, description, icon, sort_order, is_active)
- Tambah model `TemplateDeliverable` (FK → ModuleTemplate, cascade delete)
- Tambah model `TemplateTask` (FK → TemplateDeliverable, cascade delete, est_mandays Decimal(4,1))
- Jalankan migration: `20260405145155_add_module_templates`

### Seed Data
- Tambah `prisma/seed-templates.ts` — seed 4 standard templates:
  - `simple_crud` — 5 deliverables, 17 tasks
  - `workflow_approval` — 6 deliverables, 27 tasks
  - `reporting_heavy` — 5 deliverables, 18 tasks
  - `master_data` — 5 deliverables, 17 tasks

### API Routes
- `GET /api/module-templates` — senarai semua template aktif (dengan deliverables & tasks)
- `GET /api/module-templates/[id]/preview` — preview struktur template tanpa create apa-apa
- `POST /api/modules/from-template` — create module + deliverables + tasks dari template terpilih (sokong customizations: toggle include, rename, est_mandays override, assignee per task, custom tasks)
- `POST /api/modules/[id]/save-as-template` — simpan module sedia ada sebagai custom template baru

### UI
- Tambah `src/components/ModuleTemplateModal.tsx` — modal 2 langkah:
  - **Step 1**: Grid 2×2 template cards (icon, nama, description, bilangan deliverable/task) + pilihan "Start empty"
  - **Step 2**: Panel kiri (nama module, assignee, tarikh) + panel kanan (senarai deliverable boleh toggle/rename/remove, task boleh toggle/rename/remove/ubah est_mandays/tetapkan assignee, tambah custom task/deliverable)
- Update `DeliverableSection.tsx`:
  - Butang "+ Module" kini buka template picker modal (bukan terus modal kosong)
  - Modal edit module kekal untuk edit sahaja
  - Tambah butang 🔖 "Save as template" pada header setiap module
  - Save-as-template modal: masukkan nama template → POST ke `/api/modules/[id]/save-as-template`

---

### Deploy ke Production
- Jalankan migration dahulu: `npx prisma migrate deploy`
- Kemudian seed template: `npx tsx prisma/seed-templates.ts`
- Seed template adalah **idempotent** — selamat dijalankan semula (delete + reinsert)
- Seed utama (`prisma/seed.ts`) **jangan** dijalankan di production (mengandungi test users)
- Boleh tambah script dalam `package.json`: `"db:seed:templates": "tsx prisma/seed-templates.ts"`

---

## 2026-04-04 — Profil pengguna, upload avatar, latar belakang halaman login, pembaikan seed DB

### Skop

Penambahan profil pengguna peribadi (boleh diakses semua pengguna), upload gambar avatar, upload latar belakang halaman login dalam tetapan branding, serta pembaikan seed DB untuk Prisma 7.

### Ditambah (DB & Migrasi)

- **`prisma/schema.prisma`** — Field baharu pada model `User`:
   - `initials String?` — inisial (sehingga 3 aksara) untuk avatar teks
   - `contact_number String?` — nombor telefon/kenalan
   - `avatar_url String?` — URL gambar avatar yang diupload
- **`prisma/migrations/20260404032230_add_user_profile_fields`** — Migrasi `initials` dan `contact_number` berjaya diaplikasi
- **`prisma/migrations/20260404033221_add_user_avatar_url`** — Migrasi `avatar_url` berjaya diaplikasi

### Ditambah (API)

- **`src/app/api/profile/route.ts`** (endpoint baharu) — Profil pengguna yang sedang log masuk:
   - `GET`: kembalikan `id, name, email, role, initials, contact_number, avatar_url`
   - `PATCH`: kemaskini `name`, `initials`, `contact_number`; tukar kata laluan (mengesahkan kata laluan semasa dahulu, min 8 aksara); tulis entri `AuditLog`
- **`src/app/api/upload/avatar/route.ts`** (endpoint baharu) — Upload gambar avatar pengguna:
   - Hanya JPEG/PNG/GIF/WebP, max 2MB
   - Disimpan ke `public/uploads/avatars/avatar-{userId}-{timestamp}.{ext}`
   - Kemaskini `avatar_url` dalam rekod `User` secara automatik
- **`src/app/api/upload/brand-bg/route.ts`** (endpoint baharu) — Upload gambar latar belakang halaman login (manager sahaja):
   - Hanya JPEG/PNG/GIF/WebP, max 5MB
   - Disimpan ke `public/uploads/brand/login-bg-{timestamp}.{ext}`

### Dikemaskini (API)

- **`src/app/api/settings/route.ts`** — Menambah `login_bg_url` dalam response `GET` dan senarai kunci dibenarkan dalam `POST`
- **`src/app/api/settings/branding/route.ts`** (endpoint awam) — Kini mengembalikan `login_bg_url` bersama `brand_name` dan `brand_logo_url`

### Ditambah (Halaman & Komponen)

- **`src/app/profile/page.tsx`** (halaman baharu, boleh diakses semua pengguna):
   - Kandungan dipusatkan (`max-w-md`, `flex-col items-center`)
   - Kad avatar: klik gambar bulat untuk upload foto; overlay "Change" muncul semasa hover; fail dihantar ke `/api/upload/avatar`; avatar dipapar semula serta-merta
   - Form maklumat peribadi: Nama Penuh, Inisial, Nombor Kenalan
   - Form tukar kata laluan: Kata laluan Semasa, Baharu, Pengesahan; butang toggle Show/Hide

### Dikemaskini (Komponen & Halaman)

- **`src/components/Sidebar.tsx`** — Perubahan pada blok pengguna di bawah:
   - Menu navigasi "My Profile" **dibuang** dari senarai nav
   - Blok nama/emel pengguna kini boleh diklik (di-wrap dalam `<Link href="/profile">`) — warna nama bertukar biru semasa hover
   - Avatar bulat papar gambar dari DB jika `avatar_url` ada, jika tidak papar inisial, jika tidak papar huruf pertama nama
- **`src/app/settings/page.tsx`** (tab Branding) — Tambah bahagian "Login Page Background":
   - Drop zone serupa dengan upload logo
   - Preview latar belakang ditampakkan dalam drop zone dengan opacity rendah
   - Butang "Remove background" untuk mengosongkan semula
- **`src/app/login/page.tsx`** — Jika `login_bg_url` ada dalam tetapan, ia dipapar sebagai latar belakang penuh (`background-image`, `background-size: cover`) pada halaman log masuk

### Diperbaiki

- **`prisma/seed.ts`** — Adapter `PrismaPg` ditambah pada konstruksi `PrismaClient` supaya serasi dengan Prisma 7 (sebelum ini ralat `Module '"@prisma/client"' has no exported member 'PrismaClient'` berlaku pada server produksi sebelum `npx prisma generate` dijalankan)

---

## 2026-04-04 — Issues: Sistem penuh dengan workflow status, sejarah, dan indikator merentas paparan

### Skop

Pembangunan semula menyeluruh sistem isu — dari model DB, API workflow status, form baharu, hingga indikator visual pada semua paparan (Kanban, Gantt, Deliverable, task list) dan ringkasan dalam PPTX report.

### Ditambah (DB & Migrasi)

- **`prisma/schema.prisma`** — Enum baharu:
   - `IssueSeverity`: `minor | moderate | major | critical`
   - `IssueType`: `bug | enhancement | clarification`
   - `IssueStatus`: `open | in_progress | resolved | closed`
- **`prisma/schema.prisma`** — Field baharu pada model `Issue`: `resolved_by_id Int?`, `issue_type IssueType`, `issue_severity IssueSeverity`, `issue_status IssueStatus`, `due_date DateTime?`, `resolution_note String?`, `resolved_at DateTime?`, relasi `resolved_by`, `history IssueHistory[]`
- **`prisma/schema.prisma`** — Model baharu `IssueHistory`: rekod setiap perubahan isu (`issue_id`, `changed_by`, `action`, `from_value?`, `to_value?`, `note?`, `created_at`)
- **`prisma/schema.prisma`** — Back-relations `resolved_issues` dan `issue_history` ditambah ke model `User`
- **`prisma/migrations/20260403175856_extend_issues_add_history`** — Migrasi berjaya diaplikasi

### Ditambah (API)

- **`src/app/api/issues/[id]/history/route.ts`** (endpoint baharu) — `GET` mengembalikan `IssueHistory` bagi satu isu, disertakan dengan `user { id, name }`, diisih kronologi menaik

### Dikemaskini (API)

- **`src/app/api/issues/route.ts`** — Ditulis semula:
   - `GET`: sokong penapis `issue_type`, `issue_severity`, `issue_status`, `assignee_id`, `deliverable_id` (selain legacy `severity`/`resolved`)
   - `POST`: auto-isi `project_id` dan `deliverable_id` dari konteks task; auto-kira `due_date` mengikut keterukan (critical=+1h, major=+3h, moderate=+7h, minor=+14h); tulis entri `IssueHistory` pada cipta
- **`src/app/api/issues/[id]/route.ts`** — Ditulis semula sepenuhnya:
   - `GET`: paparkan isu tunggal dengan semua relasi
   - `PUT` dengan workflow status:
      - `open → in_progress` (semua pengguna)
      - `in_progress → resolved` (semua pengguna; wajib `resolution_note` ≥10 aksara; set `resolved_at`, `resolved_by_id`)
      - `resolved → closed` (manager sahaja)
      - `resolved → open` (reopen; manager sahaja; reset `resolved_at`, `resolved_by_id`, `resolved=false`)
   - Setiap perubahan (status, assignee, tarikh) menulis entri `IssueHistory`
- **`src/app/api/issues/my/route.ts`** — Penapis ditukar dari `resolved: false` → `issue_status: { notIn: ['resolved','closed'] }`; include `deliverable` dan `task`; diisih mengikut `issue_severity` kemudian `created_at`
- **`src/app/api/projects/[id]/issues/route.ts`** — Sokong penapis `issue_type`, `issue_severity`, `issue_status`, `assignee_id`, `deliverable_id`; include `resolved_by`; diisih mengikut keterukan kemudian tarikh
- **`src/app/api/projects/[id]/deliverables/route.ts`** — Include `_count.issues` (isu terbuka sahaja) pada deliverable dan setiap task
- **`src/app/api/tasks/route.ts`** — Include `_count.issues` (isu terbuka sahaja) pada setiap task
- **`src/app/api/tasks/my/route.ts`** — Include `_count.issues` (isu terbuka sahaja) pada setiap task
- **`src/app/api/counts/route.ts`** — Penapis ditukar dari `resolved: false` → `issue_status: { notIn: ['resolved','closed'] }`
- **`src/app/api/export/route.ts`** — Penapis ditukar dari `resolved: false` → `issue_status: { notIn: ['resolved','closed'] }`; `issueData` kini hantar `issue_severity`, `issue_status`, `issue_type`, `due_date`

### Ditambah (Komponen)

- **`src/components/IssueFormModal.tsx`** (komponen baharu) — Form lengkap laporkan isu:
   - Pemilih jenis isu: 🐛 Bug / ✨ Enhancement / ❓ Clarification
   - Dropdown projek (pre-isi dari konteks), deliverable (opsional), task (opsional)
   - Auto-isi `due_date` mengikut keterukan (boleh ditukar manual)
   - Pemilih keterukan: minor / moderate / major / critical
   - Pemilih assignee (manager sahaja; dimuatkan dari `/api/users`)
   - Close on backdrop click

### Dikemaskini (Komponen)

- **`src/components/ProjectIssueSection.tsx`** — Ditulis semula sepenuhnya:
   - Bar penapis: Status, Severity, Type
   - Butang workflow per-isu bergantung pada peranan: Start / Resolve / Close / Reopen
   - Modal pengesahan transisi (nota resolusi wajib ≥10 aksara untuk `resolved`; sebab reopen untuk `open`)
   - Panel sejarah boleh toggle dengan timeline entri `IssueHistory`
   - Butang `+ Issue` buka `IssueFormModal` dengan `project_id` pre-isi
   - Badge OVERDUE merah jika isu melebihi `due_date`
   - Nota resolusi dipapar dalam kotak hijau selepas isu diselesaikan
- **`src/app/issues/page.tsx`** — Dikemaskini untuk enum baru:
   - Penapis status: Open / In Progress / Resolved / Closed
   - Penapis keterukan: critical / major / moderate / minor (gantikan high/medium/low)
   - Penapis jenis isu (baharu)
   - Lajur Severity / Type gabungan dengan badge jenis
   - Lajur Status papar `STATUS_LABEL` berwarna
   - Butang `Start` / `Resolve` menggantikan butang toggle lama
- **`src/components/FeatureTaskList.tsx`** — Interface `Task` tambah `_count?: { issues: number }`; badge amber `⚠ N` dipapar pada baris task yang ada isu terbuka
- **`src/components/DeliverableSection.tsx`** — Interface `Task` dan `Deliverable` tambah `_count?: { issues: number }` dan field `order`; `DeliverableCard` mengira jumlah isu terbuka (deliverable + semua tasks); badge amber `⚠ N issue(s)` dipapar pada header kad deliverable
- **`src/components/KanbanBoard.tsx`** — Interface `Task` tambah `_count?: { issues: number }`; badge amber `⚠ N` dipapar pada kad Kanban yang ada isu terbuka
- **`src/components/GanttChart.tsx`** — Interface `GanttDeliverable` tambah `_count?: { issues: number }`; ikon `⚠` dipapar bersebelahan tajuk deliverable jika ada isu terbuka
- **`src/app/projects/[id]/page.tsx`** — Query Prisma `deliverable.findMany` kini include `_count.issues`; `ganttDeliverables` hantar `_count` ke `GanttChart`

### Dikemaskini (PPTX)

- **`src/lib/pptx.ts`** — Interface `IssueData` kini ada `issue_severity?`, `issue_status?`, `issue_type?`, `due_date?`
- **`src/lib/pptx.ts`** — `severityColor()` dikemaskini untuk `critical/major/moderate/minor` (dengan sokongan backward-compat `high/medium/low`)
- **`src/lib/pptx.ts`** — Slaid isu per-projek dalam `generateReportPPTX()`:
   - Tambah baris ringkasan: `Critical: N · Major: N · Moderate: N · Minor: N · X overdue`
   - Isu diisih mengikut keterukan sebelum dipapar dalam jadual
   - Jadual kini ada lajur ketiga **Due** (tarikh akhir)
   - Warna keterukan mengikut enum baharu

---

## 2026-04-03 — Hotfixes: migrate deploy & DeliverableSection parse error

### Diperbaiki

- **`prisma/_prisma_migrations`** — Migrasi `20260330140000_add_finding_responses` ditanda sebagai gagal (P3009) kerana lajur sudah wujud dalam DB hasil `db push` sebelumnya. Diselesaikan dengan `prisma migrate resolve --applied 20260330140000_add_finding_responses`; `prisma migrate deploy` kini berjalan tanpa ralat.

- **`src/components/DeliverableSection.tsx`** — Ralat parsing ECMAScript: baris 7 mengandungi literal `\n` (aksara backslash-n) sebagai ganti baris baharu sebenar. Formatter menukarkan interface `Task` dan pemalar `TASK_PROGRESS_WEIGHT` kepada satu baris dengan `\n` terbenam, menyebabkan Next.js gagal parse. Dipulihkan kepada format berbilang baris yang betul.

---

## 2026-04-03 — Task status enhancements: popup confirmations, actual dates, weighted progress, health status

### Skop

8 peningkatan berkaitan kitaran hayat tugas — dari interaksi UI seperti popup pengesahan status hingga pengiraan otomatik tarikh sebenar projek dan status kesihatan.

### Ditambah

- **`prisma/schema.prisma`** — Perubahan skema:
   - `TaskStatus` enum: tambah nilai `Blocked`
   - `HealthStatus` enum baharu: `on_track | at_risk | delayed | overdue`
   - `Task` model: tambah `status_updated_at DateTime?`, `status_updated_by Int?` (FK→User), relasi `status_updater`
   - `Project` model: tambah `actual_start DateTime?`, `actual_end DateTime?`, `health_status HealthStatus?`
   - `Deliverable` model: tambah `is_actual_override Boolean @default(false)`
   - `TaskHistory` model: tambah `actual_date DateTime?`, `is_auto_log Boolean @default(true)`, `from_status` dijadikan nullable
   - `User` model: tambah back-relation `status_updated_tasks`
   - Dijalankan `prisma db push` — migrasi berjaya

- **`src/components/StatusChangeModal.tsx`** (komponen baharu) — Modal popup pengesahan sebelum perubahan status task:
   - Mengendalikan transisi: `InProgress`, `InReview`, `Done`, `Blocked`, `Unblock`
   - `InProgress`: date picker (maks=hari ini, min=tarikh_akhir−90 hari) untuk actual_start
   - `InReview` / `Done`: date picker untuk actual_end
   - `Blocked`: textarea wajib (maks 500 aksara) untuk sebab
   - `Unblock`: pengesahan ringkas — kembalikan ke InProgress
   - Callback: `onConfirm(taskId, newStatus, { actual_date?, blocked_reason? })`

### Diubah

- **`src/app/api/tasks/[id]/route.ts`**:
   - Tambah `PROGRESS_WEIGHT` — `{ Todo:0, InProgress:50, InReview:80, Done:100, Blocked:0 }`
   - `recalculateDeliverableDates` dipinda — kini menghormati `is_actual_override` (tidak timpa jika PM override aktif)
   - Tambah `recalculateProjectDates` — kiraan tarikh sebenar projek dari deliverable
   - Tambah `computeHealthStatus` — berasaskan halaju (tasks siap/hari berlalu → unjuran siap)
   - PUT handler:
      - Status `Blocked` → set `is_blocked=true` secara automatik
      - Unblock (Blocked→InProgress) → reset `is_blocked=false`, `blocked_reason=null`
      - Terima `actual_date` dari popup — simpan ke `actual_start`/`actual_end` mengikut transisi
      - Set `status_updated_at` dan `status_updated_by` setiap perubahan status
      - `TaskHistory` kini menyimpan `actual_date` dan `is_auto_log: true`
      - `health_status` projek dikira semula selepas setiap perubahan task

- **`src/components/FeatureTaskList.tsx`**:
   - Tambah `Blocked` ke `STATUS_OPTIONS` dan `STATUS_COLORS`
   - `dueDateBadge()` kini tunjuk lencana kuning "Due soon" untuk ≤3 hari (dahulu hanya "Due today")
   - Dropdown status kini ditunjuk kepada member (task sendiri, tidak termasuk Done)
   - Perubahan status melalui `pendingStatus` state → buka `StatusChangeModal` dahulu
   - Blok/Unblok dihalakan melalui modal (textarea inline dibuang)
   - Header jadual papar `"1/3 tasks · 50%"` dengan peratusan berwajaran

- **`src/components/KanbanBoard.tsx`**:
   - Import `StatusChangeModal`; tambah state `pendingStatus`
   - `handleDragEnd` dan `moveTask` — buka popup sebelum simpan untuk status tertentu
   - Tambah helper `doStatusUpdate` dan `handlePopupConfirm`
   - Hanya pengurus boleh seret ke lajur Done

- **`src/components/TeamKanbanBoard.tsx`**:
   - Sama seperti `KanbanBoard.tsx` — popup integration sepenuhnya
   - Betulkan `handleStatusChange` untuk jaga kunci lajur tidak wujud

- **`src/components/DeliverableSection.tsx`**:
   - Interface Deliverable: tambah `is_actual_override?`
   - `taskProgress()` guna `TASK_PROGRESS_WEIGHT` (berwajaran)
   - Tarikh sebenar dipapar dengan ikon `📌` jika `is_actual_override=true`
   - Butang Tasks papar `"Tasks (N) · X%"`
   - Modal edit: bahagian PM Override — input actual start/end + butang "Reset to auto"

- **`src/app/api/deliverables/[id]/route.ts`**:
   - PUT handler menerima dan menyimpan `actual_start`, `actual_end`, `is_actual_override`

- **`src/app/projects/page.tsx`**:
   - Tambah `health_status?` ke type `Project`
   - Kad projek papar lencana kesihatan `🟢 On Track / 🟡 At Risk / 🔴 Delayed / ⚫ Overdue` (disembunyikan untuk projek selesai)

- **`src/components/ProjectDetailCard.tsx`**:
   - Tambah `health_status?` ke props
   - Lencana kesihatan dipapar di sebelah lencana status dalam header projek

- **`src/app/projects/[id]/page.tsx`**:
   - Hantar `health_status` ke `ProjectDetailCard`

---

### Ditambah

- **`prisma/schema.prisma`** — Field baharu pada model `Task`:
   - `due_date DATE` — tarikh akhir task; auto-diwarisi dari `deliverable.planned_end` semasa create, boleh ditimpa
   - `est_mandays DECIMAL(4,1)` — anggaran usaha per task (nullable, step 0.5)
   - `priority TaskPriority` — enum `low / medium / high / critical`, default `medium`
   - `is_blocked BOOLEAN` — flag halangan, default `false`
   - `blocked_reason VARCHAR(500)` — sebab halangan, null jika tidak diblock
   - `started_at TIMESTAMP` — ditetapkan sekali sahaja apabila status bertukar ke `InProgress` buat pertama kali
   - `submitted_at TIMESTAMP` — ditetapkan sekali sahaja apabila status bertukar ke `InReview` buat pertama kali
   - `completed_at TIMESTAMP` — ditetapkan sekali sahaja apabila status bertukar ke `Done` buat pertama kali
- **`prisma/schema.prisma`** — Model baharu `TaskHistory`: merekod setiap perubahan status task (`task_id`, `changed_by`, `from_status`, `to_status`, `note`, `created_at`)
- **`prisma/schema.prisma`** — Enum baharu `TaskPriority`

### Dikemaskini

- **`src/app/api/tasks/route.ts`** (POST) — Terima field baharu `due_date`, `est_mandays`, `priority`; auto-inherit `due_date` dari `deliverable.planned_end` jika tidak diisi
- **`src/app/api/tasks/[id]/route.ts`** (PUT) — Sokong kemaskini `due_date`, `est_mandays`, `priority`, `is_blocked`, `blocked_reason` (manager); `is_blocked`/`blocked_reason` boleh dikemaskini oleh member yang ditugaskan; auto-log perubahan status ke `TaskHistory`; set `started_at / submitted_at / completed_at` sekali sahaja pada transisi status yang berkaitan
- **`src/app/api/analytics/developers/route.ts`** — Kolum **Est. Mandays** kini menggunakan jumlah `task.est_mandays` per assignee; fallback ke `feature.mandays` jika tiada data task-level
- **`src/components/FeatureTaskList.tsx`** — Ditulis semula sepenuhnya:
   - Kolum baharu **Est. md** dalam jadual task
   - Badge priority berwarna pada setiap baris task (gray=low, blue=medium, amber=high, red=critical)
   - Paparan `due_date` di bawah nama task — badge merah "Overdue" / amber "Due today" / teks kelabu untuk tarikh akan datang
   - Butang 🚫 Block/Unblock dengan input sebab halangan inline; baris task diblock ada border kiri merah
   - Banner amaran mandays: "⚠ Tasks total (X md) exceeds deliverable estimate (Y md)" jika jumlah task melebihi `deliverable.mandays`
   - Form "+ Add Custom Task" diperluas: tambah due date (pre-filled dari `deliverable.planned_end`), priority, est. mandays; amaran jika due date melebihi tarikh deliverable
- **`src/components/DeliverableSection.tsx`** — Hantarkan `deliverableMandays` dan `deliverablePlannedEnd` ke `FeatureTaskList`; interface `Task` dikemaskini untuk include `est_mandays`
- **`src/components/TeamKanbanBoard.tsx`** — AddTaskModal ditulis semula:
   - Field baharu: Module (conditional — hanya papar jika projek ada modul, dengan amaran "best practice"), Deliverable (gantikan Feature), due date, priority, est. mandays
   - Auto-fill due date dari `deliverable.planned_end` apabila deliverable dipilih; amaran jika melampaui
   - Filter prioriti dalam filter bar ("All Priorities / Critical / High / Medium / Low")
   - Kad Kanban: badge priority (sudut atas kanan), badge "🚫 Blocked" + sebab, due date di bahagian bawah kad (merah/amber/kelabu)
   - Border kiri merah pada kad yang diblock
- **`src/components/KanbanBoard.tsx`** — AddTaskModal ditulis semula (sama seperti TeamKanbanBoard — feature digantikan dengan deliverable, tambah due date, priority, est. mandays); kad Kanban dikemaskini dengan badge priority, blocked badge/border, due date

### Pembetulan

- **`.env`** — Betulkan typo `postgress` → `postgres` dalam `DATABASE_URL`
- **`src/lib/prisma.ts`** — Jalankan `npx prisma generate` selepas schema changes untuk menjana semula Prisma Client (`.prisma/client/default` hilang menyebabkan dev server gagal start)

---

## 2026-04-01 — Report PPTX: Light theme, donut charts, developer analytics & workload table

### Diubah

- **`src/lib/pptx.ts`** — `ReportSections` interface dikurangkan kepada `{ gantt, burndown, issues }` — `teamPerformance` dan `workloadBalance` dibuang (kedua-dua kini dirender secara automatik jika data ahli wujud)
- **`src/lib/pptx.ts`** — `ReportProjectInput` diperluas: tasks kini ada `time_spent_seconds`, `assigned_to`, dan `assignee { id, name }` untuk kegunaan analitik
- **`src/lib/pptx.ts`** — `generateReportPPTX()` ditulis semula sepenuhnya dengan susunan slaid baharu dan tema cerah (light theme `FFFFFF`/`F8FAFC`):
   - **Slaid 1 – Cover**: latar `F8FAFC`, bar biru atas & bawah, tajuk "Progress Report", label tempoh, kiraan projek + tarikh eksport
   - **Slaid 2 – Projects Overview** (auto-paginate 6 projek/slaid): kad per-projek dalam grid 3 kolum, setiap kad ada **donut chart** (`addChart('doughnut')`) berwarna mengikut status, peratusan di tengah, badge status, dan kiraan tasks
   - **Slaid 3 – Developer Analytics** (auto-render jika ada data): dua bar chart sebelah-menyebelah — kiri: bilangan tasks assigned per ahli; kanan: jam yang dihabiskan (`time_spent_seconds / 3600`)
   - **Slaid 4 – Team Workload Balance** (auto-render jika ada data): jadual ahli × status (To Do / In Progress / In Review / Done / Total), warna header mengikut status
   - **Slaid per-projek**: Overview → Gantt (jika `sections.gantt`) → Burndown (jika `sections.burndown`) → Issues (jika `sections.issues`, ditapis per-projek)
- **`src/app/api/export/route.ts`** — Task fetch kini include `time_spent_seconds`, `assigned_to`, `assignee { id, name }`; `sections` parsing buang `teamPerformance`/`workloadBalance`
- **`src/app/export/page.tsx`** — Buang toggle `teamPerformance` dan `workloadBalance` dari senarai `SECTIONS` dan initial state; import `Users`, `Scale` dibuang; seksyen kini hanya: Gantt, Burndown, Issues

---

## 2026-03-31 — Notification emails & Report Builder UI

### Ditambah

- **`src/lib/email.ts`** — 6 fungsi notifikasi e-mel baharu:
   - `sendTaskStatusEmail` — ahli dimaklumkan apabila status task berubah
   - `sendTaskAssignedEmail` — ahli dimaklumkan apabila task baharu ditetapkan
   - `sendTaskDeletedEmail` — ahli dimaklumkan apabila task mereka dipadam
   - `sendIssueCreatedEmail` — manager dimaklumkan apabila isu baharu dilaporkan
   - `sendIssueResolvedEmail` — pihak berkaitan diberitahu apabila isu ditutup
   - `sendExportEmail` — fail PPTX dihantar ke semua pengguna aktif selepas report dijana
- **`src/app/export/page.tsx`** — Ditulis semula sebagai **Report Builder** UI:
   - Panel kiri: senarai projek dengan checkbox, progress bar, dan status badge; butang "Select All"/"Deselect All"
   - Panel kanan: pemilih bulan `from`/`to`, toggle 5 seksyen (Gantt, Burndown, Team Performance, Workload Balance, Issues), kad ringkasan live (projek dipilih, seksyen aktif)
   - Butang "Generate Report" dengan spinner

### Dikemaskini

- **`src/components/Sidebar.tsx`** — Label "Export" ditukar ke "Report", ikon ditukar ke `BarChart3`
- **`src/app/api/export/route.ts`** — Parameter POST baharu: `project_ids[]`, `from_month`, `to_month`, `sections{}` menggantikan parameter lama

---

## 2026-03-31 — Per-project PPTX export: light theme & Gantt chart slide

### Ditambah

- **`src/components/BurndownChart.tsx`** (komponen baru) — Burndown chart client-side menggunakan Recharts `LineChart`. Dua siri: Ideal (dashed kelabu) dan Actual (biru). Garis referens hari ini (amber). Post-loop guarantee memastikan data point hari ini sentiasa ada. Butang `?` biru dengan popover klik-luar-tutup: penerangan, cara baca, contoh, dan amalan terbaik.
- **`src/components/ProjectDetailCard.tsx`** (komponen baru) — Client wrapper untuk keseluruhan header kad projek. Burndown chart dipapar sentiasa (tanpa toggle). Butang **↓ Export PPTX** dengan spinner. Papar `Start:` dan `Deadline:` dalam metadata. Lulus `start_date` ke `ProjectActions`.
- **`src/app/api/projects/[id]/export/route.ts`** (endpoint baru) — GET handler: fetch projek + modul + deliverables (tasks: status, actual_end), panggil `generateProjectPPTX()`, kembalikan `.pptx` binary dengan `Content-Disposition: attachment`.
- **`src/lib/pptx.ts`** — Tambah `generateProjectPPTX(input)` dengan **4 slaid tema cerah**:
   - **Slaid 1 – Project Overview**: title, status pill, metadata (assignee, mula, tamat), progress bar, 5 stat cards (Modules, Deliverables, Total/Done/Remaining tasks)
   - **Slaid 2 – Gantt Chart**: visual timeline dengan planned bar (kelabu + isian biru/hijau mengikut % tasks done), actual bar (warna status), module header rows biru muda, tanda bulan, garis hari ini (amber putus-putus), legend
   - **Slaid 3 – Modules & Deliverables**: jadual grouped by module, baris berselang-seli putih/slate-50, header biru, kolum Planned/Actual/Tasks
   - **Slaid 4 – Burndown Chart**: carta garis Ideal (kelabu) + Actual (biru) dengan plot area cerah

### Dikemaskini

- **`src/components/ProjectActions.tsx`** — Tambah field `start_date` dalam antara muka, state `editForm`, dan grid edit modal (Status solo, kemudian Start Date + Deadline dalam grid 2 kolum).
- **`src/app/api/projects/[id]/route.ts`** — PUT handler kini simpan `start_date` dari body.
- **`src/app/projects/[id]/page.tsx`** — Gantikan JSX header+Gantt inline dengan `<ProjectDetailCard>`. Buang import dan pembolehubah yang tidak digunakan.
- **`src/components/GanttChart.tsx`** — Planned bar: tooltip native digantikan dengan CSS `group/planned` hover (tiada delay). Hover highlight pada semua bar (planned, actual, task). Label deliverable kini papar planned date range (`01 Jan → 31 Mar`).
- **`src/components/DeliverableSection.tsx`** — Tambah `useRef`, butang `?` biru, dan popover klik-luar-tutup dengan penerangan Module/Deliverable/Task dan jadual perbandingan.

---

## 2026-03-31 — Issues: full CRUD, scope context, attachments & live reload

### Ditambah

- **`prisma/schema.prisma`** — Model `Issue` kini ada `media_urls String[]`, `deliverable_id Int?`, dan `task_id Int?` dengan relasi ke `Deliverable` dan `Task`; back-relations `issues Issue[]` ditambah pada kedua-dua model. Dua migration dijalankan: `add_media_urls_to_issue` dan `add_deliverable_task_to_issue`.
- **`src/components/ProjectActions.tsx`** (komponen baru) — Butang **Edit** (manager) dan **+ Issue** (semua pengguna) dipindah dari dashboard ke halaman project details. Form issue ada cascading scope selectors (Module → Deliverable → Task) dan sokongan lampiran (gambar, video, PDF). Selepas submit, dispatch `CustomEvent('issue-created')` supaya seksyen issue reload tanpa perlu refresh manual.
- **`src/components/ProjectIssueSection.tsx`** (komponen baru) — Seksyen kad isu di bawah halaman project details. Papar severity dot, tajuk, deskripsi, scope context (modul › deliverable › task), assignee sebelum (task atau deliverable), thumbnail lampiran, dan toggle Resolve/Reopen. Ada filter tab: Open / Resolved / All. Listen `CustomEvent('issue-created')` untuk auto-reload.
- **`src/app/api/projects/[id]/issues/route.ts`** (endpoint baru) — GET endpoint mengembalikan isu projek dengan include penuh: user, assignee, deliverable (+ module + tasks + assignee), task (+ assignee).
- **`src/app/api/upload/route.ts`** — Sokong param `context` (selain `task_id`) untuk tentukan folder upload; isu guna `context=issues` → simpan dalam folder `issues/`.
- **`src/components/TaskUpdateModal.tsx`** — Input fail kini accept `image/*, video/*, application/pdf`; preview tambah ikon 📄 untuk PDF dalam modal developer (In Progress) dan manager (To Review).

### Dikemaskini

- **`src/app/api/issues/route.ts`** — GET kini include `deliverable` (+ module) dan `task` untuk papar scope context dalam halaman Issues global.
- **`src/app/api/issues/[id]/route.ts`** — PUT kini sokong kemaskini `title`, `description`, `severity`, `deliverable_id`, `task_id` selain `resolved` dan `assignee_id`.
- **`src/app/issues/page.tsx`** — Setiap baris isu kini papar scope chain `Module › Deliverable › Task` dalam teks kecil berwarna. Tambah butang **Edit** yang buka modal dengan cascading scope selectors dan field title/description/severity.
- **`src/app/projects/[id]/page.tsx`** — Import `ProjectActions` dan `ProjectIssueSection`; seksyen isu diletakkan di bawah Modules & Deliverables.
- **`src/app/dashboard/DashboardClient.tsx`** — Buang semua modal Edit/Issue dari dashboard; senarai projek kini hanya papar butang "View".
- **`src/components/KanbanBoard.tsx`** & **`TeamKanbanBoard.tsx`** — Legend ditukar dari inline panel ke popover (backdrop `fixed inset-0 z-40` + panel `absolute z-50`). Warna kad `reviewCardStyle` diperbetulkan: kuning hanya bila `status === 'InReview' && review_count > 0`; oren hanya bila `status !== 'InReview' && review_count > 0`.

---

## 2026-03-31 — Allow developer & manager to delete To Do tasks

**Motivasi:** Developer perlu boleh padam task To Do mereka sendiri tanpa bergantung kepada manager. Manager pula perlu boleh padam mana-mana task To Do (custom, bukan SDLC).

**Perubahan:**

- **`/api/tasks/[id]` DELETE** — Buang had `manager-only`. Kini: manager boleh padam mana-mana task non-predefined yang berstatus `Todo`; member boleh padam task non-predefined `Todo` yang `assigned_to` mereka sahaja. Task berstatus selain `Todo` tidak boleh dipadam oleh sesiapa.
- **`FeatureTaskList.tsx`** — Import `useSession` untuk dapatkan `currentUserId`. Kolum aksi kini dipaparkan untuk semua peranan. Manager kekal dengan butang edit (✎) + delete (✕) penuh. Member pula nampak butang delete (✕) merah hanya pada baris task yang `status === 'Todo'`, `assigned_to === currentUserId`, dan bukan predefined.
- **`TeamKanbanBoard.tsx`** — Tambah `handleDeleteTask` yang panggil `DELETE /api/tasks/:id` dan buang task dari board state. Butang 🗑 papar pada kad Todo untuk: manager (semua Todo cards) dan developer (Todo cards yang `assignee.id === currentUserId`). Legend dikemaskini untuk kedua-dua peranan.

---

## 2026-03-31 — Team Kanban: Manager boleh update To Do & In Progress tasks

### Ditambah

- **`/api/tasks/[id]/updates` (POST)** — Laluan baru "manager comment": jika role `manager` dan tiada `review_action` dan status adalah `Todo` atau `InProgress`, manager boleh letak nota tanpa mengubah status task (tidak ada semakan `assigned_to`)
- **`TeamKanbanBoard.tsx`** — Butang pada kad task `Todo`/`InProgress` bertukar dari "View" → **"Update"** (biru) untuk manager; kad `Done` kekal "View"
- **`TaskUpdateModal.tsx`** — `formLocked` tidak lagi mengunci form untuk manager apabila status `Todo` atau `InProgress`; label textarea bertukar ke "Manager Note" dan placeholder berubah; butang submit tunjuk "Save Note" (tanpa "Start & Save Note" atau "Submit for Review" untuk manager)
- **`TeamKanbanBoard.tsx`** — Legend Manager permissions dikemaskini: tambah `✓ Add notes to To Do & In Progress tasks` dan `✗ Cannot submit task for review`

---

## 2026-03-30 — Gantt module dual-bar & deliverable progress bar colour fix

### Diperbaiki

- **`GanttChart.tsx`** — `GanttModule` interface kini terima `start_date?` dan `end_date?`; baris module dalam Gantt kini render dua bar seperti level deliverable — **planned bar** (kelabu, dari `module.start_date`/`end_date`) di atas dan **actual bar** (berwarna berdasarkan status) di bawah; actual bar guna warna `bg-green-500` (On Time), `bg-red-500` (Late), atau `bg-blue-400` (InProgress)
- **`/projects/[id]/page.tsx`** — `ganttModules` kini hantar `start_date` dan `end_date` dari Prisma module record
- **`DeliverableSection.tsx`** — Progress bar deliverable kini bertukar warna dari biru → hijau (`bg-green-500`) apabila `pct >= 100` (semua tasks Done)

---

## 2026-03-30 — Project Detail: Auto-compute progress % & status from tasks

### Diperbaiki

- **`/projects/[id]/page.tsx`** — Progress % dalam circle kini dikira secara automatik dari `done tasks / total tasks × 100` berdasarkan semua tasks dalam semua deliverables; jika tiada deliverable/tasks, fallback ke manual `ProjectUpdate.progress_pct`
- **`/projects/[id]/page.tsx`** — Badge status header kini diturunkan dari status deliverable (bukan `project.status` manual):
   - Semua deliverables `Done` → `Done`
   - Mana-mana `InProgress` atau ada sebahagian Done → `InProgress`
   - Semua `Pending` atau tiada deliverable → ikut `project.status`

---

## 2026-03-30 — FeatureTaskList: Highlight Done tasks & resize action icons

### Dikemaskini

- **`FeatureTaskList.tsx`** — Baris task berstatus `Done` kini dipaparkan dengan latar `bg-green-50` (dark: `bg-green-900/10`) dan teks berstrikethrough hijau
- **`FeatureTaskList.tsx`** — Ikon pensil (✎) dan X (✕) dalam lajur aksi manager dibesarkan dari `text-xs` ke `text-base` untuk lebih mudah diklik

---

## 2026-03-30 — Fix: Deliverable status tidak auto-update apabila tasks selesai

### Diperbaiki

- **`/api/tasks/[id]` (PUT)** — Tambah fungsi `recalculateDeliverableDates()`; dipanggil selepas sebarang perubahan status task yang mempunyai `deliverable_id`; mengira `actual_start`, `actual_end`, dan `status` deliverable berdasarkan semua tasks di bawahnya:
   - `Done` — semua tasks Done
   - `InProgress` — mana-mana task InProgress atau InReview
   - `Pending` — semua tasks masih Todo
- **`/api/tasks/[id]/updates` (POST)** — Tambah `recalculateDeliverableDates()` yang sama; dipanggil selepas manager approve/reject dan selepas developer submit update dengan perubahan status; sebelum ini deliverable kekal `Pending` walaupun semua tasks telah siap

---

## 2026-03-30 — Gantt Chart: View Mode Toggle (Day / Week / Month)

### Ditambah

- **`GanttChart.tsx`** — `ViewMode` type (`'day' | 'week' | 'month'`); state `viewMode` dengan default `'week'`
- **`GanttChart.tsx`** — Butang toggle **Day / Week / Month** dalam legend bar (antara tajuk dan legend warna); butang aktif ditonjolkan dengan warna biru
- **`GanttChart.tsx`** — Fungsi `getViewRange()`: menentukan julat masa berdasarkan `viewMode`
   - `day` — tetingkap 3 minggu (7 hari sebelum hingga 14 hari selepas hari ini); tik harian
   - `week` — julat auto dari data (kelakuan sedia ada); tik mingguan
   - `month` — dari awal bulan `start_date` projek hingga akhir bulan `deadline`; tik bulanan
- **`GanttChart.tsx`** — `generateTicks()` terima parameter `viewMode` dan jana tik mengikut mod yang dipilih; mod `month` gunakan label `MMM YYYY`

---

## 2026-03-30 — Kanban legend panel & card colour fixes

### Ditambah

- **`KanbanBoard` & `TeamKanbanBoard`** — butang `?` toggle di filter bar; panel legend boleh lipat dengan 3 bahagian: warna kad, badges, dan kebenaran Developer/Manager
- **Card colours** — Done = hijau; reviewed (non-Todo) = oren; InReview = kuning; default = putih
- **Badge `↩ N`** — tersembunyi di lajur To Do, visible di semua lajur lain

### Diperbaiki

- **`KanbanBoard`** — `useState(showLegend)` dipindah ke atas sebelum early return `if (loading)` untuk ikut Rules of Hooks

---

## 2026-03-30 — Reviewed badge in TaskUpdateModal

### Ditambah

- **`TaskUpdateModal`** — badge `↩ N×` di header apabila `reviewCount > 0`; prop `reviewCount` dihantar dari `KanbanBoard` dan `TeamKanbanBoard`

---

## 2026-03-30 — Kanban card: review status visual indicator

### Dikemaskini

- **`KanbanBoard` & `TeamKanbanBoard`** — Helper `reviewCardStyle()` menentukan gaya kad berdasarkan status review: InReview = border kiri kuning + latar kuning pudar; `review_count > 0` (ditolak balik) = border kiri oren + latar oren pudar; normal = putih/navy; badge `↩ N` ditambah ke TeamKanbanBoard juga

---

## 2026-03-30 — Kanban card: reviewed indicator badge

### Ditambah

- **`Task` model** — kolum `review_count Int @default(0)`; migration `20260330130000_add_task_review_count`
- **`/api/tasks/[id]/updates`** — increment `review_count` pada setiap `review_action` (approve & reject)
- **`KanbanBoard`** — badge merah `↩ N` di penjuru kanan tajuk kad apabila `review_count > 0`; tooltip menunjukkan bilangan kali di-review

---

## 2026-03-30 — Manager Review: Issue Checkboxes & Attachment

### Ditambah

- **`TaskUpdateModal`** — Panel Manager Review kini ada checkboxes 8 isu predefined (Bug/Logic Error, UI/UX, Missing Functionality, dll.) di bawah textarea; isu yang ditanda disusun sebagai senarai "Findings:" dalam nota review; sokongan upload attachment bukti review (`📎 Attach evidence`); fail diupload sebelum hantar dan dilampirkan pada entri update history

---

## 2026-03-30 — Fix KanbanBoard crash for deliverable tasks

### Diperbaiki

- **`/api/tasks/my`** — Include `deliverable` (with project) in query; normalize response to lift `project` and `module` to top level so both feature-tasks and deliverable-tasks share the same shape
- **`KanbanBoard.tsx`** — Update `Task` interface: `feature` and `deliverable` now nullable, `project` and `module` at top level; fix `projectOptions`, `featureOptions`, `visibleTasks`, and card rendering to guard against null feature

---

## 2026-03-30 — Task Inline Edit for Manager

### Ditambah

- **`FeatureTaskList`** — Manager kini boleh edit tajuk task terus dalam jadual: klik ikon pensil (✎) sebelum ✕ untuk masuk mod edit inline; tekan Enter atau ✓ untuk simpan, Escape atau ✕ untuk batal; panggil `PUT /api/tasks/[id]`

---

## 2026-03-30 — DeliverableRecord Library, Dropdown Title, Deliverables Tab

### Ditambah

- **`DeliverableRecord` model (Prisma)** — Model baharu untuk menyimpan template deliverable boleh-guna-semula: `id`, `title` (unique), `description?`, `created_at`
- **Migration `20260330120000_add_deliverable_records`** — Create `DeliverableRecord` table dengan unique index pada `title`
- **`GET/POST /api/deliverable-records`** — List semua rekod (awam); POST hanya untuk manager (403 jika bukan manager); tolak jika `title` sudah wujud
- **`PUT/DELETE /api/deliverable-records/[id]`** — Kemaskini dan padam rekod (manager sahaja)
- **Tab "Deliverables" dalam `/projects`** — Tab baharu untuk urus library rekod deliverable; papar senarai dalam jadual; sokongan tambah, edit, dan padam rekod terus dari halaman Projects

### Diubah

- **`DeliverableSection.tsx`** — Field Title dalam modal New/Edit Deliverable kini menggunakan dropdown (pilih dari `DeliverableRecord` library); pilih "＋ Add new title..." untuk masuk teks bebas; butang "Library" untuk balik ke dropdown; apabila rekod dipilih, `description` auto-filled; Est. Mandays dialih ke bawah Planned Start/End; `titleIsCustom` state untuk toggle antara dropdown dan input teks
- **`src/app/projects/page.tsx`** — Tambah `DeliverableRecord` type; tambah `DeliverablesTab` component; `TABS` kini termasuk `'Deliverables'`; render `<DeliverablesTab>` apabila tab aktif

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

| Layer     | Tech                            |
| --------- | ------------------------------- |
| Framework | Next.js 14 (App Router)         |
| Database  | PostgreSQL via Prisma 5         |
| Auth      | NextAuth v4 (Credentials + JWT) |
| Email     | Nodemailer (SMTP)               |
| Styling   | Tailwind CSS 3                  |
| Language  | TypeScript                      |

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
