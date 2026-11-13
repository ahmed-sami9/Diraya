# Working Preferences

## Never change anything without explicit instruction
- Do NOT apply, change, delete, or add anything (code, files, config) unless I clearly tell you to.
- If my message doesn't explicitly ask for a change, don't make one. Answer, explain, or suggest instead.
- When I do ask for a change, change **only** what I asked for. No extra refactors, cleanups, renames, or "while I'm here" edits.

## Do share observations freely
- Feel free to point out anything you notice that's worth changing, updating, removing, or that needs attention (bugs, inconsistencies, cleanup opportunities, missing pieces).
- Give these as notes or suggestions. Leave them unapplied until I say so.

## Act as a mentor, not a tool that agrees
- Always weigh what I ask against best practices, and tell me when there is a better way to do it.
- Don't agree with me by default. Test my ideas: if something I propose is wrong, weak, or will cause problems later, say so plainly and explain why.
- When you disagree, give the reasoning and the alternative, then let me decide. The rule above still applies: suggest it, and leave it unapplied until I say so.

## Explain the reasoning after every build
- Whenever you implement or build something for me (a feature, page, function, component, endpoint, migration, etc.), end with a section called **"Why it's built this way"**.
- Cover every design or logic decision that is unique, non-obvious, or a deliberate choice over another option, especially anything an interviewer or recruiter could ask about, or that I need to understand to own and explain this code.
- For each decision, give:
  - **What** was done.
  - **Why** this way and **not the obvious alternative** (the trade-off, and what would break or get worse otherwise).
  - **The concept or best practice behind it**, named, so I can study it (for example "idempotency", "server as the single source of truth").
- Include how the new piece connects to the rest of the codebase (what calls it, what it depends on).
- Point out the one or two parts most likely to come up in an interview, and how I would explain them in a sentence.
- Skip the section only for trivial changes (a typo, a colour, a renamed variable) where there is no decision to explain.

## Tests: flag them and plan them with me before implementing
- Whenever a piece of work needs tests (business rules, money, permissions or ownership, database constraints, concurrency, anything that is costly if it silently breaks), tell me so **before** writing the code.
- Talk me through the test plan first:
  - **what** to test (happy path, bad input, someone else's data, rule conflicts, empty state);
  - **why** each one matters;
  - **which layer and tool** (repository or API tests with node:test + tsx on the backend; Vitest for pure frontend logic; React Testing Library for key behaviour; Playwright for end-to-end flows).
- Put testing where the risk is: backend rules first, then pure frontend logic. Don't test thin pass-through code (fetch wrappers, plain markup).
- Also say when something does **not** need tests, and why.

## Point out best practices I should know, even when I don't ask
- If a task touches a practice I should know about (testing, security, validation, error handling, accessibility, performance, migrations, git hygiene, etc.) and I haven't mentioned it, raise it.
- Keep it short: name the practice, why it matters here, and what you would do. Mark the important ones clearly so they stand out.
- This is a note, not a change: the "never change anything without explicit instruction" rule still applies.

# Project context

Read this at the start of every Diraya chat. Update "Status" and "Ship plan" when they change.

## What Diraya is
Educational management system for private teachers in Egypt (grades, groups, students, attendance, exams & marks, payments). v1 is the teacher side only; a student/parent portal is on the roadmap.

## Stack
- Backend: Express 5 + TypeScript, raw PostgreSQL via `pg` (no ORM), zod validation, argon2, JWT (HS256) in an httpOnly cookie + a `teacher_sessions` row per sign-in, node-pg-migrate.
- Frontend: React 19 + TypeScript + Vite + Tailwind v4, React Router 7.
- Root `npm run dev` runs both.

## Backend conventions
- One folder per module in `src/modules/<name>/`: `routes → validation → controller → service → repository` + `<name>.errors.ts`. Controllers only translate HTTP; services hold rules; repositories hold SQL.
- Everything a teacher owns is mounted in `modules/teacher/teacher.routes.ts` behind `authenticate`. `req.user` = `{ userId, role, sessionId }`.
- Validation: `validateBody` / `validateQuery` from `middlware/validate.ts` → 400 `INVALID_INPUT`. Request schemas use `.strict()` when extra fields would be dangerous (account).
- Errors: throw `AppError(status, CODE, message)`; `errorHandler` sends `{ code, message }`, anything else is a 500 with no internals.
- **Never answer 401 for anything except "not signed in / session ended"**: the frontend's `apiClient` treats every 401 as "your session has ended".
- Multi-step writes run in one transaction (`pool.connect()` + BEGIN/COMMIT/ROLLBACK), e.g. password reset, password change, demo creation.
- Phones are stored normalized: 11 digits `01[0125]XXXXXXXX`, enforced by zod and a DB CHECK.
- Demo: each visitor gets their own temporary teacher (`is_demo`, fake `.invalid` email), seeded from `modules/demo/demo.seed.ts`, deleted on sign-out or after 24h.

## Frontend conventions
- Layers: `api/<area>/*.ts` (fetch via `apiRequest`, throws `ApiError` with `code`) → `hooks/<area>/use*.ts` (loading/error/ready, writes) → page components. Pages never fetch directly.
- URL is the state for filters/tabs/dialogs (`?month=`, `?grade=`, `?new=1`, nested routes for tabs).
- Shared styles: `components/formStyles.ts` (inputs, buttons, form error box); cards use `SectionCard`.
- Colour tokens in `index.css` (light + `.dark`). `primary` = brand colour for text, lines, focus rings; `primary-solid` = filled backgrounds under white text (buttons). Never hard-code colours in new code.
- Theme: `context/ThemeContext.tsx` + `utils/theme.ts`, stored in localStorage (per device, no server). The inline script in `index.html` applies it before first paint; default is `light` until the dark-mode pass is done.
- Teacher dashboard is desktop-first; student-facing pages (future) mobile-first.

## Tests
- Backend: `npm test` in `backend/` (node:test + tsx, real database `diraya_test_db` from `.env.test`; `assertTestDatabase` refuses any other DB). Run `npm run migrate:test` after adding a migration.
- Covered (API tests): every module, including attendance, grades and auth. `src/test/api.ts` has the shared test server and signed-in teacher helpers. `src/config/env.test.ts` covers the start-up settings check. 378 tests as of 12 Nov 2026.
- Frontend: `npm test` in `frontend/` (node:test) for pure logic only (utils, helpers): 92 tests. Planned: one Playwright end-to-end flow against the live site after deploy.
- `auth.api.test.ts` shares one rate limiter per file: the email limiter allows 5 requests per 15 minutes, so new forgot-password or resend tests go in a new file.

## Status (12 Nov 2026)
Done: auth (password, Google, demo, reset, email verification), grades, groups (timetables, student order), students + profile (WhatsApp/PDF parent reports), attendance, exams & marks, payments, notes, recent activity, Overview page, Settings v1 (profile, password change that signs out other sessions, appearance/theme), theme toggle on the sign-in pages. Pre-launch fixes: `.env` read only in `server.ts`, settings validated at start-up (`config/env.ts`), `GET /api/v1/health`, idle DB connection handler, 404 page, WebP sign-in images, page title and preview tags, security headers (`helmet`), graceful shutdown on SIGTERM (`server.ts`), `npm audit fix` on both apps, `frontend/vercel.json` (SPA rewrite), Record payment on the student profile, dashboard content left-aligned and capped at 1440px.

## Ship plan (in this order; anything not listed goes to "v2 ideas")
1. ~~Deploy blockers in the code~~ (done: API URL from `VITE_API_URL`, build passes, env checked at start-up).
2. ~~Demo template~~ (done: every feature has seed data).
3. ~~Integration pass~~ (done 3 Nov: every page clicked through on desktop and phone).
4. Deploy: buy the domain; frontend and API on subdomains of it (same site, so the `SameSite=Lax` cookie works); SPA rewrite to `index.html` (`frontend/vercel.json` is ready for Vercel; another host needs its own rule); production env vars; `npm run migrate up` on the production DB; Google authorized origin; Resend domain verification; add `og:image` with the live URL. Build with `npm ci --include=dev && npm run build` (tsc is a devDependency).
5. README is written: fill in the live-demo and case-study links (`docs/screenshots/` is in). Then the portfolio page entry (demo + repo links, status "live").
6. Resume, then apply for jobs while building the second project (Circles).

## Known issues / small cleanups
- Focus moved to a disabled input after a server error in dialogs (e.g. `GradeFormDialog`); fix with the `focusAfterSave` pattern from `PasswordCard`.
- Egyptian phone rule duplicated in students + account validation; could share one schema.
- `SectionCard` lives in `students/profile/components` but is shared; belongs in `components/`.
- Icons with hard-coded colours: `AlertCircleIcon`, `EyeIcon`, `LockIcon`, `MailIcon`.
- `frontend/Structure & Design.md` still describes the deleted `AddExamDialog`.
- `handleLogout` in `TeacherDashboardLayout` still calls `navigate('/teacher/sign-in')`; redundant since `ProtectedRoute` redirects on sign-out.
- Settings forms stretch to the full 1440px on wide screens; cap that page at about 720px.
- `frontend/README.md` is still the Vite template text; `backend/src/modules/auth/read.md` is an old note.
- Expired `teacher_sessions` rows are never deleted (demo ones go with their teacher); clean up at sign-in, like the demo cleanup.
- `npm audit`: 3 moderate advisories left in `node-pg-migrate`'s `glob` (migration CLI only, not reachable from requests); fixing needs a breaking upgrade.

## v2 ideas (after the job search starts)
Dark-mode pass (sign-in pages are not tokenised), student/parent portal, Arabic + RTL, photo upload, "sign out other devices" button, Teaching defaults settings (default pass mark %, attendance edit lock), frontend unit tests (Vitest).
