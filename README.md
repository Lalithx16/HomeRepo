# Homebase

Homebase is a home-inventory web app. It starts with the kitchen (pantry, fridge, freezer, cabinets) and is built to cover the whole home. It tracks what you have, where it's stored, when it expires and what to restock. It also suggests what you can cook and keeps a shared shopping list. It installs to your phone's home screen as a Progressive Web App (PWA), and you can keep updating quantities and checking off shopping items while offline.

**Version 1 contains no AI.** Search, restock suggestions, analytics and recipe matching all use ordinary, deterministic application logic. AI is a future extension point (see [Future improvements](#future-improvements)).

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Start from a fresh Windows computer](#start-from-a-fresh-windows-computer)
5. [Supabase setup and migrations](#supabase-setup-and-migrations)
6. [Authentication and Row Level Security](#authentication-and-row-level-security)
7. [Run locally](#run-locally)
8. [Deploy to Vercel](#deploy-to-vercel)
9. [Install as an app (PWA)](#install-as-an-app-pwa)
10. [Testing](#testing)
11. [How things work](#how-things-work)
12. [Verification status of this package](#verification-status-of-this-package)
13. [Known limitations](#known-limitations)
14. [Future improvements](#future-improvements)

---

## Features

| Area | What you can do |
|---|---|
| **Overview** | Greeting and summary, metric cards (tracked items, low stock, expiring, shopping), a "Needs attention" list, recent activity, storage shortcuts, recipe ideas, quick actions. Every number comes from the database. |
| **Inventory** | Grid and list views. Search by name, brand, category or location. Filter by category, location (including sub-locations), stock status and expiry status. Sort by name, quantity, expiry, recently updated or category. Filter chips, one-tap reset, pagination. |
| **Items** | Add items with name, brand, category, quantity and unit, location, minimum stock, restock target, expiry date, purchase date and price, notes, and a photo. You can create a new category or location without leaving the form. Duplicates are detected and you're offered "add as new batch". |
| **Batches (lots)** | Each product can have several batches, each with its own location, quantity and expiry date. Per batch you can step quantities up or down, correct a count, move all or part of it, edit dates, or remove it. Everything is recorded in an append-only history. |
| **Locations** | Nested hierarchy (Kitchen › Pantry › Shelf 2 › Container A) with breadcrumbs, item counts rolled up from sub-locations, "Add inside", "Move all items", and circular-nesting protection in both the UI and the database. |
| **Expiring soon** | Expired and soon-to-expire batches in separate groups, soonest first, with 7, 14 or 30-day windows. One tap for "Used it" or "Discard". Items without an expiry date never appear. |
| **Low stock** | Shows current quantity, minimum and suggested restock amount. Add items to the list one at a time or all at once. |
| **Recipes** | 22 built-in recipes, matched against real stock quantities with unit conversion. Filters: ready to make, missing 1–2, favorites, time, diet. Recipe pages show per-ingredient status and an "Add missing to shopping list" button. |
| **Shopping list** | Grouped by store section, with a checklist built for phones and offline check-off. Edit, remove and restore items. Add low-stock items in one tap. "Finish shopping" moves purchased items into inventory, with location, expiry and price for each. |
| **Ratings** | Rate products and brands from 1 to 5 stars and add notes. Ratings are per user and visible to everyone in the household. |
| **Analytics** | Item counts by category and location, an expiry outlook, spending by month (shown once there's enough priced data), 30-day activity, most-used items and recent changes. |
| **Search** | Global ⌘K / Ctrl+K (or `/`) palette with results grouped into items, locations and categories. Fully keyboard accessible. |
| **Households** | Multiple households per user, a household switcher, and owner/editor/viewer roles. Invitations use single-use, email-bound links that expire after 7 days. |
| **PWA & offline** | Installable on iPhone and Android. Visited pages stay readable offline. Quantity changes and shopping check-offs are queued on the device and synced later, with visible pending and failed states. |
| **Design** | Calm, minimal UI with design tokens, full light and dark themes, Lucide icons, accessible focus states, reduced-motion support, and a mobile layout with a bottom tab bar, add button and bottom sheets. |

## Tech stack

- **Next.js 15 (App Router) + React 19 + TypeScript (strict)**
- **Tailwind CSS v4** with semantic design tokens. **shadcn/ui-style components** are written in `src/components/ui`, built on Radix primitives.
- **Supabase**: PostgreSQL, Auth and Storage, with **Row Level Security** on every table
- **Zod** for input validation, **Lucide** for icons, **sonner** for toasts, **cmdk** for the search palette, **next-themes** for dark mode
- **Vitest** for unit tests, **Playwright** for end-to-end tests, and a SQL test suite for RLS and database logic
- Hosting on **Vercel**, source control on **Git/GitHub**

## Project structure

```
homebase/
├─ supabase/
│  ├─ migrations/            # Reproducible schema: tables, RLS, views, functions, recipe catalog, storage
│  ├─ tests/database.test.sql# RLS isolation + stock logic tests (run with npm run test:rls)
│  └─ config.toml            # Local Supabase CLI config
├─ src/
│  ├─ app/
│  │  ├─ (app)/              # Authenticated pages (overview, inventory, locations, expiring, low-stock,
│  │  │                      #   recipes, shopping, analytics, settings) + shared layout/loading/error
│  │  ├─ (auth)/             # login, signup, forgot-password, reset-password
│  │  ├─ api/sync, api/search# Offline sync endpoint and global search endpoint
│  │  ├─ auth/callback, auth/confirm, onboarding, invite/[token], offline
│  │  ├─ manifest.ts, layout.tsx, globals.css (design tokens)
│  ├─ components/            # ui/ (primitives), layout/, inventory/, locations/, recipes/, shopping/, …
│  ├─ lib/
│  │  ├─ domain/             # Pure business logic: units, quantity, expiry, stock, recipes, locations, shopping
│  │  ├─ offline/            # Durable mutation queue (IndexedDB) + sync logic
│  │  ├─ data/               # Server-side read queries (typed)
│  │  ├─ actions/            # Server Actions (validated + authorized mutations)
│  │  ├─ validation/         # Zod schemas
│  │  ├─ supabase/           # Server/browser/middleware Supabase clients
│  │  └─ types.ts, errors.ts, env.ts
│  └─ middleware.ts          # Session refresh + auth redirects
├─ public/sw.js, public/icons/   # Service worker and app icons
├─ tests/                    # Vitest unit tests
├─ e2e/                      # Playwright tests
└─ scripts/run-rls-tests.mjs
```

**Layering:** UI components → Server Actions / data queries → Postgres functions and RLS. Business rules (units, expiry, restock, recipe matching, offline queue) live in `src/lib/domain` and `src/lib/offline` as pure, tested TypeScript. Stock movements run inside Postgres functions, so each one is a single atomic transaction.

---

## Start from a fresh Windows computer

These steps assume Windows 10 or 11. No Mac is needed at any point.

### 1. Install the tools

1. **Node.js 22 LTS:** download the Windows installer from <https://nodejs.org> and keep the defaults. Then open **PowerShell** and check:
   ```powershell
   node -v   # v22.x (v20.9+ also works)
   npm -v
   ```
2. **Git:** install from <https://git-scm.com/download/win> with the defaults.
3. **A code editor:** Visual Studio Code is recommended (<https://code.visualstudio.com>).
4. **Docker Desktop (optional):** only needed if you want a local Supabase instance (<https://www.docker.com/products/docker-desktop>). You can skip it and use a free hosted Supabase project instead.

### 2. Get the code

Extract `homebase.zip` (for example to `C:\Projects\homebase`), then in PowerShell:

```powershell
cd C:\Projects\homebase
npm install
```

### 3. Put it on GitHub (optional, required for the Vercel Git workflow)

```powershell
git init
git add .
git commit -m "Initial commit of Homebase"
# Create an empty repository on github.com, then:
git branch -M main
git remote add origin https://github.com/<you>/homebase.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.next`, and `.env*.local`. Real keys never go into Git.

---

## Supabase setup and migrations

You can use **Option A (hosted, simplest)** or **Option B (local Docker)**.

### Option A: hosted Supabase project (recommended)

1. Create a free account at <https://supabase.com> and click **New project**. Choose a strong database password and the region nearest to you.
2. **Apply the database schema.** Run the migration files **in filename order**:
   - **Using the CLI (recommended):**
     ```powershell
     npx supabase login
     npx supabase link --project-ref <your-project-ref>   # from the project URL
     npx supabase db push                                 # applies supabase/migrations/*
     ```
   - **Or using the Dashboard:** open **SQL Editor** and paste and run each file from `supabase/migrations/` in order (`…000100_core_schema.sql`, `…000200_rls_and_views.sql`, `…000300_functions.sql`, `…000400_recipe_catalog.sql`, `…000500_search_indexes.sql`, `…000600_storage.sql`, and `…000700_function_privileges.sql`).
3. **Get your API keys** from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Do **not** use the `service_role` key anywhere in this app.
4. **Configure Auth URLs** in **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (change to your Vercel URL later)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`, and later `https://<your-app>.vercel.app/auth/callback`
5. **Email:** sign-up confirmation is on by default. Supabase's built-in email service is heavily rate-limited, so for real use configure SMTP under **Authentication → Emails → SMTP Settings**. For quick testing you can turn off **Confirm email** under **Authentication → Providers → Email**.

### Option B: local Supabase with Docker

```powershell
npx supabase start          # first run downloads Docker images
npx supabase status         # shows API URL, anon key, DB URL, Studio and email-inbox URLs
```

Migrations in `supabase/migrations` are applied automatically. Run `npx supabase db reset` to rebuild from scratch. Confirmation and reset emails appear in the local mail inbox shown by `supabase status`.

### Environment variables

Copy the example file and fill it in:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (safe in the browser; data is protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | yes | Base URL used for email redirects and invitation links |
| `SUPABASE_DB_URL` | tests only | Postgres connection string for `npm run test:rls` |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | tests only | A confirmed test account for authenticated Playwright tests |

---

## Authentication and Row Level Security

- **Auth:** Supabase email + password, with email confirmation and password reset (`/forgot-password` → email → `/auth/callback` → `/reset-password`). Sessions live in secure cookies managed by `@supabase/ssr`. `src/middleware.ts` refreshes them on every request and sends signed-out users to `/login?next=…`. The server always calls `auth.getUser()`, which validates the JWT, rather than trusting the cookie alone.
- **Households:** after signing up, users create a household on `/onboarding`. The `create_household()` function makes them **owner** and can optionally seed default categories and kitchen locations.
- **Roles:** `owner` manages settings and members, `editor` changes inventory, and `viewer` has read-only access. Any member can rate items.
- **Invitations:** owners create an invite in **Settings → Members**. The app shows a link to send yourself. Only a SHA-256 hash of the token is stored. Links expire after 7 days, work once, and only work for the invited email address (`accept_invitation()` checks the caller's verified JWT email).
- **RLS everywhere:** every table has RLS enabled. `anon` has no privileges. Policies call `has_household_role()` / `can_edit_household()`, so users only see and change rows of households they belong to. Read models (`product_stock`, `lot_details`, `location_stock`) are `security_invoker` views, so RLS applies through them too. Transactional functions are `SECURITY INVOKER` as well. The only `SECURITY DEFINER` functions are the membership helpers, `create_household`, `accept_invitation`, and the new-user profile trigger. All of them pin `search_path` and only act on behalf of `auth.uid()`.
- **Defense in depth:** server actions check membership and role before every write. They validate all input with Zod, and Postgres re-checks everything through RLS and triggers (for example, same-household references, unit compatibility, no circular locations, at least one owner).
- **Storage:** item photos go into a **private** bucket under `<household_id>/…`. Storage policies restrict access to members, and the app serves photos through short-lived signed URLs.
- **RLS tests:** `supabase/tests/database.test.sql` uses three users to prove that one household can't read or modify another's data. It also checks that viewers can't edit, anonymous users get nothing, invitations are email-bound and single-use, and the last owner can't leave. See [Testing](#testing).

---

## Run locally

```powershell
npm run dev
```

Open <http://localhost:3000>, create an account, confirm your email and set up your household. To explore quickly, go to **Settings → Sample data → Load sample kitchen**. This is entirely optional and never runs automatically.

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` / `npm start` | Production build and server (needed to test the service worker) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm test` | Vitest unit tests |
| `npm run test:rls` | Database/RLS test suite against `SUPABASE_DB_URL` |
| `npm run test:e2e` | Playwright tests (desktop Chrome, iPhone Safari and Android Chrome profiles) |
| `npm run check` | lint, then typecheck, then unit tests, then build |
| `npm run db:types` | Generate full Supabase TypeScript types from a local database (optional) |

---

## Deploy to Vercel

1. Push the repository to GitHub (see above).
2. At <https://vercel.com>, choose **Add New → Project** and import the repository. The framework preset (Next.js) is detected automatically.
3. Add **Environment Variables** for Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.vercel.app` (or your custom domain)
4. Click **Deploy**.
5. Back in Supabase, under **Authentication → URL Configuration**, set **Site URL** to your Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**. For preview deployments you can add a wildcard such as `https://*-<your-team>.vercel.app/auth/callback`.
6. Every push to `main` redeploys. Pull requests get preview URLs. The CI workflow in `.github/workflows/ci.yml` runs lint, typecheck, tests and build, and runs the database tests against a disposable local Supabase.

---

## Install as an app (PWA)

The service worker is only registered in production builds, so use your Vercel URL or run `npm run build && npm start`.

- **iPhone or iPad (Safari):** open the site, tap **Share**, then **Add to Home Screen**, then **Add**.
- **Android (Chrome):** open the site, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
- **Desktop (Chrome or Edge):** click the install icon in the address bar.

The app opens full-screen, respects notches and home indicators (safe areas), and supports light and dark themes.

---

## Testing

### Unit tests (Vitest)

```powershell
npm test
```

These cover quantity arithmetic and negative-quantity protection, unit conversions (mass, volume and count are never mixed), stock thresholds and restock suggestions, expiry classification (time zones, month and year boundaries, no-expiry items), recipe ingredient matching (quantities, units, expired and optional items), location hierarchy and cycle detection, shopping-list grouping and merging, the offline queue (persistence, retries, conflicts, auth errors, idempotency, crash recovery), the IndexedDB store (via `fake-indexeddb`), input validation, and database-error mapping.

### Database and RLS tests

You need a database with the migrations applied (local Supabase is easiest):

```powershell
npx supabase start
$env:SUPABASE_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run test:rls
```

The suite runs inside a transaction and rolls back afterwards. It covers:

- **Household isolation:** a second user can't read, update, delete, insert, search, or analyze another household's data, or reference its rows.
- **Roles and access:** viewers are read-only, anonymous users are denied, invitations work only for the invited email and only once, and the last owner can't leave.
- **Stock logic:** atomic stock functions, idempotent offline mutations, the no-negative-stock rule, optimistic version conflicts, unit conversion on merge, incompatible-unit rejection, partial moves, FIFO consumption, location-cycle rejection, append-only history, shopping merges and purchase-to-inventory, sample data, wildcard-safe search, and cascade deletion.

### End-to-end tests (Playwright)

```powershell
npx playwright install        # once, downloads browsers
npm run build
npm run test:e2e              # starts `npm start` automatically
```

- `e2e/public.spec.ts` needs no credentials. It checks auth redirects, inline validation, API 401s, the manifest and offline page, and that there's no horizontal scrolling on mobile.
- `e2e/inventory.spec.ts` needs `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for a confirmed account. It walks through adding an item, stepping quantities, the low-stock flag, adding to the shopping list, checking items off, search, and **offline → online sync** (using Playwright's offline mode). It cleans up after itself.

---

## How things work

### Data model

`households` → `household_members` (roles) · `household_invitations` · `categories` · `locations` (self-referencing tree) · `brands` · `products` (identity: name + brand, unique per household) · `stock_rules` (minimum and target per product) · `inventory_lots` (batches: location, quantity, unit, expiry, purchase date, version) · `inventory_transactions` (append-only audit log with an idempotency key) · `product_ratings` / `brand_ratings` · `shopping_lists` / `shopping_list_items` (with soft delete for restore) · `recipes` / `recipe_ingredients` (built-in catalog where `household_id IS NULL`) · `recipe_favorites` · `units` (reference data).

### Units

Base units are **g** (mass), **ml** (volume) and **pcs** (count; `dozen` = 12). Package units (pack, can, bottle, jar, box, bag, bunch, loaf) only convert to themselves. Mass and volume are never treated as interchangeable. A "cup" is 240 ml. Each batch keeps its own unit, which must be convertible to the product's default unit; this is enforced by a database trigger. Totals are converted into the product's unit.

### Stock and restock rule

- An item is **low** when its total is below its minimum, and **out** at zero.
- The **suggested restock** amount is `target − current` when a target is set. Otherwise it's `minimum × household multiplier − current`, where the multiplier defaults to 2 and can be changed in Settings. Count and package units round up to whole numbers.
- Every change goes through a Postgres function that locks the batch row (`SELECT … FOR UPDATE`) and writes a transaction. Quantities can't go negative: consuming more than you have is rejected, and "Correct count" is the deliberate way to set an exact value. Edits use optimistic versioning, so stale forms are rejected rather than silently overwriting someone else's change.

### Expiry

Dates are calendar dates compared in the **household's time zone**. "Expiring" means within the household's warning window (7 days by default), and "expired" means before today. Items without a date are never flagged.

### Recipe matching (deterministic)

An inventory item supplies an ingredient if its optional **Recipe ingredient** key matches exactly. If no key is set, every word of the ingredient name must appear in the item's name, after normalizing case and plurals. Only non-expired, non-empty batches count. Quantities are summed in compatible units.

Ingredients get one of these statuses: **available**, **staple** (a "to taste" item that's present), **insufficient** (with the shortfall), **unverified** (units can't be compared, so it's never claimed as available), or **missing**. A recipe is "Ready" only when every required ingredient is fully covered.

### Offline behavior (exactly what is supported)

| Works offline | Needs a connection |
|---|---|
| Opening pages you've visited before (cached copies, labeled with an offline banner) | Pages you've never opened (you'll see the offline page) |
| **+/− quantity steppers**, "Used it" / "Discard" on batches | Adding or editing items, locations, categories |
| **Checking / unchecking shopping-list items** | Adding, editing or removing list items; "Finish shopping" |
| | Search, analytics refresh, settings, sign-in |

Offline changes go into an **IndexedDB queue** on the device, so they survive reloads and app restarts. They're shown as **"Pending sync"**, and a header indicator shows offline, syncing and failed counts. When the device reconnects, the app also retries on focus and every 20 seconds while anything is pending. Changes are sent to `/api/sync`.

- Each change has a UUID that Postgres stores as an idempotency key, so a retry can never be applied twice.
- **Conflicts**, such as consuming more than remains because someone else used it, or a batch that was deleted, are marked **failed** and kept visible in **Sync status** with Retry and Discard. Nothing is dropped silently.
- If you sign out while changes are still pending, the app asks you to confirm before discarding them. Signing out also clears cached pages from the device.

---

## Verification status of this package

This package was built in a sandbox **without access to the npm registry**, so `npm install` and anything that depends on it could not be run there. Here is what was and wasn't verified:

| Check | Status |
|---|---|
| SQL migrations applied to **real PostgreSQL 16** (with a minimal stand-in for Supabase's `auth` schema and roles) | ✅ Ran clean |
| `supabase/tests/database.test.sql` (RLS isolation, roles, invitations, stock logic) against that database | ✅ **All passed** |
| Unit tests for domain logic, offline queue, error mapping and formatting (72 tests), run with Node's built-in test runner through a Vitest-compatible shim | ✅ **All passed** |
| `tsc --strict` over **all** application code, with local type stubs standing in for the uninstalled third-party packages | ✅ No errors in project code. Validation-schema call sites typed by `zod` could only be checked loosely. |
| `tests/validation.test.ts` (needs `zod`) and `tests/offline-idb.test.ts` (needs `fake-indexeddb`) | ⚠️ Written, **not run** |
| `npm run lint`, `npm run build`, Playwright E2E | ⚠️ **Not run** (packages unavailable) |
| Migration `…000500` (`pg_trgm`) and `…000600` (Supabase Storage bucket and policies) | ⚠️ Not run locally (they need Supabase's extension/storage schemas). They use standard Supabase syntax. |
| Behavior against a live Supabase project (Auth emails, Storage uploads, PostgREST embedding) | ⚠️ **Not verified** |

**First thing to do after extracting:** run `npm install && npm run check` (lint → typecheck → unit tests → build), then `npm run test:rls` against local Supabase. This archive does not include `package-lock.json` because the build environment could not reach the npm registry. After running `npm install` on a machine with registry access, commit the generated `package-lock.json`; then change CI to `npm ci` and enable npm caching for reproducible installs. If a dependency release has changed an API, fix it then. Versions are pinned to stable ranges (Next 15.5, React 19.1, Tailwind 4.1, supabase-js 2.x).

---

## Known limitations

- **Offline scope:** only quantity changes and shopping check-offs are queued offline. Creating or editing items needs a connection; the form keeps your input and tells you so. Pages you've never visited aren't available offline. Search doesn't work offline.
- **Cached pages are snapshots.** While offline you may see older data, and the banner says so.
- **Recipe matching uses words, not AI.** A product called "Coconut Milk" with no ingredient key will match a "milk" ingredient. Set **Recipe ingredient** on the item to control matching precisely.
- **No mass ↔ volume conversion,** by design. A recipe that measures flour in cups won't count flour stored in grams. Those ingredients are shown as "Can't compare units" instead of being claimed as available.
- **Trends:** there are no daily stock snapshots yet, so analytics show current low-stock counts rather than history. Activity and spending use the real transaction log.
- **Invitations** produce a link for you to send; Homebase doesn't send email itself.
- **Time zones:** each household has one time zone, used for "today" in expiry calculations.
- **Push notifications** for expiring items aren't implemented. Expiry alerts appear in the app.
- **Photos** are stored as uploaded (up to 5 MB), without server-side resizing.

## Future improvements

- **AI layer (v2):** the architecture keeps business logic in `src/lib/domain` and data access in `src/lib/data` and `src/lib/actions`. AI features can be added as separate server actions that call these same functions, for example natural-language search, receipt or photo scanning to pre-fill the item form, or smarter ingredient matching. None of these would replace the deterministic core.
- Barcode scanning (the `products.barcode` column can be added), receipt import and price history.
- Daily stock snapshots for real trend charts, plus consumption-rate forecasting.
- Background Sync API and a wider set of offline mutations (create and edit) with conflict resolution.
- Web push reminders for expiring items.
- Household recipe authoring and meal planning.
- Areas beyond the kitchen (cleaning supplies, medicine cabinet, garage), which the location model already supports.
