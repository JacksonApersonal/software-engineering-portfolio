import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  EmergentLifeSimulation,
  type EmergentLifePresetName,
  type EmergentLifeOptions,
  type EmergentLifeResetOptions,
  type InteractionMatrix,
  type SpeciesId,
} from '../../lib/emergentLife';
import {
  calculateCanvasMetrics,
  calculateFixedSteps,
  mapClientPointToWorld,
  type CanvasMetrics,
} from './emergentLifeCanvasModel';
import {
  normalizeBrushRadius,
  normalizeForceStrength,
  normalizeSimulationSpeed,
} from './emergentLifeControlsModel';

export type EmergentLifeInteractionTool =
  | 'attract'
  | 'repel'
  | 'spawn'
  | 'erase';

export type EmergentLifeInteractionSettings = {
  brushRadius?: number;
  forceStrength?: number;
  spawnSpecies?: SpeciesId;
  spawnCount?: number;
};

export type EmergentLifeCanvasMetrics = {
  activeParticleCount: number;
  approximateFps: number;
  isRunning: boolean;
};

export type EmergentLifeCanvasSnapshot = {
  matrix: InteractionMatrix;
  options: Readonly<EmergentLifeOptions>;
  activeParticleCount: number;
  preset: EmergentLifePresetName;
  simulationSpeed: number;
  isRunning: boolean;
};

export type EmergentLifeCanvasHandle = {
  pause: () => void;
  resume: (userInitiated?: boolean) => boolean;
  reset: (options?: EmergentLifeResetOptions) => EmergentLifeCanvasSnapshot;
  selectPreset: (
    preset: EmergentLifePresetName,
    particleCount?: number,
  ) => EmergentLifeCanvasSnapshot;
  setInteractionTool: (tool: EmergentLifeInteractionTool) => void;
  setInteractionSettings: (
    settings: EmergentLifeInteractionSettings,
  ) => void;
  setSimulationSpeed: (speed: number) => number;
  updateMatrix: (matrix: InteractionMatrix) => InteractionMatrix;
  setOptions: (
    options: Partial<EmergentLifeOptions>,
  ) => EmergentLifeCanvasSnapshot;
  getSnapshot: () => EmergentLifeCanvasSnapshot;
};

export type EmergentLifeCanvasProps = {
  initialPreset?: EmergentLifePresetName;
  initialTool?: EmergentLifeInteractionTool;
  initialParticleCount?: number;
  autoStart?: boolean;
  showInlineControls?: boolean;
  onMetrics?: (metrics: EmergentLifeCanvasMetrics) => void;
  onRunningChange?: (isRunning: boolean) => void;
  className?: string;
};

const PARTICLE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fb7185'] as const;
const MAXIMUM_DPR = 2;
const MAXIMUM_FRAME_GAP_SECONDS = 0.1;
const MAXIMUM_CATCH_UP_STEPS = 5;

type PointerState = {
  active: boolean;
  pointerId: number | null;
  x: number;
  y: number;
  tool: EmergentLifeInteractionTool;
  lastEditX: number;
  lastEditY: number;
};

type InteractionSettingsState = {
  brushRadius: number;
  forceStrength: number;
  spawnSpecies: SpeciesId;
  spawnCount: number;
};

export const EmergentLifeCanvas = forwardRef<
  EmergentLifeCanvasHandle,
  EmergentLifeCanvasProps
>(function EmergentLifeCanvas(
  {
    initialPreset = 'swarms',
    initialTool = 'attract',
    initialParticleCount,
    autoStart = true,
    showInlineControls = true,
    onMetrics,
    onRunningChange,
    className = '',
  },
  ref,
) {
  const simulationRef = useRef<EmergentLifeSimulation | null>(null);
  if (simulationRef.current === null) {
    simulationRef.current = new EmergentLifeSimulation({
      preset: initialPreset,
      particleCount: initialParticleCount,
    });
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasMetricsRef = useRef<CanvasMetrics | null>(null);
  const backgroundGradientRef = useRef<CanvasGradient | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestFrameRef = useRef<() => void>(() => undefined);
  const lastTimestampRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const runningRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const reducedMotionStartAuthorizedRef = useRef(false);
  const documentVisibleRef = useRef(true);
  const hasSizedRef = useRef(false);
  const currentPresetRef = useRef<EmergentLifePresetName>(initialPreset);
  const toolRef = useRef<EmergentLifeInteractionTool>(initialTool);
  const simulationSpeedRef = useRef(1);
  const interactionSettingsRef = useRef<InteractionSettingsState>({
    brushRadius: 90,
    forceStrength: 950,
    spawnSpecies: 0,
    spawnCount: 12,
  });
  const metricsSampleRef = useRef({ startedAt: 0, frames: 0 });
  const lastApproximateFpsRef = useRef(0);
  const onMetricsRef = useRef(onMetrics);
  const onRunningChangeRef = useRef(onRunningChange);
  const pointerRef = useRef<PointerState>({
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
    tool: initialTool,
    lastEditX: Number.NaN,
    lastEditY: Number.NaN,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [selectedTool, setSelectedTool] =
    useState<EmergentLifeInteractionTool>(initialTool);
  const [currentPreset, setCurrentPreset] =
    useState<EmergentLifePresetName>(initialPreset);
  const [particleCount, setParticleCount] = useState(
    simulationRef.current.getParticles().count,
  );

  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    onRunningChangeRef.current = onRunningChange;
  }, [onRunningChange]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const metrics = canvasMetricsRef.current;
    const simulation = simulationRef.current;

    if (!canvas || !metrics || !simulation) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    context.fillStyle = backgroundGradientRef.current ?? '#06090b';
    context.fillRect(0, 0, metrics.cssWidth, metrics.cssHeight);

    const particles = simulation.getParticles();
    const radius = particles.count > 1_500 ? 2.45 : 2.9;

    for (let species = 0; species < PARTICLE_COLORS.length; species += 1) {
      context.beginPath();

      for (let index = 0; index < particles.count; index += 1) {
        if (particles.species[index] !== species) {
          continue;
        }

        context.moveTo(particles.x[index] + radius, particles.y[index]);
        context.arc(
          particles.x[index],
          particles.y[index],
          radius,
          0,
          Math.PI * 2,
        );
      }

      context.fillStyle = PARTICLE_COLORS[species];
      context.globalAlpha = 0.96;
      context.fill();
    }

    context.globalAlpha = 1;
  }, []);

  const getSnapshot = useCallback((): EmergentLifeCanvasSnapshot => {
    const simulation = simulationRef.current;
    if (!simulation) {
      throw new Error('Emergent Life simulation is unavailable.');
    }

    return {
      matrix: simulation.getMatrix(),
      options: simulation.getOptions(),
      activeParticleCount: simulation.getParticles().count,
      preset: currentPresetRef.current,
      simulationSpeed: simulationSpeedRef.current,
      isRunning: runningRef.current,
    };
  }, []);

  const publishMetrics = useCallback((approximateFps: number) => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    lastApproximateFpsRef.current = approximateFps;
    onMetricsRef.current?.({
      activeParticleCount: simulation.getParticles().count,
      approximateFps,
      isRunning: runningRef.current,
    });
  }, []);

  const pause = useCallback(() => {
    runningRef.current = false;
    lastTimestampRef.current = null;
    accumulatorRef.current = 0;
    metricsSampleRef.current = { startedAt: 0, frames: 0 };

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRunning(false);
    onRunningChangeRef.current?.(false);
    publishMetrics(0);
  }, [publishMetrics]);

  const resume = useCallback((userInitiated = false): boolean => {
    if (
      reducedMotionRef.current &&
      !userInitiated &&
      !reducedMotionStartAuthorizedRef.current
    ) {
      return false;
    }

    if (userInitiated) {
      reducedMotionStartAuthorizedRef.current = true;
    }

    runningRef.current = true;
    lastTimestampRef.current = null;
    accumulatorRef.current = 0;
    metricsSampleRef.current = { startedAt: 0, frames: 0 };
    setIsRunning(true);
    onRunningChangeRef.current?.(true);
    requestFrameRef.current();
    return true;
  }, []);

  const reset = useCallback(
    (
      resetOptions: EmergentLifeResetOptions = {},
    ): EmergentLifeCanvasSnapshot => {
      const simulation = simulationRef.current;
      if (!simulation) {
        throw new Error('Emergent Life simulation is unavailable.');
      }

      if (resetOptions.preset) {
        currentPresetRef.current = resetOptions.preset;
        setCurrentPreset(resetOptions.preset);
      }

      const metrics = canvasMetricsRef.current;
      simulation.reset({
        ...resetOptions,
        options: {
          ...resetOptions.options,
          ...(metrics
            ? {
                worldWidth: metrics.cssWidth,
                worldHeight: metrics.cssHeight,
              }
            : {}),
        },
      });
      accumulatorRef.current = 0;
      lastTimestampRef.current = null;
      setParticleCount(simulation.getParticles().count);
      drawFrame();
      publishMetrics(0);
      return getSnapshot();
    },
    [drawFrame, getSnapshot, publishMetrics],
  );

  const selectPreset = useCallback(
    (preset: EmergentLifePresetName, selectedParticleCount?: number) => {
      return reset({ preset, particleCount: selectedParticleCount });
    },
    [reset],
  );

  const setInteractionTool = useCallback(
    (tool: EmergentLifeInteractionTool) => {
      toolRef.current = tool;
      setSelectedTool(tool);
    },
    [],
  );

  const setInteractionSettings = useCallback(
    (settings: EmergentLifeInteractionSettings) => {
      const current = interactionSettingsRef.current;
      interactionSettingsRef.current = {
        brushRadius:
          settings.brushRadius === undefined
            ? current.brushRadius
            : normalizeBrushRadius(settings.brushRadius),
        forceStrength:
          settings.forceStrength === undefined
            ? current.forceStrength
            : normalizeForceStrength(settings.forceStrength),
        spawnSpecies:
          settings.spawnSpecies === undefined
            ? current.spawnSpecies
            : settings.spawnSpecies,
        spawnCount:
          settings.spawnCount === undefined
            ? current.spawnCount
            : Math.min(Math.max(Math.trunc(settings.spawnCount), 1), 50),
      };
    },
    [],
  );

  const setSimulationSpeed = useCallback((speed: number): number => {
    const normalizedSpeed = normalizeSimulationSpeed(speed);
    simulationSpeedRef.current = normalizedSpeed;
    accumulatorRef.current = 0;
    return normalizedSpeed;
  }, []);

  const updateMatrix = useCallback(
    (matrix: InteractionMatrix): InteractionMatrix => {
      const simulation = simulationRef.current;
      if (!simulation) {
        throw new Error('Emergent Life simulation is unavailable.');
      }

      simulation.updateMatrix(matrix);
      return simulation.getMatrix();
    },
    [],
  );

  const setOptions = useCallback(
    (
      options: Partial<EmergentLifeOptions>,
    ): EmergentLifeCanvasSnapshot => {
      const simulation = simulationRef.current;
      if (!simulation) {
        throw new Error('Emergent Life simulation is unavailable.');
      }

      const metrics = canvasMetricsRef.current;
      simulation.setOptions({
        ...options,
        ...(metrics
          ? {
              worldWidth: metrics.cssWidth,
              worldHeight: metrics.cssHeight,
            }
          : {}),
      });
      setParticleCount(simulation.getParticles().count);
      drawFrame();
      publishMetrics(0);
      return getSnapshot();
    },
    [drawFrame, getSnapshot, publishMetrics],
  );

  useImperativeHandle(
    ref,
    () => ({
      pause,
      resume,
      reset,
      selectPreset,
      setInteractionTool,
      setInteractionSettings,
      setSimulationSpeed,
      updateMatrix,
      setOptions,
      getSnapshot,
    }),
    [
      getSnapshot,
      pause,
      reset,
      resume,
      selectPreset,
      setInteractionSettings,
      setInteractionTool,
      setOptions,
      setSimulationSpeed,
      updateMatrix,
    ],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const simulation = simulationRef.current;
    if (!canvas || !simulation) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const canvasElement = canvas;
    const drawingContext = context;
    const simulationInstance = simulation;
    const pointerState = pointerRef.current;

    function resizeCanvas() {
      const bounds = canvasElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      const metrics = calculateCanvasMetrics(
        bounds.width,
        bounds.height,
        window.devicePixelRatio,
        MAXIMUM_DPR,
      );
      canvasMetricsRef.current = metrics;

      if (
        canvasElement.width !== metrics.pixelWidth ||
        canvasElement.height !== metrics.pixelHeight
      ) {
        canvasElement.width = metrics.pixelWidth;
        canvasElement.height = metrics.pixelHeight;
      }

      drawingContext.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
      const gradient = drawingContext.createRadialGradient(
        metrics.cssWidth * 0.5,
        metrics.cssHeight * 0.45,
        0,
        metrics.cssWidth * 0.5,
        metrics.cssHeight * 0.45,
        Math.max(metrics.cssWidth, metrics.cssHeight) * 0.75,
      );
      gradient.addColorStop(0, '#11181c');
      gradient.addColorStop(0.55, '#090d10');
      gradient.addColorStop(1, '#040607');
      backgroundGradientRef.current = gradient;

      if (!hasSizedRef.current) {
        hasSizedRef.current = true;
        simulationInstance.reset({
          preset: currentPresetRef.current,
          particleCount: simulationInstance.getParticles().count,
          options: {
            worldWidth: metrics.cssWidth,
            worldHeight: metrics.cssHeight,
          },
        });
        setParticleCount(simulationInstance.getParticles().count);
      } else {
        simulationInstance.setOptions({
          worldWidth: metrics.cssWidth,
          worldHeight: metrics.cssHeight,
        });
      }

      drawFrame();
    }

    function applyPointerForce() {
      const pointer = pointerRef.current;
      if (
        !pointer.active ||
        (pointer.tool !== 'attract' && pointer.tool !== 'repel')
      ) {
        return;
      }

      const settings = interactionSettingsRef.current;
      const strength =
        pointer.tool === 'attract'
          ? settings.forceStrength
          : -settings.forceStrength;
      simulationInstance.applyLocalizedForce(
        { x: pointer.x, y: pointer.y },
        strength,
        settings.brushRadius,
      );
    }

    function tick(timestamp: number) {
      animationFrameRef.current = null;

      if (!runningRef.current || !documentVisibleRef.current) {
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsedSeconds = Math.max(
        0,
        (timestamp - lastTimestampRef.current) / 1_000,
      );
      lastTimestampRef.current = timestamp;
      const timing = calculateFixedSteps(
        accumulatorRef.current,
        elapsedSeconds * simulationSpeedRef.current,
        simulationInstance.getOptions().fixedTimeStep,
        MAXIMUM_CATCH_UP_STEPS,
        MAXIMUM_FRAME_GAP_SECONDS,
      );
      accumulatorRef.current = timing.accumulatorSeconds;

      for (let stepIndex = 0; stepIndex < timing.steps; stepIndex += 1) {
        applyPointerForce();
        simulationInstance.step();
      }

      drawFrame();

      const sample = metricsSampleRef.current;
      if (sample.startedAt === 0) {
        sample.startedAt = timestamp;
      }
      sample.frames += 1;

      const sampleDuration = timestamp - sample.startedAt;
      if (sampleDuration >= 500) {
        publishMetrics((sample.frames * 1_000) / sampleDuration);
        sample.startedAt = timestamp;
        sample.frames = 0;
      }

      requestFrameRef.current();
    }

    requestFrameRef.current = () => {
      if (
        animationFrameRef.current === null &&
        runningRef.current &&
        documentVisibleRef.current
      ) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    function handleVisibilityChange() {
      documentVisibleRef.current = !document.hidden;
      lastTimestampRef.current = null;
      accumulatorRef.current = 0;
      metricsSampleRef.current = { startedAt: 0, frames: 0 };

      if (document.hidden && animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      } else if (!document.hidden && runningRef.current) {
        requestFrameRef.current();
      }
    }

    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      reducedMotionRef.current = event.matches;
      reducedMotionStartAuthorizedRef.current = false;
      setPrefersReducedMotion(event.matches);

      if (event.matches) {
        pause();
        drawFrame();
      } else if (autoStart) {
        resume();
      }
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvasElement);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    documentVisibleRef.current = !document.hidden;
    reducedMotionRef.current = reducedMotionQuery.matches;
    reducedMotionStartAuthorizedRef.current = false;
    setPrefersReducedMotion(reducedMotionQuery.matches);
    resizeCanvas();

    if (autoStart && !reducedMotionQuery.matches) {
      resume();
    } else {
      pause();
      drawFrame();
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener(
        'change',
        handleReducedMotionChange,
      );

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      if (
        pointerState.pointerId !== null &&
        canvasElement.hasPointerCapture(pointerState.pointerId)
      ) {
        canvasElement.releasePointerCapture(pointerState.pointerId);
      }

      pointerState.active = false;
      pointerState.pointerId = null;
      animationFrameRef.current = null;
      requestFrameRef.current = () => undefined;
    };
  }, [autoStart, drawFrame, pause, publishMetrics, resume]);

  function updatePointerPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const options = simulation.getOptions();
    const point = mapClientPointToWorld(
      event.clientX,
      event.clientY,
      bounds,
      { width: options.worldWidth, height: options.worldHeight },
    );
    pointerRef.current.x = point.x;
    pointerRef.current.y = point.y;
  }

  function applyPausedPointerStep() {
    const simulation = simulationRef.current;
    const pointer = pointerRef.current;
    if (
      !simulation ||
      runningRef.current ||
      !pointer.active ||
      (pointer.tool !== 'attract' && pointer.tool !== 'repel')
    ) {
      return;
    }

    const settings = interactionSettingsRef.current;
    simulation.applyLocalizedForce(
      { x: pointer.x, y: pointer.y },
      pointer.tool === 'attract'
        ? settings.forceStrength
        : -settings.forceStrength,
      settings.brushRadius,
    );
    simulation.step();
    drawFrame();
  }

  function applyPointerEdit() {
    const simulation = simulationRef.current;
    const pointer = pointerRef.current;
    if (
      !simulation ||
      !pointer.active ||
      (pointer.tool !== 'spawn' && pointer.tool !== 'erase')
    ) {
      return;
    }

    const settings = interactionSettingsRef.current;
    const minimumSpacing = Math.max(8, settings.brushRadius * 0.25);
    if (
      Number.isFinite(pointer.lastEditX) &&
      Math.hypot(
        pointer.x - pointer.lastEditX,
        pointer.y - pointer.lastEditY,
      ) < minimumSpacing
    ) {
      return;
    }

    if (pointer.tool === 'spawn') {
      simulation.spawnNear(
        { x: pointer.x, y: pointer.y },
        settings.spawnCount,
        {
          radius: settings.brushRadius * 0.35,
          species: settings.spawnSpecies,
        },
      );
    } else {
      simulation.eraseNear(
        { x: pointer.x, y: pointer.y },
        settings.brushRadius,
      );
    }

    pointer.lastEditX = pointer.x;
    pointer.lastEditY = pointer.y;
    const nextCount = simulation.getParticles().count;
    setParticleCount(nextCount);
    publishMetrics(lastApproximateFpsRef.current);
    drawFrame();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    pointerRef.current.active = true;
    pointerRef.current.pointerId = event.pointerId;
    pointerRef.current.tool =
      event.button === 2 || event.altKey ? 'repel' : toolRef.current;
    pointerRef.current.lastEditX = Number.NaN;
    pointerRef.current.lastEditY = Number.NaN;
    updatePointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    applyPointerEdit();
    applyPausedPointerStep();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (
      !pointerRef.current.active ||
      pointerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updatePointerPosition(event);
    applyPointerEdit();
    applyPausedPointerStep();
  }

  function endPointerInteraction(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerRef.current.active = false;
    pointerRef.current.pointerId = null;
    pointerRef.current.lastEditX = Number.NaN;
    pointerRef.current.lastEditY = Number.NaN;
  }

  const statusLabel = isRunning
    ? 'Running'
    : prefersReducedMotion
      ? 'Reduced motion · static'
      : 'Paused';

  return (
    <section
      className={`w-full self-start overflow-hidden rounded-2xl border border-neutral-800 bg-[#080b0d] shadow-2xl shadow-black/30 ${className}`}
      aria-labelledby="emergent-life-canvas-heading"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3
              id="emergent-life-canvas-heading"
              className="font-semibold text-white"
            >
              Emergent Life
            </h3>
            <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {particleCount.toLocaleString()} particles · {formatPresetName(currentPreset)} preset
          </p>
        </div>

        {showInlineControls && (
          <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-neutral-700 bg-neutral-900 p-1"
            role="group"
            aria-label="Particle interaction tool"
          >
            {(['attract', 'repel', 'spawn', 'erase'] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                aria-pressed={selectedTool === tool}
                onClick={() => setInteractionTool(tool)}
                className={
                  selectedTool === tool
                    ? 'min-h-9 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold capitalize text-neutral-950'
                    : 'min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium capitalize text-neutral-400 transition hover:text-white'
                }
              >
                {tool}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={isRunning ? pause : () => resume(true)}
            className="min-h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-cyan-300/50 hover:text-white"
          >
            {isRunning ? 'Pause' : 'Start simulation'}
          </button>
          </div>
        )}
      </div>

      <div className="relative bg-[#040607]">
        <canvas
          ref={canvasRef}
          className="block aspect-[4/3] w-full touch-none sm:aspect-video"
          aria-label="Interactive Particle Life simulation. Choose attract or repel, then drag across the canvas."
          aria-describedby="emergent-life-canvas-instructions"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerInteraction}
          onPointerCancel={endPointerInteraction}
          onContextMenu={(event) => event.preventDefault()}
        >
          Animated Particle Life simulation with four colored species.
        </canvas>
      </div>

      <div
        id="emergent-life-canvas-instructions"
        className="flex flex-col gap-1 border-t border-neutral-800 bg-neutral-950/90 px-4 py-3 text-xs leading-5 text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <span>Drag across the canvas to {selectedTool} nearby particles.</span>
        <span>Mouse shortcut: hold Alt or right-drag to repel.</span>
      </div>
    </section>
  );
});

function formatPresetName(preset: EmergentLifePresetName): string {
  return preset.charAt(0).toUpperCase() + preset.slice(1);
}
