import type { InteractionMatrix } from '../../lib/emergentLife';

export type InteractionTone = 'attract' | 'neutral' | 'repel';

export function normalizeParticleCount(value: number): number {
  return roundToStep(clampFinite(value, 250, 2_000, 1_000), 50);
}

export function normalizeSimulationSpeed(value: number): number {
  return roundToStep(clampFinite(value, 0.25, 2, 1), 0.25);
}

export function normalizeBrushRadius(value: number): number {
  return roundToStep(clampFinite(value, 40, 160, 90), 5);
}

export function normalizeForceStrength(value: number): number {
  return roundToStep(clampFinite(value, 300, 1_600, 950), 50);
}

export function normalizeMatrixCoefficient(value: number): number {
  return roundToStep(clampFinite(value, -2, 2, 0), 0.05);
}

export function getInteractionTone(value: number): InteractionTone {
  if (value > 0.001) {
    return 'attract';
  }

  if (value < -0.001) {
    return 'repel';
  }

  return 'neutral';
}

export function describeInteraction(value: number): string {
  const normalized = normalizeMatrixCoefficient(value);

  if (normalized === 0) {
    return 'No species-specific attraction';
  }

  const strength = Math.abs(normalized);
  const intensity = strength >= 1.25 ? 'Strong' : strength >= 0.5 ? 'Moderate' : 'Gentle';

  return `${intensity} ${normalized > 0 ? 'attraction' : 'repulsion'}`;
}

export function cloneInteractionMatrix(
  matrix: InteractionMatrix,
): InteractionMatrix {
  return matrix.map((row) => [...row]) as InteractionMatrix;
}

function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(4));
}

function clampFinite(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, minimum), maximum);
}
