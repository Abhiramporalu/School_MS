# API reference

Base path: `/api`. Except for health and authentication endpoints, requests require the `school.sid` HTTP-only session cookie. The browser client sends credentials automatically. JSON request bodies use `Content-Type: application/json`.

## Authentication and access

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness probe |
| POST | `/auth/login` | Public, rate-limited | Create a session |
| POST | `/auth/signup` | Public, rate-limited | Submit an Admin, Teacher, or Student sign-up request for administrator approval |
| POST | `/auth/forgot-password` | Public, rate-limited | Submit a password-help request for an existing login or active student with a registered email; response does not reveal whether the email is registered |
| POST | `/auth/logout` | Authenticated | Destroy the current session |
| GET | `/auth/me` | Authenticated | Return the current user profile |
| GET | `/auth/admin/registration-requests` | Admin | List pending account requests |
| POST | `/auth/admin/registration-requests/:id/approve` | Admin | Create and activate the requested account |
| POST | `/auth/admin/registration-requests/:id/reject` | Admin | Reject a signup request and discard its stored password hash |
| GET | `/auth/admin/password-reset-requests` | Admin | List password-help requests |
| POST | `/auth/admin/password-reset-requests/:id/complete` | Admin | Set a random temporary password and return it once for verified out-of-band delivery |

Role failures return `403`; missing/expired sessions return `401`. Invalid input returns `400` with Zod validation details. Duplicate unique values return `409`.

Sign-up requires a full name, email, password (12–128 characters), and requested role. Teacher requests also require an employee number; Student requests require an admission number. No user account is created until an administrator approves the request. Password-help requests use a generic public response; administrators must verify the requester out of band before sharing the one-time temporary password. For an active student with a registered email but no login, completing the request creates and links a student login before issuing the temporary password.

## School structure

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET / PUT | `/school/profile` | Auth / Admin | Read or update school name, address, logo URL, principal |
| GET / POST | `/school/academic-years` | Auth / Admin | List or create academic years |
| GET / POST | `/school/classes` | Auth / Admin | List classes or create a class and initial sections |
| PATCH | `/school/classes/:classId` | Admin | Update a class name, grade, or class teacher |
| POST | `/school/classes/:classId/sections` | Admin | Add a section |
| GET / POST | `/school/subjects` | Auth / Admin | List or create subjects |
| POST | `/school/classes/:classId/subjects` | Admin | Set class subject max/pass marks |
| GET / POST | `/school/teachers` | Auth / Admin | List or create teacher accounts |
| POST | `/school/assignments` | Admin | Assign a teacher to a class subject and optional section |
| POST | `/school/assignments/bulk` | Admin | Assign a teacher to a subject across multiple classes and selected sections; `sectionId: null` targets all sections |

Teacher class views are limited to assigned classes. Student views are limited to their own enrollment.

## Students

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/students?search=&classId=&sectionId=&page=&pageSize=` | Auth | Search and paginate active students |
| GET | `/students/:studentId` | Auth | Student profile and result history, role-scoped |
| POST | `/students` | Admin | Create a student and enrollment; generates an admission number when `admissionNo` is omitted; optionally create a student login with `loginPassword` |
| POST | `/students/import` | Admin | Import up to 500 CSV-converted student records in `{ "rows": [...] }` |
| PATCH | `/students/:studentId` | Admin | Edit profile, status, or enrollment |
| DELETE | `/students/:studentId` | Admin | Deactivate student and current enrollment |

The CSV importer expects `admissionNo`, `fullName`, `classId`, `sectionId`, `academicYearId`, and `rollNumber`; optional fields include `email`, `guardianName`, `guardianPhone`, and `guardianEmail`. A template can be downloaded from the student screen. Manually added students receive an `ADM-<year>-<unique ID>` admission number when one is not supplied.

## Examinations, marks, and results

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/exams?academicYearId=&classId=` | Auth | List exams visible to the current role |
| POST | `/exams` | Admin / assigned Teacher | Create an exam and its subject mark thresholds within authorized subjects/sections |
| GET | `/exams/:examId/marks/:examSubjectId` | Admin / assigned Teacher | Read the authorized marks roster |
| PUT | `/exams/:examId/marks/:examSubjectId/:studentId` | Admin / assigned Teacher | Enter/update a mark; validates roster, assignment, and maximum |
| POST | `/exams/:examId/publish` | Admin | Require complete marks, calculate and persist results/ranks/report-card records, publish |
| GET | `/exams/:examId/results` | Admin / enrolled Student | Read full class results or the student's own result |
| GET | `/exams/:examId/subject-results/:examSubjectId` | Admin / assigned Teacher | Read a subject-only report, limited to assigned sections |

Mark changes are recorded in `AuditLog` with actor, previous score, and new score. Marks cannot be changed after an exam is published. A student passes overall only when every required subject meets its passing mark. Equal total marks share rank.

Example mark request:

```json
{ "score": 82.5 }
```

## Dashboard and reports

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/dashboard?examId=&academicYearId=&classId=&section=&subject=` | Auth | Role-specific dashboard statistics and analytics |

Admin analytics and rankings are calculated from published `Result` and `Mark` records. Teacher dashboards and subject reports are scoped to assigned classes/sections; student dashboards show only the authenticated student's profile, schedule, and result history. The frontend exports CSV and prints report cards through the browser's PDF print flow.

## Database

The normalized Prisma schema and initial PostgreSQL migration cover `Users`, `Students`, `Parents`, `Teachers`, `AcademicYears`, `Classes`, `Sections`, `Subjects`, `ClassSubjects`, `TeacherAssignments`, `Enrollments`, `Examinations`, `ExamSubjects`, `Marks`, `Results`, `Attendance`, `ReportCards`, and `AuditLog`.
