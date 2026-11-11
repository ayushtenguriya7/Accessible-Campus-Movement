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

