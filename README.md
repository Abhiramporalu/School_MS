# Classroom — School Management & Examinations

A full-stack school administration and examination portal built with React, JavaScript, Express, Prisma, and PostgreSQL. The application uses database-backed records for its dashboards, class reports, rankings, and report cards.

## Features

- Session-based authentication with Admin, Teacher, and Student roles.
- Signup requests for all roles with administrator approval, plus administrator-assisted password recovery.
- Student registration, profiles, search, enrollment changes, deactivation, CSV import, and CSV export.
- Academic years, classes, sections, subjects, class-teacher assignment, and subject-teacher assignment.
- Examination setup, schedules, configurable marks thresholds, teacher-scoped marks entry, and mark-change audit records.
- Server-calculated totals, percentages, subject and overall pass/fail, grade, division, distinction, and tied ranks.
- Examination analytics, section summaries, subject averages/toppers, and role-scoped dashboards.
- Printable report cards (browser print / Save as PDF) and result CSV exports.
- PostgreSQL schema includes attendance and report-card records for future school workflows.

## Requirements

- Node.js 22 or later and npm 10 or later.
- A PostgreSQL 15+ database (the configured Neon database can be used).

## Local setup

1. Copy `.env.example` to `backend/.env` and set a unique `SESSION_SECRET` (at least 32 characters). Change the seed passwords before loading demo data.
2. Install and generate the database client:

   ```sh
   npm install
   npm run db:generate
   ```

3. Create the PostgreSQL database named in `DATABASE_URL`, then apply the schema:

   ```sh
   npm run db:push
   ```

   For a migration-based environment, use `npm run db:migrate -w backend` after applying the checked-in migration.

4. Optional: load demonstration users, students, classes, marks, and published results:

   ```sh
   npm run db:seed
   ```

5. Start the API and frontend:

   ```sh
   npm run dev
   ```

   Open `http://localhost:5173`. The API listens at `http://localhost:4000`; Vite proxies `/api` requests to it.

### Demo accounts

Seeding creates `admin@school.local`, `teacher@school.local`, and `student@school.local`. Their passwords are read from `SEED_ADMIN_PASSWORD`, `SEED_TEACHER_PASSWORD`, and `SEED_STUDENT_PASSWORD` in `backend/.env`. They are local demo credentials: replace them and do not use the example passwords in production.

New users can request an Admin, Teacher, or Student account from the sign-in screen. Requests stay pending until an administrator reviews them in **Teaching staff → Signup & password requests**. Password recovery is administrator-assisted: admins verify the requester out of band, generate a one-time temporary password from the same screen, and share it through a trusted channel.

## Database migrations

The normalized Prisma schema is in `backend/prisma/schema.prisma`; the initial SQL migration is in `backend/prisma/migrations/`. To apply migrations in a deployed environment:

```sh
npm run db:migrate -w backend
```

`db:push` is convenient for local development. Use committed migrations for deployment and never use `db:push` against production.

## Production deployment

- Use a managed PostgreSQL service, TLS, a unique secret manager-backed `SESSION_SECRET`, and per-environment seed credentials.
- Build the API and static frontend with the supplied npm scripts; serve the frontend and route `/api` through one HTTPS origin.
- Apply `prisma migrate deploy` as a release job before starting new application instances.
- Set `NODE_ENV=production`, `CLIENT_ORIGIN` to the exact HTTPS web origin, and enable secure cookies. Terminate TLS at a trusted ingress/reverse proxy.
- Back up PostgreSQL, monitor application and database health, and rotate credentials. Do not expose the database publicly.
- Use a dedicated managed session store/table in production and configure rate limiting at the edge for multiple replicas.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and web development servers |
| `npm run build` | Build and validate both JavaScript workspaces |
| `npm test` | Run API and frontend unit tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Synchronize local development schema |
| `npm run db:create-admin -w backend` | Create the first admin only and print a generated password once |
| `npm run db:seed` | Add idempotent demo data |
| `npm run db:migrate -w backend` | Apply committed migrations |

API endpoints and role permissions are described in [docs/API.md](./docs/API.md).
# School_MS
# School_MS
