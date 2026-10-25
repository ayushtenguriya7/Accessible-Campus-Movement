'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMPUS_BUILDINGS } from '../data/campusBuildings';
import { fetchWalkingRoute, validateSelection } from '../lib/routing';

/**
 * State + actions for the "Find Accessible Route" feature (Module 1).
 * The dashboard owns this hook and passes the pieces to both the route card and the map.
 */
export function useRouteFinder(buildings = CAMPUS_BUILDINGS) {
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [error, setError] = useState('');
  const [route, setRoute] = useState(null);
  const [resetCount, setResetCount] = useState(0); // lets the map re-centre when the user hits Reset

  // Lets us cancel an in-flight request when a new search starts or the page unmounts.
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Any change to a selection invalidates the previous result and message.
  const discardResult = useCallback(() => {
    abortRef.current?.abort();
    setRoute(null);
    setError('');
    setStatus('idle');
  }, []);

  const changeSource = useCallback(
    (id) => {
      setSourceId(id);
      discardResult();
    },
    [discardResult]
  );

  const changeDestination = useCallback(
    (id) => {
      setDestinationId(id);
      discardResult();
    },
    [discardResult]
  );

  const findRoute = useCallback(async () => {
    const validationError = validateSelection(sourceId, destinationId);
    if (validationError) {
      abortRef.current?.abort();
      setRoute(null);
      setStatus('error');
      setError(validationError);
      return;
    }

    const from = buildings.find((b) => b.id === sourceId);
    const to = buildings.find((b) => b.id === destinationId);
    if (!from || !to) {
      setRoute(null);
      setStatus('error');
      setError('The selected building could not be found. Please choose again.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError('');
    setRoute(null);

    try {
      const result = await fetchWalkingRoute(from, to, controller.signal);
      if (controller.signal.aborted) return;
      setRoute(result);
      setStatus('success');
    } catch (err) {
      if (controller.signal.aborted) return; // superseded or unmounted
      setStatus('error');
      setError(err.message || 'Something went wrong while finding the route.');
    }
  }, [buildings, sourceId, destinationId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSourceId('');
    setDestinationId('');
    setRoute(null);
    setError('');
    setStatus('idle');
    setResetCount((n) => n + 1);
  }, []);

  return {
    buildings,
    sourceId,
    destinationId,
    status,
    error,
    route,
    resetCount,
    changeSource,
    changeDestination,
    findRoute,
    reset,
  };
}
