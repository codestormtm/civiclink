# CivicLink Project Memory

This file is a persistent working memory for the `civiclink` workspace. It summarizes the architecture, major flows, and important quirks so future work can start with context instead of rediscovery.

## Workspace Overview

- `backend/`: Express API, Postgres access, MinIO uploads, Socket.IO events, AI-guided intake flow.
- `web-public/`: citizen-facing React/Vite app for login, manual complaint submission, guided AI submission, tracking, and a public transparency page.
- `web-admin/`: admin and worker React/Vite app for system admin, department admin, and worker workflows.
- `docker/`: local infra for Postgres, Redis, and MinIO.
- `docs/`: setup notes for pgAdmin.
- Root `Readme.md` is currently empty.

## Product Model

CivicLink is a multi-role civic complaint platform for Sri Lanka.

Core roles:

- `SYSTEM_ADMIN`: creates departments, department admins, and complaint types.
- `DEPT_ADMIN`: reviews complaints inside one department, assigns/reassigns workers, changes priority, views SLA/reporting screens, and can reject wrong-department complaints.
- `WORKER`: sees assigned complaints, starts work, resolves complaints, uploads evidence.
- `CITIZEN`: registers/logs in, submits complaints manually or through AI intake, uploads attachments, and tracks their own complaints.

Core domain objects:

- `departments`
- `department_issue_types`
- `users`
- `worker_profiles`
- `complaints`
- `complaint_attachments`
- `complaint_assignments`
- `complaint_status_logs`
- `complaint_intake_sessions`

## Backend Architecture

Main files:

- `backend/src/server.js`: boots env validation, database check, MinIO bucket check, HTTP server, and Socket.IO.
- `backend/src/app.js`: Express app wiring, CORS, JSON parsing, request logger, routes, health endpoint, and `/api/users`.
- `backend/src/config/env.js`: hard-fails startup when required env vars are missing.
- `backend/src/config/db.js`: shared `pg` pool.
- `backend/src/config/minio.js`: MinIO client and bucket bootstrap.

Important middleware:

- `authMiddleware`: JWT Bearer auth.
- `roleMiddleware`: coarse role gate.
- `validateMiddleware`: Zod request validation.
- `uploadMiddleware`: Multer memory storage.
- `requestLogger`, `errorMiddleware`, `notFoundMiddleware`.

Utilities:

- `complaintHistory.js`: writes rows to `complaint_status_logs`.
- `response.js`: shared success/failure helpers.
- `logger.js`: console logging wrapper.
- `notificationService.js`: placeholder stub right now.

## API Surface

Auth:

- `/api/auth/register`
- `/api/auth/login`

Citizen complaint routes:

- `/api/citizen-complaints/departments`
- `/api/citizen-complaints/departments/:departmentId/types`
- `POST /api/citizen-complaints`
- `POST /api/citizen-complaints/:complaintId/attachments`
- `GET /api/citizen-complaints/track/:complaintId`

Generic complaint routes:

- `/api/issues`
- `/api/issues/map`
- `/api/issues/:id/status`
- `/api/issues/:id/priority`

Assignment and worker routes:

- `/api/assignments/assign`
- `/api/worker/assignments`
- `/api/worker/assignments/:id`
- `/api/worker/assignments/:id/status`
- `/api/worker/assignments/:id/attachments`
- `/api/workers`

Admin/reporting routes:

- `/api/departments`
- `/api/departments/:departmentId/issue-types`
- `/api/system-admin/create-admin`
- `/api/dept-admin/summary`
- `/api/dept-admin/complaints`
- `/api/dept-admin/workload`
- `/api/dept-admin/performance`

Public routes:

- `/api/public/stats`
- `/api/public/recent-resolved`
- `/api/public/department-summary`
- `/api/public/complaints/map`

AI intake routes:

- `/api/intake/start`
- `/api/intake/:sessionToken/message`
- `/api/intake/:sessionToken`
- `/api/intake/:sessionToken/submit`

## Database Notes

Base schema is in `backend/sql/001_schema.sql`.

Seed data in `backend/sql/002_seed.sql` creates three departments:

- Municipal
- EB
- Transport

Additional schema changes are split across later SQL or scripts:

- `backend/sql/002_intake_sessions.sql`: AI intake session table.
- `backend/sql/003_complaint_status_logs.sql`: complaint history log table.
- `backend/sql/004_complaint_location_fields.sql`: location field migration.
- `backend/scripts/addSlaFields.js`: adds `priority_level` and `sla_due_at` to `complaints`.

Important DB rules already encoded:

- complaint department cannot change after insert
- issue type must belong to same department as complaint
- worker profile department must match worker user department
- assignment foreign keys prevent cross-department worker assignment

## Main User Flows

Citizen manual submission:

1. Citizen logs in or registers.
2. Citizen chooses department and complaint type.
3. Citizen enters title and description.
4. Citizen can optionally attach map/GPS location.
5. Citizen submits complaint and can optionally upload one attachment.

Citizen guided AI submission:

1. Citizen starts intake session.
2. Backend stores `complaint_intake_sessions`.
3. `intakeService` sends conversation plus available departments/types to Groq.
4. AI fills `department_id`, `issue_type_id`, `title`, `description`, `address_text`.
5. Frontend can show a map picker when `needs_location` is true.
6. Final draft is submitted into `complaints`.

Department admin flow:

1. Load department summary and filtered complaint queue.
2. Review complaint status, priority, SLA state, reporter, assignment, and location.
3. Assign or reassign worker.
4. Change priority.
5. Reject wrong-department complaints with a reason.
6. Review workload and performance reports.

Worker flow:

1. Worker sees assigned tasks in dashboard.
2. Worker opens detail page.
3. Worker can move complaint `ASSIGNED -> IN_PROGRESS -> RESOLVED`.
4. Worker can upload evidence attachments.
5. Worker sees status history and all attachments on the task.

System admin flow:

1. Create departments.
2. Create department-specific complaint types.
3. Create department admins.
4. View department cards and recent complaints.

## Realtime Behavior

Socket.IO is initialized in `backend/src/server.js`.

Server emits:

- `new_issue`
- `task_assigned`
- `status_updated`

`web-admin/src/pages/Dashboard.jsx` listens and refreshes the complaint list and summary.

## Frontend Structure

### Public app

Entry points:

- `web-public/src/App.jsx`
- `web-public/src/pages/Login.jsx`
- `web-public/src/pages/CitizenComplaintForm.jsx`
- `web-public/src/pages/GuidedReportPage.jsx`
- `web-public/src/pages/TrackComplaint.jsx`
- `web-public/src/pages/PublicDashboard.jsx`

Notable details:

- Uses localStorage token/role/name auth helpers.
- Public transparency page is available at `/public` without auth.
- Google Translate widget is injected in `web-public/index.html`.
- Manual submit and guided AI submit both support map-based location.

### Admin app

Entry points:

- `web-admin/src/App.jsx`
- `web-admin/src/pages/Login.jsx`
- `web-admin/src/pages/Dashboard.jsx`
- `web-admin/src/pages/DepartmentReports.jsx`
- `web-admin/src/pages/Workers.jsx`
- `web-admin/src/pages/WorkerDashboard.jsx`
- `web-admin/src/pages/WorkerTaskDetail.jsx`
- `web-admin/src/pages/SystemAdmin.jsx`

Notable details:

- Role-based branching happens directly in `App.jsx`.
- Department admin area uses a sidebar `Layout`.
- Worker UI is a separate topbar-based experience.
- Axios auth setup mirrors the public app.

## External Dependencies and Services

Required backend services/config:

- Postgres
- MinIO
- JWT secret
- Groq API key for AI intake

Docker compose currently provisions:

- Postgres on `localhost:5433`
- Redis on `localhost:6379`
- MinIO on `localhost:9000` with console on `localhost:9001`

Note: Redis exists in Docker but is not currently used by first-party app code.

## Commands and Setup Clues

Backend scripts:

- `npm run dev`
- `npm run create:system-admin -- "Name" "email" "password"`
- `npm run reset:password -- "email" "password"`

Useful migrations/scripts that may need manual execution:

- `backend/sql/001_schema.sql`
- `backend/sql/002_seed.sql`
- `backend/sql/002_intake_sessions.sql`
- `backend/sql/003_complaint_status_logs.sql`
- `backend/sql/004_complaint_location_fields.sql`
- `backend/scripts/addSlaFields.js`

## Known Quirks and Risks

These are worth checking before making feature changes:

- `backend/sql/001_schema.sql` does not define `priority_level` or `sla_due_at`, but backend controllers assume both exist. The separate `addSlaFields.js` migration must have been run.
- `backend/src/controllers/assignmentController.js` updates active assignments to status `REASSIGNED`, but the base schema check constraint only allows `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`. This likely causes runtime failures unless the DB constraint was manually changed later.
- `backend/src/constants/roles.js` defines `WORKER`, matching the rest of the codebase.
- `backend/src/services/ai/intakeService.js` uses Groq, but `backend/scripts/listGeminiModels.js` is leftover Gemini-era tooling and is not aligned with current AI integration.
- `web-public` uses Google Translate in `index.html` while the AI intake also has native multilingual prompts. There are effectively two translation mechanisms.
- Many files contain mojibake in comments/strings, suggesting encoding issues in the repository.
- `notificationService.js` is effectively a stub, so “notifications” are not real yet.
- No test suite was found in the repository.
- Root workspace does not appear to be a Git repository from the current folder context.

## Good Starting Points for Future Work

If touching complaint lifecycle logic:

- start with `backend/src/controllers/issueController.js`
- then `backend/src/controllers/assignmentController.js`
- then `backend/src/controllers/workerAssignmentController.js`

If touching AI-guided reporting:

- start with `backend/src/services/ai/intakeService.js`
- then `backend/src/controllers/intakeController.js`
- then `web-public/src/pages/GuidedReportPage.jsx`
- then `web-public/src/components/IntakeChat.jsx`

If touching department-admin operations:

- start with `web-admin/src/pages/Dashboard.jsx`
- then `backend/src/controllers/deptAdminController.js`
- then `backend/src/controllers/workerController.js`

If touching worker experience:

- start with `web-admin/src/pages/WorkerDashboard.jsx`
- then `web-admin/src/pages/WorkerTaskDetail.jsx`
- then `backend/src/controllers/workerAssignmentController.js`

## Summary Mental Model

This project is already organized around a newer department-scoped complaint model with role-based workflows, live admin refresh, AI-assisted intake, map-based location capture, and attachment storage in MinIO. The biggest practical hazard is not app structure but drift between schema/migrations and controller expectations.
