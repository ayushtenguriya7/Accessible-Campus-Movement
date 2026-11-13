'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * BuildingAccessibilityCard
 * Displays a table of ramp / lift / stair counts for one campus building
 * and allows users to report broken accessibility features via a modal dialog.
 *
 * `building` prop shape — matches the camelCase keys returned by GET /api/buildings:
 *   { id, campusKey, name, latitude, longitude,
 *     rampsTotal, rampsWorking, liftsTotal, liftsWorking, stairsTotal, stairsWorking }
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the three feature rows from the building object.
 * Stairs use "open"/"closed" vocabulary; ramps and lifts use "working"/"not working".
 */
function getFeatures(building) {
  const rows = [
    {
      emoji:          '♿',
      label:          'Ramp',
      total:          building.rampsTotal ?? building.ramps_total,
      working:        building.rampsWorking ?? building.ramps_working,
      workingWord:    'working',
      notWorkingWord: 'not working',
    },
    {
      emoji:          '🛗',
      label:          'Lift',
      total:          building.liftsTotal ?? building.lifts_total,
      working:        building.liftsWorking ?? building.lifts_working,
      workingWord:    'working',
      notWorkingWord: 'not working',
    },
    {
      emoji:          '🪜',
      label:          'Stairs',
      total:          building.stairsTotal ?? building.stairs_total,
      working:        building.stairsWorking ?? building.stairs_working,
      workingWord:    'open',
      notWorkingWord: 'closed',
    },
  ];
  return rows.filter((r) => r.total != null && r.working != null);
}

/**
 * Produces the aria-label string for a table row so screen readers
 * announce the complete sentence in one pass.
 */
function rowAriaLabel({ label, total, working, workingWord, notWorkingWord }) {
  if (total === 0) return `${label}: none in this building`;
  const notWorking = total - working;
  return `${label}: ${total} total, ${working} ${workingWord}, ${notWorking} ${notWorkingWord}`;
}

// ---------------------------------------------------------------------------
// StatusCell — third column; colour is never the only signal
// ---------------------------------------------------------------------------

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
    return (
      <td className="px-3 py-2" aria-hidden="true">
        <span className="text-[11px] text-green-700">
          🟢 {working} {workingWord}
        </span>
      </td>
    );
  }

  if (working === 0) {
    return (
      <td className="px-3 py-2 space-y-0.5" aria-hidden="true">
        <div className="text-[11px] font-bold text-red-700">🔴 0 {workingWord}</div>
        <div className="text-[11px] font-bold text-red-700">
          🔴 {notWorking} {notWorkingWord}
        </div>
      </td>
    );
  }

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

export default function BuildingAccessibilityCard({ building, onReported }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const reportButtonRef = useRef(null);
  const dialogRef = useRef(null);

  // Close modal and return focus to the trigger button
  const closeModal = () => {
    setIsModalOpen(false);
    setErrorMessage('');
    setSelectedFeature('');
    setDescription('');
    setIsSubmitting(false);
    setTimeout(() => {
      reportButtonRef.current?.focus();
    }, 0);
  };

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    if (!isModalOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Focus management: move focus into dialog when opened
  useEffect(() => {
    if (isModalOpen) {
      const focusable = dialogRef.current?.querySelector(
        'input[type="radio"]:not([disabled]), textarea, button:not([disabled])'
      );
      focusable?.focus();
    }
  }, [isModalOpen]);

  // Auto-dismiss success notification after 5 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

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

  // Issues summary derivation: singular/plural formatting for notWorking features
  const brokenFeatures = features
    .map((f) => {
      const notWorking = f.total - f.working;
      let text = null;
      if (notWorking > 0) {
        if (f.label === 'Lift') {
          text = notWorking === 1 ? '1 Lift broken' : `${notWorking} Lifts broken`;
        } else if (f.label === 'Ramp') {
          text = notWorking === 1 ? '1 Ramp blocked' : `${notWorking} Ramps blocked`;
        } else if (f.label === 'Stairs') {
          text = notWorking === 1 ? '1 Stairs closed' : `${notWorking} Stairs closed`;
        }
      }
      return { label: f.label, notWorking, text };
    })
    .filter((f) => f.notWorking > 0);

  // Guard: building exists but has no accessibility data
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

  // Feature counts for the report issue form
  const featureAvailability = {
    Lift: {
      working: building.liftsWorking ?? building.lifts_working ?? 0,
      total: building.liftsTotal ?? building.lifts_total ?? 0,
      emoji: '🛗',
    },
    Ramp: {
      working: building.rampsWorking ?? building.ramps_working ?? 0,
      total: building.rampsTotal ?? building.ramps_total ?? 0,
      emoji: '♿',
    },
    Stairs: {
      working: building.stairsWorking ?? building.stairs_working ?? 0,
      total: building.stairsTotal ?? building.stairs_total ?? 0,
      emoji: '🪜',
    },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFeature || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingId: building.id,
          featureType: selectedFeature,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error || 'Failed to submit report. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Success flow
      closeModal();
      setSuccessMessage('Thanks, your report was sent');
      if (onReported && data.building) {
        onReported(data.building);
      }
    } catch {
      setErrorMessage('Network error: Unable to reach the server. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Card header & accessibility summary line */}
      <div className="mb-3">
        <h3 className="font-semibold text-slate-800 text-sm mb-1.5">{building.name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {brokenFeatures.length > 0 ? (
            brokenFeatures.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200"
              >
                <span aria-hidden="true">🔴</span>
                <span>{f.text}</span>
              </span>
            ))
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
              <span aria-hidden="true">🟢</span>
              <span>Everything working</span>
            </span>
          )}
        </div>
      </div>

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
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  <span aria-hidden="true" className="mr-1.5 text-base leading-none">
                    {f.emoji}
                  </span>
                  {f.label}
                </td>
                <td className="px-3 py-2 text-slate-700 font-mono text-right" aria-hidden="true">
                  {f.total}
                </td>
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

      {/* Success banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 p-2.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md flex items-center justify-between"
        >
          <span className="font-medium">✓ {successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-green-600 hover:text-green-800 text-sm font-bold ml-2 cursor-pointer"
            aria-label="Dismiss confirmation"
          >
            ×
          </button>
        </div>
      )}

      {/* Action Footer: Report Issue button (below table) */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">Notice an obstruction or malfunction?</span>
        <button
          ref={reportButtonRef}
          type="button"
          onClick={() => {
            setSuccessMessage('');
            setIsModalOpen(true);
          }}
          className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
        >
          Report Issue
        </button>
      </div>

      {/* Accessible Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          {/* Backdrop click dismiss */}
          <div
            className="fixed inset-0 -z-10"
            aria-hidden="true"
            onClick={!isSubmitting ? closeModal : undefined}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-issue-dialog-title"
            tabIndex={-1}
            className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 text-slate-800 focus:outline-none"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3
                  id="report-issue-dialog-title"
                  className="font-semibold text-slate-800 text-sm"
                >
                  Report an issue: {building.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Let the campus estate team know about an inaccessible or broken feature.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            {/* Error Message inside Dialog */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md"
              >
                {errorMessage}
              </div>
            )}

            {/* Report Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Feature Radio Group */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Affected Feature <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {['Lift', 'Ramp', 'Stairs'].map((type) => {
                    const info = featureAvailability[type];
                    const isDisabled = info.working <= 0 || info.total <= 0;

                    return (
                      <label
                        key={type}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                          isDisabled
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                            : selectedFeature === type
                            ? 'bg-orange-50/70 border-orange-500 text-slate-800 cursor-pointer ring-1 ring-orange-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="featureType"
                            value={type}
                            checked={selectedFeature === type}
                            disabled={isDisabled || isSubmitting}
                            onChange={(e) => setSelectedFeature(e.target.value)}
                            required
                            className="text-orange-500 focus:ring-orange-400 disabled:opacity-40"
                          />
                          <span className="font-medium">
                            {info.emoji} {type}
                          </span>
                        </div>

                        {isDisabled ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            All already reported
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {info.working} of {info.total} working
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Description Textarea */}
              <div>
                <label
                  htmlFor="report-description"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder="Specify floor, wing, or details about the issue..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-50 text-slate-800 resize-none"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Up to 500 characters</span>
                  <span className={description.length >= 500 ? 'text-red-500 font-medium' : ''}>
                    {description.length} / 500
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFeature}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSubmitting ? 'Sending…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
