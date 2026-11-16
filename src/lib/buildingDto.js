/**
 * Mirrors GET /api/buildings; keep in sync.
 *
 * Provides a canonical DTO mapper for database rows from the `buildings` table,
 * as well as a single-building database retrieval helper.
 */

/**
 * Transforms a database row from the `buildings` table into a standardized building DTO object.
 *
 * @param {object} row - Raw database row from the buildings table
 * @returns {object|null} Standardized building DTO object, or null if row is missing
 */
export function toBuildingDto(row) {
  if (!row) return null;

  const rampsTotal = row.ramps_total ?? row.rampsTotal ?? 0;
  const rampsWorking = row.ramps_working ?? row.rampsWorking ?? 0;
  const liftsTotal = row.lifts_total ?? row.liftsTotal ?? 0;
  const liftsWorking = row.lifts_working ?? row.liftsWorking ?? 0;
  const stairsTotal = row.stairs_total ?? row.stairsTotal ?? 0;
  const stairsWorking = row.stairs_working ?? row.stairsWorking ?? 0;

  const features = Array.isArray(row.features)
    ? row.features
    : [
        {
          type: 'Ramp',
          total: rampsTotal,
          working: rampsWorking,
          notWorking: Math.max(0, rampsTotal - rampsWorking),
        },
        {
          type: 'Lift',
          total: liftsTotal,
          working: liftsWorking,
          notWorking: Math.max(0, liftsTotal - liftsWorking),
        },
        {
          type: 'Stairs',
          total: stairsTotal,
          working: stairsWorking,
          notWorking: Math.max(0, stairsTotal - stairsWorking),
        },
      ];

  return {
    id: row.id,
    campusKey: row.campus_key ?? row.campusKey ?? null,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    rampsTotal,
    rampsWorking,
    liftsTotal,
    liftsWorking,
    stairsTotal,
    stairsWorking,
    features,
  };
}

/**
 * Fetches a single building by ID using the same column set as GET /api/buildings.
 *
 * @param {object} client - Database client (e.g. pg PoolClient or pool)
 * @param {number|string} id - Building database ID
 * @returns {Promise<object|null>} The mapped building DTO object or null if not found
 */
export async function getBuildingById(client, id) {
  const queryText = `
    SELECT id, campus_key, name, latitude, longitude,
           ramps_total, ramps_working,
           lifts_total, lifts_working,
           stairs_total, stairs_working
    FROM buildings
    WHERE id = $1
  `;

  const result = await client.query(queryText, [id]);
  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return toBuildingDto(result.rows[0]);
}

