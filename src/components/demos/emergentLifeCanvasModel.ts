export type CanvasMetrics = {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
};

export type FixedStepResult = {
  steps: number;
  accumulatorSeconds: number;
};

export function calculateCanvasMetrics(
  width: number,
  height: number,
  devicePixelRatio: number,
  maximumDpr = 2,
): CanvasMetrics {
  const cssWidth = clampFinite(width, 1, 10_000, 1);
  const cssHeight = clampFinite(height, 1, 10_000, 1);
  const dpr = clampFinite(devicePixelRatio, 1, maximumDpr, 1);

  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.max(1, Math.round(cssWidth * dpr)),
    pixelHeight: Math.max(1, Math.round(cssHeight * dpr)),
    dpr,
  };
}

export function mapClientPointToWorld(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
  world: { width: number; height: number },
): { x: number; y: number } {
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const normalizedX = clampFinite((clientX - bounds.left) / width, 0, 1, 0);
  const normalizedY = clampFinite((clientY - bounds.top) / height, 0, 1, 0);

  return {
    x: Math.min(normalizedX * world.width, Math.max(world.width - 0.0001, 0)),
    y: Math.min(
      normalizedY * world.height,
      Math.max(world.height - 0.0001, 0),
    ),
  };
}

export function calculateFixedSteps(
  accumulatorSeconds: number,
  elapsedSeconds: number,
  fixedTimeStep: number,
  maximumCatchUpSteps: number,
  maximumFrameGap: number,
): FixedStepResult {
  const safeTimeStep = clampFinite(fixedTimeStep, 1 / 1_000, 1, 1 / 60);
  const safeMaximumSteps = Math.max(1, Math.trunc(maximumCatchUpSteps));
  const safeFrameGap = clampFinite(maximumFrameGap, safeTimeStep, 1, 0.1);
  const safeAccumulator = clampFinite(
    accumulatorSeconds,
    0,
    safeTimeStep * safeMaximumSteps,
    0,
  );
  const elapsed = clampFinite(elapsedSeconds, 0, safeFrameGap, 0);
  const availableTime = safeAccumulator + elapsed;
  const availableSteps = Math.floor(availableTime / safeTimeStep);
  const steps = Math.min(availableSteps, safeMaximumSteps);
  const accumulatorAfterSteps = availableTime - steps * safeTimeStep;

  return {
    steps,
    accumulatorSeconds:
      availableSteps > safeMaximumSteps
        ? accumulatorAfterSteps % safeTimeStep
        : accumulatorAfterSteps,
  };
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
