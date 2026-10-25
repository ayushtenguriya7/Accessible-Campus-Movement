'use client';

import { useId } from 'react';
import { CAMPUS_DATA_IS_VERIFIED } from '../data/campusBuildings';
import { STEP_FREE_NOTICE, formatDistance, formatDuration } from '../lib/routing';

const selectClasses =
  'w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60';

/**
 * "Find Accessible Route" card. Purely presentational: all state lives in useRouteFinder.
 * @param {{ finder: ReturnType<typeof import('../hooks/useRouteFinder').useRouteFinder> }} props
 */
export default function RouteFinderCard({ finder }) {
  const {
    buildings,
    sourceId,
    destinationId,
    status,
    error,
    route,
    changeSource,
    changeDestination,
    findRoute,
    reset,
  } = finder;

  const baseId = useId();
  const sourceSelectId = `${baseId}-source`;
  const destinationSelectId = `${baseId}-destination`;

  const isLoading = status === 'loading';
  const hasAnythingToClear = Boolean(sourceId || destinationId || route || error);

  const sourceName = buildings.find((b) => b.id === sourceId)?.name;
  const destinationName = buildings.find((b) => b.id === destinationId)?.name;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="font-semibold text-slate-800 text-sm mb-1">Find Accessible Route</h3>
      <p className="text-xs text-slate-500">Check step-free paths between campus buildings.</p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          findRoute();
        }}
        noValidate
      >
        <div>
          <label htmlFor={sourceSelectId} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600" aria-hidden="true"></span>
            Source building
          </label>
          <select
            id={sourceSelectId}
            value={sourceId}
            onChange={(e) => changeSource(e.target.value)}
            disabled={isLoading}
            className={selectClasses}
          >
            <option value="">Select source…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.number}. {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={destinationSelectId} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" aria-hidden="true"></span>
            Destination building
          </label>
          <select
            id={destinationSelectId}
            value={destinationId}
            onChange={(e) => changeDestination(e.target.value)}
            disabled={isLoading}
            className={selectClasses}
          >
            <option value="">Select destination…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.number}. {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 text-sm px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition disabled:opacity-60"
          >
            {isLoading ? 'Finding route…' : 'Find Route'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasAnythingToClear}
            className="text-sm px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg transition disabled:opacity-50 disabled:hover:bg-transparent"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Validation / routing errors */}
      {error && (
        <div role="alert" className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Result */}
      <div aria-live="polite">
        {route && (
          <div className="mt-3 space-y-2">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-slate-700">
              <p className="font-semibold text-slate-800">
                {sourceName} <span aria-hidden="true">➔</span>
                <span className="sr-only">to</span> {destinationName}
              </p>
              <p className="mt-0.5">
                Walking distance: <strong>{formatDistance(route.distanceMeters)}</strong> · Est. time:{' '}
                <strong>{formatDuration(route.durationSeconds)}</strong>
              </p>
            </div>

            {/* Basic routing is never presented as verified accessibility. */}
            {!route.stepFreeVerified && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                {STEP_FREE_NOTICE}
              </div>
            )}
          </div>
        )}
      </div>

      {!CAMPUS_DATA_IS_VERIFIED && (
        <p className="mt-3 text-[11px] leading-snug text-slate-400">
          Building names and locations are placeholder sample data until verified campus data is added.
        </p>
      )}
    </div>
  );
}
