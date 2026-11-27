# Academic Setup

The Admin screen reads the planner catalogs, saves the active school year, manages local holidays, and generates a syllabus plan. Its API contract is in `SarafWorldsphere/saraswati-syllabus-planner` (`app/schemas/school.py`, `app/schemas/platform.py`, and `docs/wireframes/academic-setup.svg`).

## Routes and ownership

With this repository's `/admin` Next basePath, open `/admin/academic-setup`. The `app/admin/academic-setup` page is an alias for the existing Admin route structure, including the sidebar link in Krithi's separate PR #12. Both routes use the same component; the root route reuses the Admin layout.

No sidebar or Syllabus Plan screen changes are included. Krithi owns those changes in PR #12 (target: `saas`).

## Configuration and authentication

Start the planner API separately, then set this **server-only** environment variable for the Admin Node process:

```dotenv
SYLLABUS_PLANNER_API_URL=http://127.0.0.1:8010/api/v1
SYLLABUS_PLANNER_DEV_AUTH=false
```

The browser's API prefix comes from `NEXT_PUBLIC_APP_BASE_PATH`, which `next.config.js` derives directly from `basePath` at build time. With the current config this is `/admin/api/academic-setup/*`; changing the Next basePath and rebuilding updates API calls automatically. Do not configure a separate, competing prefix in `.env`.

An allowlisted server proxy forwards the request's bearer token or HttpOnly `admin_token` cookie and preserves Host for school resolution. It uses Node's HTTP transport because native fetch rewrites Host to the upstream address. Calls have a 15-second timeout, a 2 MiB response limit and never follow redirects. HTTPS verifies the upstream hostname independently of the school Host. The planner must accept the token's signing key, role and tenant claims. This change does not mint a new SSO token or change existing login behaviour. Missing configuration, rejected auth and unavailable services are shown as errors, not successful saves.

The screen uses the existing Admin layout/Students palette: `from-slate-900 via-indigo-950 to-slate-900`, translucent white cards/controls, and blue/cyan action buttons. Shared layout/sidebar colours are unchanged.

For local `npm run dev` testing only, explicitly setting `SYLLABUS_PLANNER_DEV_AUTH=true` substitutes the backend's development `dev-admin` stand-in **only** for a loopback API URL and `NODE_ENV=development`. Production builds never use it. Existing Admin middleware still requires a session. Do not use this stand-in for deployed authentication.

## Behaviour

- Boards and calendars come from separate catalogs; choosing another board retains the calendar. Names/descriptions are displayed and numeric IDs are saved. The bootstrap contains AP SCERT; CBSE appears when its catalog row exists. No IDs are invented.
- An unset year (404) is an initial setup state. Saving POSTs `board_id`, `calendar_id`, `academic_year`, `start_date`, `end_date`. Unchanged saves are disabled. Changing an active year asks for confirmation because the API closes the old year and creates a new one. Old holidays/plans are not copied.
- Holidays are persisted through GET/POST `/holidays` and DELETE `/holidays/{holiday_id}`. Unsaved year changes disable holiday mutations and plan generation.
- Generate Plan sends positive numeric `class_id` and `subject_id`, as in the wireframe. It shows the backend's actual `created` and `skipped` counts, including a no-matching-syllabus result. There is no fake calendar preview or localStorage plan.
- Subject/chapter matching, class master creation, planner schema migrations and live data changes are outside this PR.

## Validation

```bash
node --test tests/academic-setup.test.mjs
npx eslint components/AcademicSetupScreen.tsx 'app/api/academic-setup/[...path]/route.js' lib/academic-setup.mjs lib/academic-setup-proxy.mjs
npm run build
```

Local browser checks use an isolated PostgreSQL database, the real planner API, and a disposable signed test JWT: independent catalogs, numeric save payload, cancel/confirm year replacement, persisted holiday add/delete, created/skipped plan generation, Faculty write rejection, and desktop/mobile layout. No EC2 deployment or production database write is included.
