import { useCallback, useRef, useState } from 'react';
import {
  EMERGENT_LIFE_PRESETS,
  type EmergentLifePresetName,
  type InteractionMatrix,
  type SpeciesId,
} from '../../lib/emergentLife';
import {
  EmergentLifeCanvas,
  type EmergentLifeCanvasHandle,
  type EmergentLifeCanvasMetrics,
  type EmergentLifeInteractionTool,
} from './EmergentLifeCanvas';
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

const presetNames: EmergentLifePresetName[] = [
  'swarms',
  'orbits',
  'clusters',
  'chaos',
];

const interactionTools: Array<{
  value: EmergentLifeInteractionTool;
  label: string;
  description: string;
}> = [
  { value: 'attract', label: 'Attract', description: 'Pull nearby particles' },
  { value: 'repel', label: 'Repel', description: 'Push nearby particles' },
  { value: 'spawn', label: 'Spawn', description: 'Paint new particles' },
  { value: 'erase', label: 'Erase', description: 'Remove particles' },
];

const speciesDetails: Array<{
  id: SpeciesId;
  name: string;
  color: string;
  dotClassName: string;
}> = [
  { id: 0, name: 'Cyan', color: '#22d3ee', dotClassName: 'bg-cyan-400' },
  { id: 1, name: 'Violet', color: '#a78bfa', dotClassName: 'bg-violet-400' },
  { id: 2, name: 'Green', color: '#4ade80', dotClassName: 'bg-green-400' },
  { id: 3, name: 'Coral', color: '#fb7185', dotClassName: 'bg-rose-400' },
];

const interactionToneStyles = {
  attract:
    'border-emerald-400/40 bg-emerald-400/10 text-emerald-100 focus:border-emerald-300',
  neutral:
    'border-neutral-700 bg-neutral-950 text-neutral-300 focus:border-neutral-400',
  repel:
    'border-rose-400/40 bg-rose-400/10 text-rose-100 focus:border-rose-300',
};

export function EmergentLifeSimulatorDemo() {
  const canvasRef = useRef<EmergentLifeCanvasHandle | null>(null);
  const initialPreset = EMERGENT_LIFE_PRESETS.swarms;
  const [selectedPreset, setSelectedPreset] =
    useState<EmergentLifePresetName>('swarms');
  const [matrix, setMatrix] = useState<InteractionMatrix>(() =>
    cloneInteractionMatrix(initialPreset.matrix),
  );
  const [isMatrixCustomized, setIsMatrixCustomized] = useState(false);
  const [selectedParticleCount, setSelectedParticleCount] = useState(
    initialPreset.particleCount,
  );
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [selectedTool, setSelectedTool] =
    useState<EmergentLifeInteractionTool>('attract');
  const [spawnSpecies, setSpawnSpecies] = useState<SpeciesId>(0);
  const [brushRadius, setBrushRadius] = useState(90);
  const [forceStrength, setForceStrength] = useState(950);
  const [metrics, setMetrics] = useState<EmergentLifeCanvasMetrics>({
    activeParticleCount: initialPreset.particleCount,
    approximateFps: 0,
    isRunning: false,
  });
  const [statusMessage, setStatusMessage] = useState(
    'Swarms preset ready.',
  );

  const handleMetrics = useCallback((nextMetrics: EmergentLifeCanvasMetrics) => {
    setMetrics(nextMetrics);
  }, []);

  const handleRunningChange = useCallback((isRunning: boolean) => {
    setMetrics((current) => ({ ...current, isRunning }));
    setStatusMessage(isRunning ? 'Simulation running.' : 'Simulation paused.');
  }, []);

  function applyPreset(presetName: EmergentLifePresetName) {
    const snapshot = canvasRef.current?.selectPreset(
      presetName,
      selectedParticleCount,
    );
    const preset = EMERGENT_LIFE_PRESETS[presetName];

    setSelectedPreset(presetName);
    setMatrix(
      cloneInteractionMatrix(snapshot?.matrix ?? preset.matrix),
    );
    setIsMatrixCustomized(false);
    setMetrics((current) => ({
      ...current,
      activeParticleCount:
        snapshot?.activeParticleCount ?? selectedParticleCount,
    }));
    setStatusMessage(
      `${preset.name} preset applied and particles reset to ${selectedParticleCount.toLocaleString()}.`,
    );
  }

  function handleReset() {
    applyPreset(selectedPreset);
  }

  function handlePlayPause() {
    if (metrics.isRunning) {
      canvasRef.current?.pause();
    } else {
      canvasRef.current?.resume(true);
    }
  }

  function handleParticleCountChange(value: number) {
    setSelectedParticleCount(normalizeParticleCount(value));
  }

  function handleSpeedChange(value: number) {
    const normalized = normalizeSimulationSpeed(value);
    const applied = canvasRef.current?.setSimulationSpeed(normalized) ?? normalized;
    setSimulationSpeed(applied);
    setStatusMessage(`Simulation speed set to ${applied.toFixed(2)}×.`);
  }

  function handleToolChange(tool: EmergentLifeInteractionTool) {
    setSelectedTool(tool);
    canvasRef.current?.setInteractionTool(tool);
    setStatusMessage(`${formatLabel(tool)} interaction tool selected.`);
  }

  function handleSpawnSpeciesChange(species: SpeciesId) {
    setSpawnSpecies(species);
    canvasRef.current?.setInteractionSettings({ spawnSpecies: species });
    setStatusMessage(`${speciesDetails[species].name} spawn species selected.`);
  }

  function handleBrushRadiusChange(value: number) {
    const normalized = normalizeBrushRadius(value);
    setBrushRadius(normalized);
    canvasRef.current?.setInteractionSettings({ brushRadius: normalized });
  }

  function handleForceStrengthChange(value: number) {
    const normalized = normalizeForceStrength(value);
    setForceStrength(normalized);
    canvasRef.current?.setInteractionSettings({ forceStrength: normalized });
  }

  function handleMatrixChange(
    affectedSpecies: SpeciesId,
    neighborSpecies: SpeciesId,
    value: number,
  ) {
    const nextMatrix = cloneInteractionMatrix(matrix);
    nextMatrix[affectedSpecies][neighborSpecies] =
      normalizeMatrixCoefficient(value);
    const appliedMatrix =
      canvasRef.current?.updateMatrix(nextMatrix) ?? nextMatrix;

    setMatrix(cloneInteractionMatrix(appliedMatrix));
    setIsMatrixCustomized(true);
    setStatusMessage(
      `${speciesDetails[affectedSpecies].name} response to ${speciesDetails[neighborSpecies].name} updated.`,
    );
  }

  const hasPendingParticleCount =
    metrics.activeParticleCount !== selectedParticleCount;

  return (
    <div className="w-full space-y-6">
      <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-[#080b0d] shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-5 border-b border-neutral-800 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(167,139,250,0.13),transparent_28%),#101416] px-5 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Interactive Particle Life Lab
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Shape simple rules. Watch complex motion emerge.
            </h3>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Choose a designed preset, tune directional species interactions,
              and manipulate the simulation directly with mouse, touch, or pen.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[22rem]">
            <MetricCard
              label="Live particles"
              value={metrics.activeParticleCount.toLocaleString()}
            />
            <MetricCard
              label="Render FPS"
              value={
                metrics.isRunning
                  ? Math.round(metrics.approximateFps).toString()
                  : 'Paused'
              }
            />
            <MetricCard
              label="Physics Rate"
              value={`${simulationSpeed.toFixed(2)}×`}
            />
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:p-6">
          <EmergentLifeCanvas
            ref={canvasRef}
            initialPreset={selectedPreset}
            initialParticleCount={selectedParticleCount}
            initialTool={selectedTool}
            showInlineControls={false}
            onMetrics={handleMetrics}
            onRunningChange={handleRunningChange}
          />

          <aside className="space-y-4" aria-label="Simulation controls">
            <ControlCard title="Presets" description="Selecting a preset resets particles and restores its matrix.">
              <div className="grid grid-cols-2 gap-2">
                {presetNames.map((presetName) => {
                  const preset = EMERGENT_LIFE_PRESETS[presetName];
                  const isSelected = selectedPreset === presetName;

                  return (
                    <button
                      key={presetName}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => applyPreset(presetName)}
                      className={
                        isSelected
                          ? 'min-h-14 rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-3 py-2 text-left text-sm font-semibold text-cyan-100'
                          : 'min-h-14 rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-left text-sm font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-white'
                      }
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                {EMERGENT_LIFE_PRESETS[selectedPreset].description}
              </p>
              {isMatrixCustomized && (
                <p className="mt-2 text-xs font-medium text-violet-300">
                  Matrix customized · Reset restores {EMERGENT_LIFE_PRESETS[selectedPreset].name}
                </p>
              )}
            </ControlCard>

            <ControlCard title="Playback" description="Physics keeps a fixed timestep; speed changes how quickly fixed steps accumulate.">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
                >
                  {metrics.isRunning ? 'Pause' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-11 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                >
                  Reset
                </button>
              </div>

              <RangeControl
                id="emergent-life-particle-count"
                label="Starting population"
                value={selectedParticleCount}
                displayValue={selectedParticleCount.toLocaleString()}
                minimum={250}
                maximum={2_000}
                step={50}
                onChange={handleParticleCountChange}
              />
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {hasPendingParticleCount
                  ? 'Applies on Reset or preset change; live count also reflects spawning and erasing.'
                  : 'Reset starts with this many particles; canvas tools can change the live count.'}
              </p>

              <RangeControl
                id="emergent-life-speed"
                label="Simulation speed"
                value={simulationSpeed}
                displayValue={`${simulationSpeed.toFixed(2)}×`}
                minimum={0.25}
                maximum={2}
                step={0.25}
                onChange={handleSpeedChange}
              />
            </ControlCard>

            <ControlCard title="Canvas tool" description="Drag directly over particles. Controls support mouse, touch, and pen.">
              <div className="grid grid-cols-2 gap-2">
                {interactionTools.map((tool) => (
                  <button
                    key={tool.value}
                    type="button"
                    aria-pressed={selectedTool === tool.value}
                    onClick={() => handleToolChange(tool.value)}
                    className={
                      selectedTool === tool.value
                        ? 'min-h-14 rounded-xl border border-violet-300/50 bg-violet-300/10 px-3 py-2 text-left text-sm font-semibold text-violet-100'
                        : 'min-h-14 rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-left text-sm font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-white'
                    }
                  >
                    <span className="block">{tool.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
                      {tool.description}
                    </span>
                  </button>
                ))}
              </div>

              {selectedTool === 'spawn' && (
                <fieldset className="mt-4">
                  <legend className="text-xs font-medium text-neutral-300">
                    Spawn species
                  </legend>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {speciesDetails.map((species) => (
                      <button
                        key={species.id}
                        type="button"
                        aria-pressed={spawnSpecies === species.id}
                        aria-label={`Spawn ${species.name} species`}
                        onClick={() => handleSpawnSpeciesChange(species.id)}
                        className={`flex min-h-11 items-center justify-center rounded-xl border transition ${
                          spawnSpecies === species.id
                            ? 'border-white bg-white/10'
                            : 'border-neutral-700 bg-neutral-950 hover:border-neutral-500'
                        }`}
                      >
                        <span
                          className={`h-3.5 w-3.5 rounded-full ${species.dotClassName}`}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <RangeControl
                id="emergent-life-brush-radius"
                label="Brush radius"
                value={brushRadius}
                displayValue={`${brushRadius}px`}
                minimum={40}
                maximum={160}
                step={5}
                onChange={handleBrushRadiusChange}
              />

              {(selectedTool === 'attract' || selectedTool === 'repel') && (
                <RangeControl
                  id="emergent-life-force-strength"
                  label="Force strength"
                  value={forceStrength}
                  displayValue={forceStrength.toLocaleString()}
                  minimum={300}
                  maximum={1_600}
                  step={50}
                  onChange={handleForceStrengthChange}
                />
              )}
            </ControlCard>
          </aside>
        </div>
      </section>

      <MatrixEditor matrix={matrix} onChange={handleMatrixChange} />

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}

function MatrixEditor({
  matrix,
  onChange,
}: {
  matrix: InteractionMatrix;
  onChange: (
    affectedSpecies: SpeciesId,
    neighborSpecies: SpeciesId,
    value: number,
  ) => void;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/45 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Directional interaction matrix
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Tune species attraction and repulsion
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Each row is the affected species; each column is the neighboring
            species. Positive values attract, negative values repel, and zero
            disables species-specific attraction. Short-range collision
            repulsion remains active.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-neutral-400" aria-label="Matrix value legend">
          <LegendItem colorClassName="bg-emerald-400" label="Positive · attract" />
          <LegendItem colorClassName="bg-neutral-500" label="Zero · neutral" />
          <LegendItem colorClassName="bg-rose-400" label="Negative · repel" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <table className="w-full min-w-[42rem] border-separate border-spacing-2">
          <caption className="sr-only">
            Editable directional interaction coefficients by affected and neighboring species
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 text-left text-xs font-medium text-neutral-500">
                Affected ↓ / Neighbor →
              </th>
              {speciesDetails.map((species) => (
                <th
                  key={species.id}
                  scope="col"
                  className="px-2 pb-1 text-center text-xs font-medium text-neutral-300"
                >
                  <SpeciesLabel species={species} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {speciesDetails.map((affectedSpecies) => (
              <tr key={affectedSpecies.id}>
                <th
                  scope="row"
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-left text-xs font-medium text-neutral-300"
                >
                  <SpeciesLabel species={affectedSpecies} />
                </th>
                {speciesDetails.map((neighborSpecies) => {
                  const value = matrix[affectedSpecies.id][neighborSpecies.id];
                  const tone = getInteractionTone(value);
                  const description = describeInteraction(value);

                  return (
                    <td key={neighborSpecies.id} className="p-0 text-center">
                      <label className="block">
                        <span className="sr-only">
                          {affectedSpecies.name} response to {neighborSpecies.name}: {description}
                        </span>
                        <input
                          type="number"
                          min={-2}
                          max={2}
                          step={0.05}
                          value={value}
                          onChange={(event) =>
                            onChange(
                              affectedSpecies.id,
                              neighborSpecies.id,
                              Number(event.target.value),
                            )
                          }
                          title={`${affectedSpecies.name} affected by ${neighborSpecies.name}: ${description}`}
                          className={`min-h-11 w-full rounded-xl border px-2 py-2 text-center text-sm font-medium outline-none transition focus:ring-2 focus:ring-white/30 ${interactionToneStyles[tone]}`}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ControlCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/55 p-4">
      <h4 className="font-semibold text-white">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RangeControl({
  id,
  label,
  value,
  displayValue,
  minimum,
  maximum,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  minimum: number;
  maximum: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-neutral-300">
          {label}
        </label>
        <output htmlFor={id} className="text-xs font-semibold text-white">
          {displayValue}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-cyan-300"
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-center backdrop-blur">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SpeciesLabel({
  species,
}: {
  species: (typeof speciesDetails)[number];
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: species.color }}
        aria-hidden="true"
      />
      {species.name}
    </span>
  );
}

function LegendItem({
  colorClassName,
  label,
}: {
  colorClassName: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${colorClassName}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
