'use client';

import { useState, useRef } from 'react';
import LiftReportDialog from './LiftReportDialog';

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
function StatusCell({ total, working, workingWord, notWorkingWord, action = null }) {
  const notWorking = total - working;

  let content;
  if (total === 0) {
    content = (
      <span className="text-slate-400 text-[11px] italic">
        None in this building
      </span>
    );
  } else if (notWorking === 0) {
    // Everything working — green line only
    content = (
      <span className="text-[11px] text-green-700">
        🟢 {working} {workingWord}
      </span>
    );
  } else if (working === 0) {
    // Nothing working — both lines red + bold
    content = (
      <div className="space-y-0.5">
        <div className="text-[11px] font-bold text-red-700">🔴 0 {workingWord}</div>
        <div className="text-[11px] font-bold text-red-700">
          🔴 {notWorking} {notWorkingWord}
        </div>
      </div>
    );
  } else {
    // Mixed — green working count + red not-working count
    content = (
      <div className="space-y-0.5">
        <div className="text-[11px] text-green-700">🟢 {working} {workingWord}</div>
        <div className="text-[11px] text-red-700">🔴 {notWorking} {notWorkingWord}</div>
      </div>
    );
  }

  return (
    <td className="px-3 py-2 space-y-1">
      <div aria-hidden="true">{content}</div>
      {action}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function BuildingAccessibilityCard({
  building,
  onReported = undefined,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const triggerButtonRef = useRef(null);

  const feedbackMessage =
    feedback?.buildingId === building?.id ? feedback.message : '';

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    triggerButtonRef.current?.focus();
  };

  const handleReportSuccess = (updatedBuilding) => {
    setIsDialogOpen(false);
    setFeedback({
      buildingId: updatedBuilding?.id || building?.id,
      message: 'Thanks, your lift report was sent',
    });
    triggerButtonRef.current?.focus();
    if (typeof onReported === 'function') {
      onReported(updatedBuilding);
    }
  };

  const renderLiftButton = () => {
    const liftsTotal = building?.liftsTotal ?? building?.lifts_total ?? 0;
    const liftsWorking = building?.liftsWorking ?? building?.lifts_working ?? 0;

    if (liftsTotal === 0) {
      return (
        <button
          ref={triggerButtonRef}
          type="button"
          disabled
          className="text-[11px] text-slate-400 cursor-not-allowed block mt-1"
        >
          No lift in this building
        </button>
      );
    }

    if (liftsWorking === 0) {
      return (
        <button
          ref={triggerButtonRef}
          type="button"
          disabled
          className="text-[11px] text-slate-400 cursor-not-allowed block mt-1"
        >
          All lifts already reported
        </button>
      );
    }

    return (
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => {
          setFeedback(null);
          setIsDialogOpen(true);
        }}
        className="text-[11px] font-medium text-orange-600 hover:text-orange-700 underline underline-offset-2 block mt-1 cursor-pointer"
      >
        Report lift issue
      </button>
    );
  };

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

      {/* Success feedback */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer"
            aria-label="Dismiss message"
          >
            &times;
          </button>
        </div>
      )}

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
                  action={f.label === 'Lift' ? renderLiftButton() : null}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal dialog for reporting lift issues */}
      <LiftReportDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        building={building}
        onSuccess={handleReportSuccess}
      />
    </div>
  );
}
