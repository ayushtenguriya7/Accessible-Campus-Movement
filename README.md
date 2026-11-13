This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database setup (Neon)

```bash
cp .env.example .env.local
# paste the DATABASE_URL the team lead sent you
npm install
npm run dev
```

Never commit .env.local.

If you are initializing a fresh database, run the SQL scripts in order:
```bash
psql "$DATABASE_URL" -f db/users.sql
psql "$DATABASE_URL" -f db/buildings.sql
psql "$DATABASE_URL" -f db/tickets.sql
```

## Test Accounts (For Development & Testing)

These accounts are seeded in `db/users.sql` and supported by offline mock auth fallbacks if PostgreSQL is unreachable:

| Role | Registration No | Password | Accepted Fallback | Purpose & Primary Destination |
|---|---|---|---|---|
| **Student** | `11111111` | `student123` | `11111111` | Campus navigation, route planning, obstacle reporting (`/dashboard`) |
| **Estate Staff** | `22222222` | `staff123` | `22222222` | Ticket tracking, search/filters, resolution workflow (`/dashboard/estate`) |

---

## Role-Based Routing & Access Control

Route protection is managed by `src/middleware.js` with matcher `['/', '/dashboard/:path*']` using JWT verification (`HS256`). Non-staff users requesting staff endpoints also receive a server-side `403 Forbidden` from `/api/tickets`.

### Role-Redirect Table

| User State / Role | Requested Path | Action / Redirect Target | Notes |
|---|---|---|---|
| **Unauthenticated / Expired** | `/` | Allow (Login page) | Public access |
| **Unauthenticated / Expired** | `/dashboard/:path*` | Redirect to `/` | Deletes expired `user_token` cookie |
| **Student** (`student`) | `/` | Redirect to `/dashboard` | Direct to Student Dashboard |
| **Student** (`student`) | `/dashboard` | Allow | Student Campus Navigation & Reporting |
| **Student** (`student`) | `/dashboard/estate/:path*` | Redirect to `/dashboard` | Guarded against student access |
| **Estate Staff** (`estate_staff`) | `/` | Redirect to `/dashboard/estate` | Direct to Resolution Dashboard |
| **Estate Staff** (`estate_staff`) | `/dashboard` | Redirect to `/dashboard/estate` | Auto-routes staff to tickets portal |
| **Estate Staff** (`estate_staff`) | `/dashboard/estate` | Allow | Estate Resolution Dashboard |

---

## The Two Dashboards: Who Sees What

The platform provides strictly separated dashboard experiences for students and estate maintenance staff:

### 1. Student Dashboard (`/dashboard`)
- **Target Role**: `student`
- **Header**: Shared `DashboardHeader` with UNS branding, student registration number, `Student` badge, and Sign Out.
- **Title**: *Campus Route & Barrier Dashboard*
- **Main Features**:
  - **Campus Leaflet Map (`CampusMap`)**: Interactive map displaying campus buildings, markers, and accessible paths.
  - **Find Accessible Route (`RouteFinderCard`)**: Accessible navigation planner between source and destination buildings avoiding reported obstacles.
  - **Building Accessibility Status (`BuildingAccessibilityCard`)**: Live counts of working vs. total lifts, ramps, and stairs for any selected building.
  - **Report Issue Modal**: Accessible dialog (`role="dialog"`, `aria-modal="true"`) to log broken facilities, decrementing live working counts immediately.
- **Excluded**: No estate maintenance links, no tickets table, no resolution controls.

### 2. Estate Resolution Dashboard (`/dashboard/estate`)
- **Target Role**: `estate_staff`
- **Header**: Shared `DashboardHeader` with UNS branding, staff registration number, `Estate Staff` badge, and Sign Out.
- **Title**: *Estate Resolution Dashboard* ("Review, search and resolve accessibility issues reported on campus.")
- **Main Features**:
  - **Summary Cards**: Three top-level metrics displaying campus-wide counts (Total Tickets, Pending, Resolved), unaffected by active search filters.
  - **Search & Filters**: Debounced (300ms) building search input (`type="search"`) with clear button and status filter tabs (`All`, `Pending`, `Resolved`) with dynamic count badges.
  - **In-flight Abort**: Aborts stale search requests using `AbortController` to guarantee UI consistency.
  - **Tickets Table**: Real HTML `<table>` with ID, Building, Issue icon, Description, Reporter, Date, Status badge, and Action.
  - **Resolution Workflow**: Inline two-step confirmation ("Mark resolved" → "Are you sure? Yes / Cancel") invoking `PATCH /api/tickets/:id`, restoring building counts and updating both the table and summary cards.
- **Excluded**: No campus map, no route finder, no building accessibility card.

---

## API Routes

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/auth/login` | `POST` | Public | Authenticates credentials against bcrypt hash in Neon DB (with offline fallback) and sets HTTP-only JWT cookie. |
| `/api/auth/logout` | `POST` | Public | Clears the session cookie. |
| `/api/auth/me` | `GET` | Public / Session | Reads session cookie and returns current user payload (`id, registrationNo, role, name`). |
| `/api/buildings` | `GET` | Authenticated | Lists all campus buildings with ramp, lift, and stairs total and working counts. |
| `/api/tickets` | `POST` | Authenticated (`student`, `estate_staff`) | Submits a barrier report. In a single transaction, decrements the working count in `buildings` and inserts a `Pending` ticket. |
| `/api/tickets` | `GET` | `estate_staff` only | Returns barrier tickets joined with building details, supporting building search, status filtering, and aggregate counts. Non-staff receives 403. |
| `/api/tickets/[id]` | `PATCH` | `estate_staff` only | In a single transaction, marks a ticket as `Resolved` and restores the corresponding working count in `buildings` (capped at total). Non-staff receives 403. |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
