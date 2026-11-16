'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LIFT_PROBLEMS } from '@/lib/problemTypes';

/**
 * LiftReportDialog
 * Accessible modal dialog for reporting an issue with a building's lift.
 */
export default function LiftReportDialog({
  isOpen,
  onClose,
  building,
  onSuccess,
}) {
  const liftsTotal = building?.liftsTotal ?? building?.lifts_total ?? 1;

  const [liftNumber, setLiftNumber] = useState(1);
  const [problem, setProblem] = useState(LIFT_PROBLEMS[0]);
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const firstInputRef = useRef(null);

  const resetForm = () => {
    setError(null);
    setProblem(LIFT_PROBLEMS[0]);
    setFloor('');
    setDescription('');
    setLiftNumber(1);
  };

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose]);

  // Focus moves into the dialog on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/lift-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: building.id,
          liftNumber: Number(liftNumber),
          problem,
          floor: floor.trim() || null,
          description: description.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error || 'Failed to submit report. Please try again.'
        );
      }

      resetForm();
      onSuccess(data.building);
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lift-dialog-title"
      title={`Report a lift issue: ${building?.name || ''}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          handleClose();
        }
      }}
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              id="lift-dialog-title"
              className="text-base font-bold text-slate-800"
            >
              Report a lift issue: {building?.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Notify the campus estate team about broken or malfunctioning lifts.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Server Error Message */}
        {error && (
          <div
            role="alert"
            className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Which lift? dropdown */}
          <div>
            <label
              htmlFor="lift-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Which lift? <span className="text-red-500">*</span>
            </label>
            <select
              id="lift-select"
              ref={firstInputRef}
              required
              value={liftNumber}
              onChange={(e) => setLiftNumber(Number(e.target.value))}
              disabled={submitting}
              className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
            >
              {Array.from(
                { length: Math.max(1, liftsTotal) },
                (_, i) => i + 1
              ).map((n) => (
                <option key={n} value={n}>
                  Lift {n}
                </option>
              ))}
            </select>
          </div>

          {/* What is wrong? radio group */}
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold text-slate-700 mb-1">
              What is wrong? <span className="text-red-500">*</span>
            </legend>
            <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {LIFT_PROBLEMS.map((prob) => (
                <label
                  key={prob}
                  className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer py-0.5"
                >
                  <input
                    type="radio"
                    name="lift-problem"
                    value={prob}
                    checked={problem === prob}
                    onChange={(e) => setProblem(e.target.value)}
                    required
                    disabled={submitting}
                    className="text-orange-500 focus:ring-orange-400"
                  />
                  <span>{prob}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Floor input (optional, max 20 chars) */}
          <div>
            <label
              htmlFor="lift-floor"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Floor <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="lift-floor"
              type="text"
              maxLength={20}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Ground, 2nd Floor"
              className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>

          {/* Description input (optional, max 500 chars with counter) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="lift-description"
                className="block text-xs font-semibold text-slate-700"
              >
                Description{' '}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {description.length}/500
              </span>
            </div>
            <textarea
              id="lift-description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="Describe the issue or any helpful details..."
              className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-slate-400 resize-none disabled:opacity-60"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
            >
              {submitting ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
