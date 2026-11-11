import { describe, expect, it } from 'vitest';
import {
  calculateCanvasMetrics,
  calculateFixedSteps,
  mapClientPointToWorld,
} from './emergentLifeCanvasModel';

describe('Emergent Life canvas sizing', () => {
  it('caps device pixel ratio while preserving CSS dimensions', () => {
    expect(calculateCanvasMetrics(640.4, 360.2, 3.5, 2)).toEqual({
      cssWidth: 640.4,
      cssHeight: 360.2,
      pixelWidth: 1281,
      pixelHeight: 720,
      dpr: 2,
    });
  });

  it('maps responsive client coordinates into world coordinates', () => {
    expect(
      mapClientPointToWorld(
        350,
        225,
        { left: 100, top: 50, width: 500, height: 350 },
        { width: 1_000, height: 700 },
      ),
    ).toEqual({ x: 500, y: 350 });
  });

  it('clamps points outside the interaction surface', () => {
    const point = mapClientPointToWorld(
      900,
      -20,
      { left: 100, top: 50, width: 500, height: 350 },
      { width: 1_000, height: 700 },
    );

    expect(point.x).toBeCloseTo(999.9999);
    expect(point.y).toBe(0);
  });
});

describe('Emergent Life fixed-step timing', () => {
  it('carries partial time into the next frame', () => {
    const first = calculateFixedSteps(0, 0.01, 1 / 60, 5, 0.1);
    const second = calculateFixedSteps(
      first.accumulatorSeconds,
      0.01,
      1 / 60,
      5,
      0.1,
    );

    expect(first.steps).toBe(0);
    expect(second.steps).toBe(1);
    expect(second.accumulatorSeconds).toBeCloseTo(0.02 - 1 / 60);
  });

  it('clamps long frame gaps and drops excess catch-up backlog', () => {
    const result = calculateFixedSteps(0, 5, 1 / 60, 4, 0.1);

    expect(result.steps).toBe(4);
    expect(result.accumulatorSeconds).toBeLessThan(1 / 60);
  });
});
