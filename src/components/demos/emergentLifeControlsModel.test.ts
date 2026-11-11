import { describe, expect, it } from 'vitest';
import {
  cloneInteractionMatrix,
  describeInteraction,
  getInteractionTone,
  normalizeBrushRadius,
  normalizeForceStrength,
  normalizeMatrixCoefficient,
  normalizeParticleCount,
  normalizeSimulationSpeed,
} from './emergentLifeControlsModel';

describe('Emergent Life control normalization', () => {
  it('bounds and steps particle count and simulation speed', () => {
    expect(normalizeParticleCount(2_123)).toBe(2_000);
    expect(normalizeParticleCount(1_024)).toBe(1_000);
    expect(normalizeSimulationSpeed(1.38)).toBe(1.5);
    expect(normalizeSimulationSpeed(0)).toBe(0.25);
  });

  it('bounds brush radius and force strength', () => {
    expect(normalizeBrushRadius(12)).toBe(40);
    expect(normalizeBrushRadius(93)).toBe(95);
    expect(normalizeForceStrength(9_000)).toBe(1_600);
    expect(normalizeForceStrength(974)).toBe(950);
  });

  it('normalizes and describes matrix coefficients', () => {
    expect(normalizeMatrixCoefficient(3)).toBe(2);
    expect(normalizeMatrixCoefficient(-0.534)).toBe(-0.55);
    expect(getInteractionTone(0.4)).toBe('attract');
    expect(getInteractionTone(-0.4)).toBe('repel');
    expect(getInteractionTone(0)).toBe('neutral');
    expect(describeInteraction(1.5)).toBe('Strong attraction');
    expect(describeInteraction(-0.2)).toBe('Gentle repulsion');
    expect(describeInteraction(0)).toBe('No species-specific attraction');
  });

  it('clones matrix rows so UI edits cannot mutate preset data', () => {
    const original = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ] as const;
    const clone = cloneInteractionMatrix(
      original.map((row) => [...row]) as [
        [number, number, number, number],
        [number, number, number, number],
        [number, number, number, number],
        [number, number, number, number],
      ],
    );

    clone[0][0] = -1;
    expect(original[0][0]).toBe(1);
  });
});
