export const EMERGENT_LIFE_SPECIES_COUNT = 4 as const;

export type SpeciesId = 0 | 1 | 2 | 3;

export type InteractionRow = [number, number, number, number];

export type InteractionMatrix = [
  InteractionRow,
  InteractionRow,
  InteractionRow,
  InteractionRow,
];

export type SimulationPoint = {
  x: number;
  y: number;
};

export type ParticleInitialState = SimulationPoint & {
  velocityX?: number;
  velocityY?: number;
  species: SpeciesId;
};

export type ParticleBuffer = {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly velocityX: Float32Array;
  readonly velocityY: Float32Array;
  readonly species: Uint8Array;
};

export type EmergentLifeOptions = {
  worldWidth: number;
  worldHeight: number;
  interactionRadius: number;
  repulsionRadius: number;
  interactionStrength: number;
  repulsionStrength: number;
  damping: number;
  maxSpeed: number;
  fixedTimeStep: number;
  maxParticles: number;
};

export type EmergentLifePresetName =
  | 'swarms'
  | 'orbits'
  | 'clusters'
  | 'chaos';

export type EmergentLifePreset = {
  readonly name: string;
  readonly description: string;
  readonly seed: number;
  readonly particleCount: number;
  readonly options: Partial<EmergentLifeOptions>;
  readonly matrix: InteractionMatrix;
};

export type EmergentLifeResetOptions = {
  preset?: EmergentLifePresetName;
  seed?: number;
  particleCount?: number;
  options?: Partial<EmergentLifeOptions>;
  matrix?: InteractionMatrix;
  particles?: ParticleInitialState[];
};

export type SpawnOptions = {
  radius?: number;
  species?: SpeciesId;
  initialSpeed?: number;
};

const DEFAULT_OPTIONS: EmergentLifeOptions = {
  worldWidth: 1_000,
  worldHeight: 700,
  interactionRadius: 68,
  repulsionRadius: 18,
  interactionStrength: 36,
  repulsionStrength: 240,
  damping: 0.992,
  maxSpeed: 120,
  fixedTimeStep: 1 / 60,
  maxParticles: 3_000,
};

const DEFAULT_PARTICLE_COUNT = 1_000;
const MAX_PARTICLES_LIMIT = 10_000;
const MAX_STEPS_PER_CALL = 1_000;
const MAX_INTERACTION_COEFFICIENT = 2;

export const EMERGENT_LIFE_PRESETS: Readonly<
  Record<EmergentLifePresetName, EmergentLifePreset>
> = {
  swarms: {
    name: 'Swarms',
    description:
      'Balanced attraction and avoidance rules designed to encourage moving groups.',
    seed: 1_047,
    particleCount: 1_000,
    options: {
      interactionRadius: 64,
      interactionStrength: 34,
      repulsionStrength: 245,
      damping: 0.994,
    },
    matrix: [
      [0.62, -0.3, 0.2, -0.12],
      [-0.18, 0.58, -0.28, 0.24],
      [0.2, -0.22, 0.56, -0.3],
      [-0.26, 0.2, -0.12, 0.62],
    ],
  },
  orbits: {
    name: 'Orbits',
    description:
      'Asymmetric cyclic rules designed to encourage chasing and circulating motion.',
    seed: 2_091,
    particleCount: 900,
    options: {
      interactionRadius: 76,
      repulsionRadius: 19,
      interactionStrength: 40,
      repulsionStrength: 230,
      damping: 0.996,
      maxSpeed: 150,
    },
    matrix: [
      [0.1, 1.15, -0.55, -0.15],
      [-0.2, 0.1, 1.1, -0.5],
      [-0.5, -0.2, 0.1, 1.15],
      [1.1, -0.55, -0.2, 0.1],
    ],
  },
  clusters: {
    name: 'Clusters',
    description:
      'Strong same-species attraction designed to encourage separated groups.',
    seed: 3_119,
    particleCount: 1_200,
    options: {
      interactionRadius: 60,
      repulsionRadius: 18,
      interactionStrength: 34,
      repulsionStrength: 265,
      damping: 0.99,
    },
    matrix: [
      [0.9, -0.4, -0.28, -0.36],
      [-0.32, 0.86, -0.4, -0.24],
      [-0.24, -0.36, 0.92, -0.4],
      [-0.4, -0.24, -0.32, 0.86],
    ],
  },
  chaos: {
    name: 'Chaos',
    description:
      'Mixed asymmetric rules designed to produce less predictable transitions.',
    seed: 4_207,
    particleCount: 1_400,
    options: {
      interactionRadius: 68,
      repulsionRadius: 18,
      interactionStrength: 38,
      repulsionStrength: 280,
      damping: 0.995,
      maxSpeed: 165,
    },
    matrix: [
      [-0.15, 1, -0.65, 0.35],
      [0.55, -0.25, 0.9, -0.7],
      [-0.8, 0.4, 0.3, 0.95],
      [0.9, -0.6, 0.5, -0.2],
    ],
  },
};

export class EmergentLifeSimulation {
  private options: EmergentLifeOptions = { ...DEFAULT_OPTIONS };
  private matrix: InteractionMatrix = cloneMatrix(
    EMERGENT_LIFE_PRESETS.swarms.matrix,
  );
  private seed = EMERGENT_LIFE_PRESETS.swarms.seed;
  private randomState = this.seed;
  private count = 0;
  private x: Float32Array = new Float32Array(0);
  private y: Float32Array = new Float32Array(0);
  private velocityX: Float32Array = new Float32Array(0);
  private velocityY: Float32Array = new Float32Array(0);
  private species: Uint8Array = new Uint8Array(0);
  private forceX: Float32Array = new Float32Array(0);
  private forceY: Float32Array = new Float32Array(0);
  private nextParticle = new Int32Array(0);
  private cellHeads = new Int32Array(0);
  private gridColumns = 1;
  private gridRows = 1;
  private cellWidth = DEFAULT_OPTIONS.worldWidth;
  private cellHeight = DEFAULT_OPTIONS.worldHeight;
  private readonly nearbyCells = new Int32Array(9);
  private readonly particleView: {
    count: number;
    x: Float32Array;
    y: Float32Array;
    velocityX: Float32Array;
    velocityY: Float32Array;
    species: Uint8Array;
  } = {
    count: 0,
    x: this.x,
    y: this.y,
    velocityX: this.velocityX,
    velocityY: this.velocityY,
    species: this.species,
  };

  constructor(config: EmergentLifeResetOptions = { preset: 'swarms' }) {
    this.reset(config);
  }

  reset(config: EmergentLifeResetOptions = {}): void {
    const preset = config.preset
      ? EMERGENT_LIFE_PRESETS[config.preset]
      : undefined;
    const optionBase = preset
      ? normalizeOptions(preset.options, DEFAULT_OPTIONS)
      : this.options;

    this.options = normalizeOptions(config.options, optionBase);
    this.matrix = sanitizeMatrix(
      config.matrix ?? preset?.matrix ?? this.matrix,
    );
    this.seed = normalizeSeed(config.seed ?? preset?.seed ?? this.seed);
    this.randomState = this.seed;
    this.resizeCapacity(this.options.maxParticles);
    this.configureSpatialGrid();

    if (config.particles) {
      this.initializeFromStates(config.particles);
      return;
    }

    const requestedCount =
      config.particleCount ??
      preset?.particleCount ??
      (this.count > 0 ? this.count : DEFAULT_PARTICLE_COUNT);
    this.initializeRandomParticles(requestedCount);
  }

  step(iterations = 1): void {
    const stepCount = clampInteger(iterations, 1, MAX_STEPS_PER_CALL, 1);

    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      this.stepOnce();
    }
  }

  getParticles(): ParticleBuffer {
    return this.particleView;
  }

  getOptions(): Readonly<EmergentLifeOptions> {
    return { ...this.options };
  }

  getMatrix(): InteractionMatrix {
    return cloneMatrix(this.matrix);
  }

  updateMatrix(matrix: InteractionMatrix): void {
    this.matrix = sanitizeMatrix(matrix);
  }

  setOptions(options: Partial<EmergentLifeOptions>): void {
    this.options = normalizeOptions(options, this.options);
    this.resizeCapacity(this.options.maxParticles);

    if (this.count > this.options.maxParticles) {
      this.count = this.options.maxParticles;
    }

    for (let index = 0; index < this.count; index += 1) {
      this.x[index] = wrapCoordinate(
        finiteOr(this.x[index], 0),
        this.options.worldWidth,
      );
      this.y[index] = wrapCoordinate(
        finiteOr(this.y[index], 0),
        this.options.worldHeight,
      );
      this.clampParticleVelocity(index);
    }

    this.syncParticleView();
    this.configureSpatialGrid();
  }

  spawnNear(
    point: SimulationPoint,
    requestedCount: number,
    spawnOptions: SpawnOptions = {},
  ): number {
    const available = this.options.maxParticles - this.count;
    const spawnCount = clampInteger(requestedCount, 0, available, 0);
    const radius = clampFinite(
      spawnOptions.radius ?? 24,
      0,
      Math.max(this.options.worldWidth, this.options.worldHeight),
      24,
    );
    const initialSpeed = clampFinite(
      spawnOptions.initialSpeed ?? this.options.maxSpeed * 0.08,
      0,
      this.options.maxSpeed,
      0,
    );
    const fixedSpecies = isSpeciesId(spawnOptions.species)
      ? spawnOptions.species
      : undefined;
    const centerX = wrapCoordinate(
      finiteOr(point.x, this.options.worldWidth / 2),
      this.options.worldWidth,
    );
    const centerY = wrapCoordinate(
      finiteOr(point.y, this.options.worldHeight / 2),
      this.options.worldHeight,
    );

    for (let offset = 0; offset < spawnCount; offset += 1) {
      const index = this.count + offset;
      const angle = this.nextRandom() * Math.PI * 2;
      const distance = Math.sqrt(this.nextRandom()) * radius;
      const velocityAngle = this.nextRandom() * Math.PI * 2;
      const speed = this.nextRandom() * initialSpeed;

      this.x[index] = wrapCoordinate(
        centerX + Math.cos(angle) * distance,
        this.options.worldWidth,
      );
      this.y[index] = wrapCoordinate(
        centerY + Math.sin(angle) * distance,
        this.options.worldHeight,
      );
      this.velocityX[index] = Math.cos(velocityAngle) * speed;
      this.velocityY[index] = Math.sin(velocityAngle) * speed;
      this.species[index] =
        fixedSpecies ??
        (Math.floor(this.nextRandom() * EMERGENT_LIFE_SPECIES_COUNT) as SpeciesId);
    }

    this.count += spawnCount;
    this.syncParticleView();
    return spawnCount;
  }

  eraseNear(point: SimulationPoint, requestedRadius: number): number {
    const radius = clampFinite(
      requestedRadius,
      0,
      Math.max(this.options.worldWidth, this.options.worldHeight),
      0,
    );
    const centerX = wrapCoordinate(
      finiteOr(point.x, 0),
      this.options.worldWidth,
    );
    const centerY = wrapCoordinate(
      finiteOr(point.y, 0),
      this.options.worldHeight,
    );
    const radiusSquared = radius * radius;
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < this.count; readIndex += 1) {
      const deltaX = minimumImageDelta(
        this.x[readIndex] - centerX,
        this.options.worldWidth,
      );
      const deltaY = minimumImageDelta(
        this.y[readIndex] - centerY,
        this.options.worldHeight,
      );

      if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) {
        continue;
      }

      if (writeIndex !== readIndex) {
        this.copyParticle(readIndex, writeIndex);
      }
      writeIndex += 1;
    }

    const erasedCount = this.count - writeIndex;
    this.count = writeIndex;
    this.syncParticleView();
    return erasedCount;
  }

  applyLocalizedForce(
    point: SimulationPoint,
    requestedStrength: number,
    requestedRadius: number,
  ): number {
    const strength = clampFinite(requestedStrength, -10_000, 10_000, 0);
    const radius = clampFinite(
      requestedRadius,
      0,
      Math.max(this.options.worldWidth, this.options.worldHeight),
      0,
    );

    if (strength === 0 || radius === 0) {
      return 0;
    }

    const centerX = wrapCoordinate(
      finiteOr(point.x, 0),
      this.options.worldWidth,
    );
    const centerY = wrapCoordinate(
      finiteOr(point.y, 0),
      this.options.worldHeight,
    );
    const radiusSquared = radius * radius;
    let affectedCount = 0;

    for (let index = 0; index < this.count; index += 1) {
      let deltaX = minimumImageDelta(
        centerX - this.x[index],
        this.options.worldWidth,
      );
      let deltaY = minimumImageDelta(
        centerY - this.y[index],
        this.options.worldHeight,
      );
      let distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceSquared > radiusSquared) {
        continue;
      }

      if (distanceSquared < Number.EPSILON) {
        const direction = deterministicDirection(index);
        deltaX = direction.x;
        deltaY = direction.y;
        distanceSquared = 1;
      }

      const distance = Math.sqrt(distanceSquared);
      const falloff = smoothFalloff(distance / radius);
      const velocityChange =
        strength * falloff * this.options.fixedTimeStep;

      this.velocityX[index] += (deltaX / distance) * velocityChange;
      this.velocityY[index] += (deltaY / distance) * velocityChange;
      this.clampParticleVelocity(index);
      affectedCount += 1;
    }

    return affectedCount;
  }

  private stepOnce(): void {
    this.rebuildSpatialGrid();
    this.forceX.fill(0, 0, this.count);
    this.forceY.fill(0, 0, this.count);

    const interactionRadiusSquared =
      this.options.interactionRadius * this.options.interactionRadius;
    const interactionRange = Math.max(
      this.options.interactionRadius - this.options.repulsionRadius,
      Number.EPSILON,
    );

    for (let index = 0; index < this.count; index += 1) {
      const nearbyCellCount = this.collectNearbyCells(index);

      for (let cellIndex = 0; cellIndex < nearbyCellCount; cellIndex += 1) {
        let neighbor = this.cellHeads[this.nearbyCells[cellIndex]];

        while (neighbor !== -1) {
          if (neighbor > index) {
            let deltaX = minimumImageDelta(
              this.x[neighbor] - this.x[index],
              this.options.worldWidth,
            );
            let deltaY = minimumImageDelta(
              this.y[neighbor] - this.y[index],
              this.options.worldHeight,
            );
            let distanceSquared = deltaX * deltaX + deltaY * deltaY;

            if (distanceSquared < interactionRadiusSquared) {
              if (distanceSquared < Number.EPSILON) {
                deltaX = index < neighbor ? 0.0001 : -0.0001;
                deltaY = 0;
                distanceSquared = deltaX * deltaX;
              }

              const distance = Math.sqrt(distanceSquared);
              const inverseDistance = 1 / distance;
              let magnitudeForParticle: number;
              let magnitudeForNeighbor: number;

              if (distance < this.options.repulsionRadius) {
                const repulsionMagnitude =
                  -this.options.repulsionStrength *
                  smoothFalloff(distance / this.options.repulsionRadius);
                magnitudeForParticle = repulsionMagnitude;
                magnitudeForNeighbor = repulsionMagnitude;
              } else {
                const interactionProgress =
                  (distance - this.options.repulsionRadius) /
                  interactionRange;
                const interactionFalloff = smoothInteractionBand(
                  interactionProgress,
                );
                const interactionScale =
                  this.options.interactionStrength * interactionFalloff;

                magnitudeForParticle =
                  this.matrix[this.species[index]][this.species[neighbor]] *
                  interactionScale;
                magnitudeForNeighbor =
                  this.matrix[this.species[neighbor]][this.species[index]] *
                  interactionScale;
              }

              const directionX = deltaX * inverseDistance;
              const directionY = deltaY * inverseDistance;
              this.forceX[index] += directionX * magnitudeForParticle;
              this.forceY[index] += directionY * magnitudeForParticle;
              this.forceX[neighbor] -= directionX * magnitudeForNeighbor;
              this.forceY[neighbor] -= directionY * magnitudeForNeighbor;
            }
          }

          neighbor = this.nextParticle[neighbor];
        }
      }
    }

    const timeStep = this.options.fixedTimeStep;

    for (let index = 0; index < this.count; index += 1) {
      const nextVelocityX =
        (this.velocityX[index] + this.forceX[index] * timeStep) *
        this.options.damping;
      const nextVelocityY =
        (this.velocityY[index] + this.forceY[index] * timeStep) *
        this.options.damping;

      this.velocityX[index] = finiteOr(nextVelocityX, 0);
      this.velocityY[index] = finiteOr(nextVelocityY, 0);
      this.clampParticleVelocity(index);

      // The world is toroidal: particles wrap at edges, and force queries use
      // the matching minimum-image distance so opposite edges remain adjacent.
      this.x[index] = wrapCoordinate(
        this.x[index] + this.velocityX[index] * timeStep,
        this.options.worldWidth,
      );
      this.y[index] = wrapCoordinate(
        this.y[index] + this.velocityY[index] * timeStep,
        this.options.worldHeight,
      );
    }
  }

  private rebuildSpatialGrid(): void {
    this.cellHeads.fill(-1);

    for (let index = this.count - 1; index >= 0; index -= 1) {
      const cell = this.getCellIndex(this.x[index], this.y[index]);
      this.nextParticle[index] = this.cellHeads[cell];
      this.cellHeads[cell] = index;
    }
  }

  private collectNearbyCells(particleIndex: number): number {
    const column = Math.min(
      Math.floor(this.x[particleIndex] / this.cellWidth),
      this.gridColumns - 1,
    );
    const row = Math.min(
      Math.floor(this.y[particleIndex] / this.cellHeight),
      this.gridRows - 1,
    );
    let count = 0;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      const wrappedRow = positiveModulo(row + rowOffset, this.gridRows);

      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const wrappedColumn = positiveModulo(
          column + columnOffset,
          this.gridColumns,
        );
        const cell = wrappedRow * this.gridColumns + wrappedColumn;
        let isDuplicate = false;

        for (let index = 0; index < count; index += 1) {
          if (this.nearbyCells[index] === cell) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          this.nearbyCells[count] = cell;
          count += 1;
        }
      }
    }

    return count;
  }

  private getCellIndex(positionX: number, positionY: number): number {
    const column = Math.min(
      Math.floor(positionX / this.cellWidth),
      this.gridColumns - 1,
    );
    const row = Math.min(
      Math.floor(positionY / this.cellHeight),
      this.gridRows - 1,
    );

    return row * this.gridColumns + column;
  }

  private configureSpatialGrid(): void {
    this.gridColumns = Math.max(
      1,
      Math.floor(
        this.options.worldWidth / this.options.interactionRadius,
      ),
    );
    this.gridRows = Math.max(
      1,
      Math.floor(
        this.options.worldHeight / this.options.interactionRadius,
      ),
    );
    this.cellWidth = this.options.worldWidth / this.gridColumns;
    this.cellHeight = this.options.worldHeight / this.gridRows;
    this.cellHeads = new Int32Array(this.gridColumns * this.gridRows);
    this.cellHeads.fill(-1);
  }

  private initializeRandomParticles(requestedCount: number): void {
    this.count = clampInteger(
      requestedCount,
      0,
      this.options.maxParticles,
      DEFAULT_PARTICLE_COUNT,
    );
    const initialSpeed = this.options.maxSpeed * 0.08;

    for (let index = 0; index < this.count; index += 1) {
      const angle = this.nextRandom() * Math.PI * 2;
      const speed = this.nextRandom() * initialSpeed;

      this.x[index] = this.nextRandom() * this.options.worldWidth;
      this.y[index] = this.nextRandom() * this.options.worldHeight;
      this.velocityX[index] = Math.cos(angle) * speed;
      this.velocityY[index] = Math.sin(angle) * speed;
      this.species[index] = (index % EMERGENT_LIFE_SPECIES_COUNT) as SpeciesId;
    }

    this.syncParticleView();
  }

  private initializeFromStates(states: ParticleInitialState[]): void {
    this.count = Math.min(states.length, this.options.maxParticles);

    for (let index = 0; index < this.count; index += 1) {
      const state = states[index];
      this.x[index] = wrapCoordinate(
        finiteOr(state.x, 0),
        this.options.worldWidth,
      );
      this.y[index] = wrapCoordinate(
        finiteOr(state.y, 0),
        this.options.worldHeight,
      );
      this.velocityX[index] = finiteOr(state.velocityX ?? 0, 0);
      this.velocityY[index] = finiteOr(state.velocityY ?? 0, 0);
      this.species[index] = isSpeciesId(state.species) ? state.species : 0;
      this.clampParticleVelocity(index);
    }

    this.syncParticleView();
  }

  private resizeCapacity(requestedCapacity: number): void {
    const capacity = clampInteger(
      requestedCapacity,
      1,
      MAX_PARTICLES_LIMIT,
      DEFAULT_OPTIONS.maxParticles,
    );

    if (this.x.length === capacity) {
      return;
    }

    this.x = resizeFloatBuffer(this.x, capacity);
    this.y = resizeFloatBuffer(this.y, capacity);
    this.velocityX = resizeFloatBuffer(this.velocityX, capacity);
    this.velocityY = resizeFloatBuffer(this.velocityY, capacity);
    this.species = resizeSpeciesBuffer(this.species, capacity);
    this.forceX = new Float32Array(capacity);
    this.forceY = new Float32Array(capacity);
    this.nextParticle = new Int32Array(capacity);
    this.count = Math.min(this.count, capacity);
    this.syncParticleView();
  }

  private syncParticleView(): void {
    this.particleView.count = this.count;
    this.particleView.x = this.x;
    this.particleView.y = this.y;
    this.particleView.velocityX = this.velocityX;
    this.particleView.velocityY = this.velocityY;
    this.particleView.species = this.species;
  }

  private copyParticle(source: number, destination: number): void {
    this.x[destination] = this.x[source];
    this.y[destination] = this.y[source];
    this.velocityX[destination] = this.velocityX[source];
    this.velocityY[destination] = this.velocityY[source];
    this.species[destination] = this.species[source];
  }

  private clampParticleVelocity(index: number): void {
    let velocityX = finiteOr(this.velocityX[index], 0);
    let velocityY = finiteOr(this.velocityY[index], 0);
    const speedSquared = velocityX * velocityX + velocityY * velocityY;
    const maxSpeedSquared = this.options.maxSpeed * this.options.maxSpeed;

    if (!Number.isFinite(speedSquared)) {
      velocityX = 0;
      velocityY = 0;
    } else if (speedSquared > maxSpeedSquared) {
      const scale = this.options.maxSpeed / Math.sqrt(speedSquared);
      velocityX *= scale;
      velocityY *= scale;
    }

    this.velocityX[index] = velocityX;
    this.velocityY[index] = velocityY;
  }

  private nextRandom(): number {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}

export function createEmergentLifeSimulation(
  config?: EmergentLifeResetOptions,
): EmergentLifeSimulation {
  return new EmergentLifeSimulation(config);
}

function normalizeOptions(
  input: Partial<EmergentLifeOptions> | undefined,
  base: EmergentLifeOptions,
): EmergentLifeOptions {
  const worldWidth = clampFinite(
    input?.worldWidth ?? base.worldWidth,
    32,
    10_000,
    DEFAULT_OPTIONS.worldWidth,
  );
  const worldHeight = clampFinite(
    input?.worldHeight ?? base.worldHeight,
    32,
    10_000,
    DEFAULT_OPTIONS.worldHeight,
  );
  const maximumRadius = Math.max(2, Math.min(worldWidth, worldHeight) / 2);
  const interactionRadius = clampFinite(
    input?.interactionRadius ?? base.interactionRadius,
    2,
    maximumRadius,
    Math.min(DEFAULT_OPTIONS.interactionRadius, maximumRadius),
  );
  const repulsionRadius = clampFinite(
    input?.repulsionRadius ?? base.repulsionRadius,
    0.5,
    interactionRadius,
    Math.min(DEFAULT_OPTIONS.repulsionRadius, interactionRadius),
  );

  return {
    worldWidth,
    worldHeight,
    interactionRadius,
    repulsionRadius,
    interactionStrength: clampFinite(
      input?.interactionStrength ?? base.interactionStrength,
      0,
      1_000,
      DEFAULT_OPTIONS.interactionStrength,
    ),
    repulsionStrength: clampFinite(
      input?.repulsionStrength ?? base.repulsionStrength,
      0,
      2_000,
      DEFAULT_OPTIONS.repulsionStrength,
    ),
    damping: clampFinite(
      input?.damping ?? base.damping,
      0,
      1,
      DEFAULT_OPTIONS.damping,
    ),
    maxSpeed: clampFinite(
      input?.maxSpeed ?? base.maxSpeed,
      1,
      2_000,
      DEFAULT_OPTIONS.maxSpeed,
    ),
    fixedTimeStep: clampFinite(
      input?.fixedTimeStep ?? base.fixedTimeStep,
      1 / 240,
      1 / 15,
      DEFAULT_OPTIONS.fixedTimeStep,
    ),
    maxParticles: clampInteger(
      input?.maxParticles ?? base.maxParticles,
      1,
      MAX_PARTICLES_LIMIT,
      DEFAULT_OPTIONS.maxParticles,
    ),
  };
}

function sanitizeMatrix(matrix: InteractionMatrix): InteractionMatrix {
  return [0, 1, 2, 3].map((rowIndex) =>
    [0, 1, 2, 3].map((columnIndex) =>
      clampFinite(
        matrix[rowIndex]?.[columnIndex],
        -MAX_INTERACTION_COEFFICIENT,
        MAX_INTERACTION_COEFFICIENT,
        0,
      ),
    ),
  ) as InteractionMatrix;
}

function cloneMatrix(matrix: InteractionMatrix): InteractionMatrix {
  return matrix.map((row) => [...row]) as InteractionMatrix;
}

function resizeFloatBuffer(
  current: Float32Array,
  capacity: number,
): Float32Array {
  const next = new Float32Array(capacity);
  next.set(current.subarray(0, Math.min(current.length, capacity)));
  return next;
}

function resizeSpeciesBuffer(
  current: Uint8Array,
  capacity: number,
): Uint8Array {
  const next = new Uint8Array(capacity);
  next.set(current.subarray(0, Math.min(current.length, capacity)));
  return next;
}

function smoothFalloff(normalizedDistance: number): number {
  const clampedDistance = Math.min(Math.max(normalizedDistance, 0), 1);
  const remaining = 1 - clampedDistance;
  return remaining * remaining * (1 + 2 * clampedDistance);
}

function smoothInteractionBand(progress: number): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const band = clampedProgress * (1 - clampedProgress);
  return 16 * band * band;
}

function wrapCoordinate(value: number, size: number): number {
  return positiveModulo(value, size);
}

function minimumImageDelta(delta: number, size: number): number {
  if (delta > size / 2) {
    return delta - size;
  }

  if (delta < -size / 2) {
    return delta + size;
  }

  return delta;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function deterministicDirection(index: number): SimulationPoint {
  const angle = ((index * 0.618_033_988_75) % 1) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function normalizeSeed(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) >>> 0 : 1;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampFinite(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

function isSpeciesId(value: number | undefined): value is SpeciesId {
  return (
    Number.isInteger(value) &&
    value !== undefined &&
    value >= 0 &&
    value < EMERGENT_LIFE_SPECIES_COUNT
  );
}
