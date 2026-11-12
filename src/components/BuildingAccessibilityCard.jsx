'use client';

/**
 * BuildingAccessibilityCard
 * Displays a table of ramp / lift / stair counts for one campus building.
 *
 * `building` prop shape — matches the camelCase keys returned by GET /api/buildings:
 *   { id, campusKey, name, latitude, longitude,
 *     rampsTotal, rampsWorking, liftsTotal, liftsWorking, stairsTotal, stairsWorking }
 *
 * Matches the visual style of RouteFinderCard (bg-white, border-slate-200, rounded-lg, p-5).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the three feature rows from the building object.
 * Stairs use "open"/"closed" vocabulary; ramps and lifts use "working"/"not working".
 * Rows whose count fields are null/undefined are filtered out so that an
 * incomplete API response (e.g. before the DB migration has run) produces
 * an empty array, which the component treats as "no data yet".
 */
function getFeatures(building) {
  const rows = [
    {
      emoji:          '♿',
      label:          'Ramp',
      total:          building.rampsTotal,
      working:        building.rampsWorking,
      workingWord:    'working',
      notWorkingWord: 'not working',
    },
    {
      emoji:          '🛗',
      label:          'Lift',
      total:          building.liftsTotal,
      working:        building.liftsWorking,
      workingWord:    'working',
      notWorkingWord: 'not working',
    },
    {
      emoji:          '🪜',
      label:          'Stairs',
      total:          building.stairsTotal,
      working:        building.stairsWorking,
      workingWord:    'open',
      notWorkingWord: 'closed',
    },
  ];
  // Keep only rows where both count fields are present (not null / undefined).
  return rows.filter((r) => r.total != null && r.working != null);
}

/**
 * Produces the aria-label string for a table row so screen readers
 * announce the complete sentence in one pass, e.g.:
 *   "Lift: 3 total, 2 working, 1 not working"
 *   "Stairs: 2 total, 2 open, 0 closed"
 *   "Ramp: none in this building"
 */
function rowAriaLabel({ label, total, working, workingWord, notWorkingWord }) {
  if (total === 0) return `${label}: none in this building`;
  const notWorking = total - working;
  return `${label}: ${total} total, ${working} ${workingWord}, ${notWorking} ${notWorkingWord}`;
}

// ---------------------------------------------------------------------------
// StatusCell — third column; colour is never the only signal
// ---------------------------------------------------------------------------

/**
 * Colour + text rules:
 *   total = 0            → grey  "None in this building"  (no red / green)
 *   working = total > 0  → green "🟢 {n} working/open" only
 *   working = 0, total>0 → red bold both lines            (worst case)
 *   mixed                → green line + red line
 */
function StatusCell({ total, working, workingWord, notWorkingWord }) {
  const notWorking = total - working;

  if (total === 0) {
    return (
      <td className="px-3 py-2 text-slate-400 text-[11px] italic" aria-hidden="true">
        None in this building
      </td>
    );
  }

  if (notWorking === 0) {
    // Everything working — green line only
    return (
      <td className="px-3 py-2" aria-hidden="true">
        <span className="text-[11px] text-green-700">
          🟢 {working} {workingWord}
        </span>
      </td>
    );
  }

  if (working === 0) {
    // Nothing working — both lines red + bold
    return (
      <td className="px-3 py-2 space-y-0.5" aria-hidden="true">
        <div className="text-[11px] font-bold text-red-700">🔴 0 {workingWord}</div>
        <div className="text-[11px] font-bold text-red-700">
          🔴 {notWorking} {notWorkingWord}
        </div>
      </td>
    );
  }

  // Mixed — green working count + red not-working count
  return (
    <td className="px-3 py-2 space-y-0.5" aria-hidden="true">
      <div className="text-[11px] text-green-700">🟢 {working} {workingWord}</div>
      <div className="text-[11px] text-red-700">🔴 {notWorking} {notWorkingWord}</div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function BuildingAccessibilityCard({ building }) {
  // Placeholder — no building selected yet
  if (!building) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center min-h-[120px] text-center">
        <span aria-hidden="true" className="text-3xl mb-2">🏫</span>
        <p className="text-xs text-slate-400 leading-snug">
          Please select a building to view accessibility status.
        </p>
      </div>
    );
  }

  const features = getFeatures(building);

  // Guard: building exists but has no accessibility data (empty or missing features).
  if (features.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center min-h-[120px] text-center">
        <span aria-hidden="true" className="text-2xl mb-2">📋</span>
        <p className="text-xs text-slate-500 font-medium">{building.name}</p>
        <p className="text-xs text-slate-400 mt-1 leading-snug">
          No accessibility data yet for this building.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">

      {/* Card header */}
      <h3 className="font-semibold text-slate-800 text-sm mb-0.5">{building.name}</h3>
      <p className="text-xs text-slate-500 mb-3">Current accessibility status</p>

      {/* Accessibility table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                Feature
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700 text-right">
                Quantity
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700">
                Working&nbsp;/ Not working
              </th>
            </tr>
          </thead>

          <tbody>
            {features.map((f) => (
              <tr
                key={f.label}
                aria-label={rowAriaLabel(f)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
              >
                {/* Feature — emoji is decorative; row aria-label carries full meaning */}
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  <span aria-hidden="true" className="mr-1.5 text-base leading-none">
                    {f.emoji}
                  </span>
                  {f.label}
                </td>

                {/* Quantity — total count */}
                <td className="px-3 py-2 text-slate-700 font-mono text-right" aria-hidden="true">
                  {f.total}
                </td>

                {/* Status — colour + text, aria-hidden because the row label covers it */}
                <StatusCell
                  total={f.total}
                  working={f.working}
                  workingWord={f.workingWord}
                  notWorkingWord={f.notWorkingWord}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
