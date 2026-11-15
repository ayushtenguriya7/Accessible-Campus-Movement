/**
 * Calculates the overall accessibility status for a building based on its feature counts.
 *
 * Evaluation Rules:
 * 1. "No step-free access" (tone: 'red'):
 *    Triggered when no ramp is working (working <= 0) AND no lift is working (working <= 0).
 * 2. "Fully accessible" (tone: 'green'):
 *    Triggered when every feature that exists (total > 0) is fully working (working >= total).
 * 3. "Limited access" (tone: 'orange'):
 *    Triggered in all other intermediate cases (e.g., at least one step-free access option
 *    is working, but one or more existing facilities are broken or closed).
 *
 * @param {Array<{ label?: string, name?: string, type?: string, total: number, working: number }>} features - List of building features
 * @returns {{ label: "Fully accessible" | "Limited access" | "No step-free access", tone: "green" | "orange" | "red" } | null}
 */
export function getOverallStatus(features) {
  // Return null for missing, non-array, or empty features
  if (!features || !Array.isArray(features) || features.length === 0) {
    return null;
  }

  const isRamp = (f) => {
    const key = String(f?.label || f?.name || f?.type || '').toLowerCase();
    return key.includes('ramp');
  };

  const isLift = (f) => {
    const key = String(f?.label || f?.name || f?.type || '').toLowerCase();
    return key.includes('lift') || key.includes('elevator');
  };

  const workingRamps = features
    .filter(isRamp)
    .reduce((sum, f) => sum + (Number(f.working) || 0), 0);

  const workingLifts = features
    .filter(isLift)
    .reduce((sum, f) => sum + (Number(f.working) || 0), 0);

  // Rule 1: "No step-free access" if no ramp is working AND no lift is working
  if (workingRamps === 0 && workingLifts === 0) {
    return {
      label: 'No step-free access',
      tone: 'red',
    };
  }

  // Filter features that exist in the building (total > 0)
  const existingFeatures = features.filter((f) => (Number(f.total) || 0) > 0);

  // Rule 2: "Fully accessible" if every feature that exists (total > 0) is fully working
  const isFullyWorking =
    existingFeatures.length > 0 &&
    existingFeatures.every(
      (f) => (Number(f.working) || 0) >= (Number(f.total) || 0)
    );

  if (isFullyWorking) {
    return {
      label: 'Fully accessible',
      tone: 'green',
    };
  }

  // Rule 3: Otherwise "Limited access"
  return {
    label: 'Limited access',
    tone: 'orange',
  };
}

