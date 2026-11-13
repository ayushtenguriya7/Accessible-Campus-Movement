# Editing Building Accessibility Data

This guide explains how to view, update, and add accessibility facility counts (ramps, lifts, and stairs) across the campus.

---

## 1. Where the Data Lives & Row Structure

The canonical dataset and database schema live in [`db/buildings.sql`](file:///Users/ananyayashbhatnagar/Developer/SEM5/NextJS_Lpu/Project/Accessible-Campus-Movement/db/buildings.sql).

Each row inserted into the `buildings` table follows this column order:

```sql
(campus_key, name, latitude, longitude, ramps_total, ramps_working, lifts_total, lifts_working, stairs_total, stairs_working)
```

| Column | Type | Description |
|---|---|---|
| `campus_key` | `TEXT` | Unique ID matching the building entry in `src/data/campusBuildings.js` (e.g. `'sample-1'`) |
| `name` | `VARCHAR(100)` | Unique building name displayed across the system |
| `latitude` | `DOUBLE PRECISION` | WGS84 entrance latitude coordinate |
| `longitude` | `DOUBLE PRECISION` | WGS84 entrance longitude coordinate |
| `ramps_total` | `INTEGER` | Total number of entrance ramps |
| `ramps_working` | `INTEGER` | Number of accessible / open ramps |
| `lifts_total` | `INTEGER` | Total number of elevators / lifts |
| `lifts_working` | `INTEGER` | Number of functional / working elevators |
| `stairs_total` | `INTEGER` | Total number of staircases |
| `stairs_working` | `INTEGER` | Number of open / unobstructed staircases |

---

## 2. How to Update Facility Numbers

1. Open [`db/buildings.sql`](file:///Users/ananyayashbhatnagar/Developer/SEM5/NextJS_Lpu/Project/Accessible-Campus-Movement/db/buildings.sql).
2. Locate the building entry under the `INSERT INTO buildings ... VALUES` list.
3. Edit the desired count numbers.
   > **Constraint Rule**: Every `*_working` count must be **greater than or equal to 0** and **must never exceed its corresponding `*_total`** (enforced by `chk_ramps_counts`, `chk_lifts_counts`, and `chk_stairs_counts` in the database).
4. Save the file.
5. Apply the changes by running the script against your PostgreSQL database:

   ```bash
   psql "$DATABASE_URL" -f db/buildings.sql
   ```
   *Or with explicit connection flags:*
   ```bash
   psql -h localhost -p 5432 -U postgres -d postgres -f db/buildings.sql
   ```
6. Hard refresh the dashboard in your browser (`Cmd + Shift + R` on macOS or `Ctrl + F5` on Windows/Linux) to see the updated figures immediately.

---

## 3. Quick One-Off Updates & Warning

For immediate troubleshooting or temporary updates directly in `psql`, run an `UPDATE` statement:

```sql
UPDATE buildings SET lifts_total = 4, lifts_working = 3 WHERE name = 'Block 25';
```

> **Warning:** `db/buildings.sql` uses `ON CONFLICT (name) DO UPDATE SET`. If you run manual SQL updates without also updating `db/buildings.sql`, the next time `db/buildings.sql` is executed it **will overwrite your manual changes** with whatever values are hardcoded in the SQL file. Always record permanent adjustments in `db/buildings.sql`.

---

## 4. How to Add a New Building

To introduce a new campus building to both the map routing and the accessibility card:

1. **Add the building to frontend data**:
   Open [`src/data/campusBuildings.js`](file:///Users/ananyayashbhatnagar/Developer/SEM5/NextJS_Lpu/Project/Accessible-Campus-Movement/src/data/campusBuildings.js) and append an object to `CAMPUS_BUILDINGS`:
   ```javascript
   {
     id: "sample-35", // Unique stable string
     number: "60",
     name: "New Research Complex",
     lat: 31.25350,
     lng: 75.70420,
     verified: true,
   }
   ```

2. **Add the building row to database seeds**:
   Open [`db/buildings.sql`](file:///Users/ananyayashbhatnagar/Developer/SEM5/NextJS_Lpu/Project/Accessible-Campus-Movement/db/buildings.sql) and add a matching row using the **exact same `campus_key`** as the `id` from step 1:
   ```sql
   ('sample-35', 'New Research Complex', 31.25350, 75.70420, 2, 2, 3, 3, 2, 2)
   ```

3. **Run the script**:
   ```bash
   psql "$DATABASE_URL" -f db/buildings.sql
   ```

---

## 5. Sample Data Notice

- The first five buildings in `db/buildings.sql` (**Uni Mall**, **Block 32**, **Block 34**, **Central Library**, and **Block 27**) use specific, verified survey values.
- **All other buildings currently use sample data.** Once physical accessibility audits are performed on campus, replace those placeholder counts with real survey numbers in `db/buildings.sql`.

---

## 6. Useful Query: View a Building's Current Counts

To inspect the current accessibility status of a building in PostgreSQL:

```sql
SELECT
    name,
    campus_key,
    ramps_total,
    ramps_working,
    lifts_total,
    lifts_working,
    stairs_total,
    stairs_working
FROM buildings
WHERE name = 'Block 34';
```

Or query by `campus_key`:

```sql
SELECT name, ramps_total, ramps_working, lifts_total, lifts_working, stairs_total, stairs_working
FROM buildings
WHERE campus_key = 'sample-4';
```

---

## 7. Tickets & Dynamic Facility Status

Student obstacle reports and estate maintenance work dynamically adjust facility working counts in the database.

### How Reporting Changes Building Counts
- When a user submits an obstacle report via `POST /api/tickets`, a database transaction:
  1. Lowers the matching column (`ramps_working`, `lifts_working`, or `stairs_working`) in the `buildings` table by `1` (only if the count is currently `> 0`).
  2. Inserts a new record in `tickets` with `status = 'Pending'` and `reported_by = user.registrationNo`.
  3. Returns `409 Conflict` if all units are already reported as broken or if the user already filed a pending report for that feature.

### How Resolving Restores Facility Counts
- When an estate staff member resolves an issue via `PATCH /api/tickets/[id]`:
  1. Sets ticket `status = 'Resolved'`, `resolved_at = now()`, and `resolved_by = staff.registrationNo`.
  2. Restores one working unit to the building, capped at its total using SQL `LEAST`:
     ```sql
     UPDATE buildings
     SET lifts_working = LEAST(lifts_total, lifts_working + 1)
     WHERE id = $1;
     ```

### Database Script Run Order
When creating or re-initializing the database schema, run scripts in this exact sequence:

1. `db/users.sql` — Creates `users` table and development test accounts.
2. `db/buildings.sql` — Creates `buildings` table and seeds facility counts.
3. `db/tickets.sql` — Creates `tickets` table (references `buildings.id`), indexes, and sample reports.

```bash
psql "$DATABASE_URL" -f db/users.sql
psql "$DATABASE_URL" -f db/buildings.sql
psql "$DATABASE_URL" -f db/tickets.sql
```

### Useful SQL Queries

#### List tickets by status
```sql
-- All pending tickets with building names
SELECT t.id, b.name AS building, t.feature_type, t.description, t.reported_by, t.created_at
FROM tickets t
JOIN buildings b ON b.id = t.building_id
WHERE t.status = 'Pending'
ORDER BY t.created_at DESC;

-- All resolved tickets with resolution details
SELECT t.id, b.name AS building, t.feature_type, t.resolved_by, t.resolved_at
FROM tickets t
JOIN buildings b ON b.id = t.building_id
WHERE t.status = 'Resolved'
ORDER BY t.resolved_at DESC;

-- Total ticket counts grouped by status
SELECT status, COUNT(*) AS count
FROM tickets
GROUP BY status;
```

#### Fix a count by hand if a test left it wrong
If test API calls or interrupted transactions leave a facility count mismatched in PostgreSQL, adjust it directly with an `UPDATE`:

```sql
-- Manually reset working counts for a specific building:
UPDATE buildings
SET lifts_working = 1, ramps_working = 1, stairs_working = 2
WHERE name = 'Block 34';

-- Or automatically recalculate working counts from total minus active pending tickets:
UPDATE buildings b
SET
  ramps_working = b.ramps_total - (
    SELECT COUNT(*) FROM tickets t
    WHERE t.building_id = b.id AND t.feature_type = 'Ramp' AND t.status = 'Pending'
  ),
  lifts_working = b.lifts_total - (
    SELECT COUNT(*) FROM tickets t
    WHERE t.building_id = b.id AND t.feature_type = 'Lift' AND t.status = 'Pending'
  ),
  stairs_working = b.stairs_total - (
    SELECT COUNT(*) FROM tickets t
    WHERE t.building_id = b.id AND t.feature_type = 'Stairs' AND t.status = 'Pending'
  )
WHERE b.name = 'Block 34';
```

---

## 8. Role-Based Dashboards & Access Routing

The platform enforces strict separation between student accessibility navigation and estate maintenance operations:

### Test Accounts (Development & Seeded Users)

| Role | Registration No | Password | Accepted Fallback | Purpose & Primary Destination |
|---|---|---|---|---|
| **Student** | `11111111` | `student123` | `11111111` | Campus navigation, route planning, obstacle reporting (`/dashboard`) |
| **Estate Staff** | `22222222` | `staff123` | `22222222` | Ticket tracking, search/filters, resolution workflow (`/dashboard/estate`) |

### Who Sees What: The Two Dashboards

1. **Student Dashboard (`/dashboard`)**:
   - **Accessible To**: `student` role only.
   - **Features**: Interactive Leaflet campus map, accessible route planner (`RouteFinderCard`), building accessibility status table (`BuildingAccessibilityCard`), and modal dialog to report broken lifts, blocked ramps, or closed stairs.
   - **Exclusions**: No estate tickets table, no resolution controls, no link to staff areas.

2. **Estate Resolution Dashboard (`/dashboard/estate`)**:
   - **Accessible To**: `estate_staff` role only.
   - **Features**: Three top summary cards (Total Tickets, Pending, Resolved) showing global numbers unaffected by search; building name search bar (300ms debounce, abort in-flight); status filter buttons (`All`, `Pending`, `Resolved`) with dynamic badges; full tickets table; and inline two-step confirmation to resolve tickets and restore building facility counts.
   - **Exclusions**: No campus map, no route finder, no building accessibility card.

### Role-Redirect Matrix (`src/middleware.js`)

| User State / Role | Requested Path | Action / Redirect Target | Notes |
|---|---|---|---|
| **Unauthenticated / Expired** | `/` | Allow (Login page) | Public access |
| **Unauthenticated / Expired** | `/dashboard/:path*` | Redirect to `/` | Deletes expired cookie |
| **Student** (`student`) | `/` | Redirect to `/dashboard` | Direct to student portal |
| **Student** (`student`) | `/dashboard` | Allow | Student Campus Navigation & Reporting |
| **Student** (`student`) | `/dashboard/estate/:path*` | Redirect to `/dashboard` | Guarded against student access |
| **Estate Staff** (`estate_staff`) | `/` | Redirect to `/dashboard/estate` | Direct to staff resolution portal |
| **Estate Staff** (`estate_staff`) | `/dashboard` | Redirect to `/dashboard/estate` | Auto-routed to staff portal |
| **Estate Staff** (`estate_staff`) | `/dashboard/estate` | Allow | Estate Resolution Dashboard |


