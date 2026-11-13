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

## Test Accounts (For Development Only)

These test accounts correspond to the seeds in `db/users.sql` for local development. Both accounts also work offline if PostgreSQL is temporarily unreachable:

| Role | Registration No | Password | Accepted Fallback | Purpose |
|---|---|---|---|---|
| Student | `11111111` | `student123` | `11111111` | Route planning, viewing accessibility, reporting issues |
| Estate Staff | `22222222` | `staff123` | `22222222` | Estate tickets dashboard, resolving obstacle reports |

## Application Pages

- **`/` (Login Page)**: Role-based authentication using registration number and password. Redirects authenticated users directly to `/dashboard`.
- **`/dashboard` (Campus Route & Barrier Dashboard)**: Interactive campus map, accessible route planning, building accessibility facility counts table, modal dialog to report broken features, and a header link to Estate Tickets for staff users.
- **`/dashboard/estate` (Estate Staff Portal)**: Role-guarded management portal for `estate_staff`. Features building name search (with 300ms debounce and in-flight request cancellation), status filter tabs (`All`, `Pending`, `Resolved`) with dynamic count badges, and an inline two-step confirmation to resolve tickets and restore facility counts.

## API Routes

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/auth/login` | `POST` | Public | Authenticates credentials, verifies password against bcrypt hash, and sets HTTP-only JWT cookie. |
| `/api/auth/logout` | `POST` | Public | Clears the session cookie. |
| `/api/auth/me` | `GET` | Public / Session | Reads session cookie and returns current user payload (`id, registrationNo, role, name`). |
| `/api/buildings` | `GET` | Authenticated | Lists all buildings with ramp, lift, and stairs total and working counts. |
| `/api/tickets` | `POST` | Authenticated (`student`, `estate_staff`) | Submits a barrier report. In a single transaction, decrements the working count in `buildings` and inserts a `Pending` ticket. |
| `/api/tickets` | `GET` | `estate_staff` only | Returns barrier tickets joined with building details, supporting building search, status filtering, and aggregate counts. |
| `/api/tickets/[id]` | `PATCH` | `estate_staff` only | In a single transaction, marks a ticket as `Resolved` and restores the corresponding working count in `buildings` (capped at total). |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
