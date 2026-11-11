import { describe, expect, it } from 'vitest';
import {
  EMERGENT_LIFE_PRESETS,
  EmergentLifeSimulation,
  type InteractionMatrix,
  type ParticleBuffer,
  type ParticleInitialState,
  type SpeciesId,
} from './emergentLife';

const zeroMatrix = (): InteractionMatrix => [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

function createControlledSimulation(
  particles: ParticleInitialState[],
  matrix: InteractionMatrix = zeroMatrix(),
  overrides: Partial<{
    worldWidth: number;
    worldHeight: number;
    interactionRadius: number;
    repulsionRadius: number;
    interactionStrength: number;
    repulsionStrength: number;
  }> = {},
) {
  return new EmergentLifeSimulation({
    particles,
    matrix,
    options: {
      worldWidth: 200,
      worldHeight: 120,
      interactionRadius: 30,
      repulsionRadius: 5,
      interactionStrength: 100,
      repulsionStrength: 200,
      damping: 1,
      maxSpeed: 500,
      fixedTimeStep: 1 / 60,
      maxParticles: 2_000,
      ...overrides,
    },
  });
}

function snapshotParticles(particles: ParticleBuffer) {
  const count = particles.count;
  return {
    x: [...particles.x.slice(0, count)],
    y: [...particles.y.slice(0, count)],
    velocityX: [...particles.velocityX.slice(0, count)],
    velocityY: [...particles.velocityY.slice(0, count)],
    species: [...particles.species.slice(0, count)],
  };
}

function expectFiniteAndBounded(simulation: EmergentLifeSimulation) {
  const particles = simulation.getParticles();
  const options = simulation.getOptions();

  for (let index = 0; index < particles.count; index += 1) {
    expect(Number.isFinite(particles.x[index])).toBe(true);
    expect(Number.isFinite(particles.y[index])).toBe(true);
    expect(Number.isFinite(particles.velocityX[index])).toBe(true);
    expect(Number.isFinite(particles.velocityY[index])).toBe(true);
    expect(particles.x[index]).toBeGreaterThanOrEqual(0);
    expect(particles.x[index]).toBeLessThan(options.worldWidth);
    expect(particles.y[index]).toBeGreaterThanOrEqual(0);
    expect(particles.y[index]).toBeLessThan(options.worldHeight);
    expect(
      Math.hypot(
        particles.velocityX[index],
        particles.velocityY[index],
      ),
    ).toBeLessThanOrEqual(options.maxSpeed + 0.001);
  }
}

describe('Emergent Life initialization and presets', () => {
  it('creates reproducible particle state from a seed', () => {
    const first = new EmergentLifeSimulation({
      seed: 123_456,
      particleCount: 64,
    });
    const second = new EmergentLifeSimulation({
      seed: 123_456,
      particleCount: 64,
    });

    expect(snapshotParticles(first.getParticles())).toEqual(
      snapshotParticles(second.getParticles()),
    );

    first.step(20);
    second.step(20);

    expect(snapshotParticles(first.getParticles())).toEqual(
      snapshotParticles(second.getParticles()),
    );
  });

  it('provides four valid designed presets', () => {
    expect(Object.keys(EMERGENT_LIFE_PRESETS)).toEqual([
      'swarms',
      'orbits',
      'clusters',
      'chaos',
    ]);

    for (const presetName of Object.keys(
      EMERGENT_LIFE_PRESETS,
    ) as Array<keyof typeof EMERGENT_LIFE_PRESETS>) {
      const simulation = new EmergentLifeSimulation({ preset: presetName });
      expect(simulation.getParticles().count).toBe(
        EMERGENT_LIFE_PRESETS[presetName].particleCount,
      );
      expect(simulation.getMatrix()).toHaveLength(4);
      simulation.getMatrix().forEach((row) => expect(row).toHaveLength(4));
    }
  });
});

describe('Emergent Life forces and spatial queries', () => {
  it('uses positive matrix coefficients for attraction', () => {
    const matrix = zeroMatrix();
    matrix[0][1] = 1;
    matrix[1][0] = 1;
    const simulation = createControlledSimulation(
      [
        { x: 40, y: 60, species: 0 },
        { x: 55, y: 60, species: 1 },
      ],
      matrix,
    );

    simulation.step();
    const particles = simulation.getParticles();

    expect(particles.velocityX[0]).toBeGreaterThan(0);
    expect(particles.velocityX[1]).toBeLessThan(0);
  });

  it('applies near-field repulsion even without matrix attraction', () => {
    const simulation = createControlledSimulation([
      { x: 40, y: 60, species: 0 },
      { x: 42, y: 60, species: 1 },
    ]);

    simulation.step();
    const particles = simulation.getParticles();

    expect(particles.velocityX[0]).toBeLessThan(0);
    expect(particles.velocityX[1]).toBeGreaterThan(0);
  });

  it('keeps near-field repulsion dominant at maximum attraction', () => {
    const matrix = zeroMatrix();
    matrix[0][1] = 2;
    matrix[1][0] = 2;
    const simulation = createControlledSimulation(
      [
        { x: 40, y: 60, species: 0 },
        { x: 42, y: 60, species: 1 },
      ],
      matrix,
    );

    simulation.step();
    const particles = simulation.getParticles();

    expect(particles.velocityX[0]).toBeLessThan(0);
    expect(particles.velocityX[1]).toBeGreaterThan(0);
  });

  it('evaluates a wrapped particle pair once when the grid has one cell', () => {
    const matrix = zeroMatrix();
    matrix[0][1] = 1;
    matrix[1][0] = 1;
    const simulation = createControlledSimulation(
      [
        { x: 2, y: 10, species: 0 },
        { x: 12, y: 10, species: 1 },
      ],
      matrix,
      {
        worldWidth: 20,
        worldHeight: 20,
        interactionRadius: 30,
        repulsionRadius: 5,
      },
    );

    simulation.step();
    const particles = simulation.getParticles();
    const options = simulation.getOptions();
    const progress =
      (10 - options.repulsionRadius) /
      (options.interactionRadius - options.repulsionRadius);
    const band = 16 * progress * progress * (1 - progress) * (1 - progress);
    const expectedVelocity =
      options.interactionStrength * band * options.fixedTimeStep;

    expect(particles.velocityX[0]).toBeCloseTo(expectedVelocity, 5);
    expect(particles.velocityX[1]).toBeCloseTo(-expectedVelocity, 5);
  });

  it('updates interaction behavior when the matrix changes', () => {
    const particles: ParticleInitialState[] = [
      { x: 40, y: 60, species: 0 },
      { x: 55, y: 60, species: 1 },
    ];
    const simulation = createControlledSimulation(particles);

    simulation.step();
    expect(simulation.getParticles().velocityX[0]).toBe(0);

    const matrix = zeroMatrix();
    matrix[0][1] = -1;
    simulation.updateMatrix(matrix);
    simulation.reset({ particles });
    simulation.step();

    expect(simulation.getParticles().velocityX[0]).toBeLessThan(0);
  });

  it('ignores particles outside the spatial interaction radius', () => {
    const matrix = zeroMatrix();
    matrix[0][1] = 1;
    const simulation = createControlledSimulation(
      [
        { x: 20, y: 60, species: 0 },
        { x: 35, y: 60, species: 1 },
        { x: 100, y: 60, species: 1 },
      ],
      matrix,
    );

    simulation.step();
    const withNearNeighbor = simulation.getParticles().velocityX[0];

    const nearOnly = createControlledSimulation(
      [
        { x: 20, y: 60, species: 0 },
        { x: 35, y: 60, species: 1 },
      ],
      matrix,
    );
    nearOnly.step();

    expect(withNearNeighbor).toBeCloseTo(
      nearOnly.getParticles().velocityX[0],
      6,
    );
  });

  it('applies localized positive attraction and negative repulsion', () => {
    const simulation = createControlledSimulation([
      { x: 40, y: 60, species: 0 },
    ]);

    expect(simulation.applyLocalizedForce({ x: 60, y: 60 }, 120, 30)).toBe(1);
    expect(simulation.getParticles().velocityX[0]).toBeGreaterThan(0);

    simulation.reset({ particles: [{ x: 40, y: 60, species: 0 }] });
    simulation.applyLocalizedForce({ x: 60, y: 60 }, -120, 30);
    expect(simulation.getParticles().velocityX[0]).toBeLessThan(0);
  });
});

describe('Emergent Life boundaries and editing', () => {
  it('treats opposite wrapped edges as neighboring space', () => {
    const matrix = zeroMatrix();
    matrix[0][1] = 1;
    matrix[1][0] = 1;
    const simulation = createControlledSimulation(
      [
        { x: 1, y: 50, species: 0 },
        { x: 99, y: 50, species: 1 },
      ],
      matrix,
      {
        worldWidth: 100,
        worldHeight: 100,
        interactionRadius: 10,
        repulsionRadius: 1,
      },
    );

    simulation.step();
    const particles = simulation.getParticles();

    expect(particles.velocityX[0]).toBeLessThan(0);
    expect(particles.velocityX[1]).toBeGreaterThan(0);
    expectFiniteAndBounded(simulation);
  });

  it('spawns, wraps, and erases particles near a point', () => {
    const simulation = createControlledSimulation([], zeroMatrix(), {
      worldWidth: 100,
      worldHeight: 100,
    });

    expect(
      simulation.spawnNear(
        { x: 99, y: 50 },
        8,
        { radius: 0, species: 2, initialSpeed: 0 },
      ),
    ).toBe(8);
    expect(simulation.getParticles().count).toBe(8);
    expect([...simulation.getParticles().species.slice(0, 8)]).toEqual(
      Array<SpeciesId>(8).fill(2),
    );
    expect(simulation.eraseNear({ x: 1, y: 50 }, 3)).toBe(8);
    expect(simulation.getParticles().count).toBe(0);
  });
});

describe('Emergent Life numerical stability', () => {
  it('disperses a dense cluster while keeping every particle finite', () => {
    const particles = Array.from({ length: 96 }, (_, index) => {
      const angle = index * 2.399_963_229_728_653;
      const radius = 0.04 * Math.sqrt(index);
      return {
        x: 100 + Math.cos(angle) * radius,
        y: 60 + Math.sin(angle) * radius,
        species: (index % 4) as SpeciesId,
      };
    });
    const simulation = createControlledSimulation(particles, zeroMatrix(), {
      repulsionRadius: 12,
      repulsionStrength: 260,
    });

    simulation.step(90);
    expectFiniteAndBounded(simulation);

    const result = simulation.getParticles();
    const horizontalSpread =
      Math.max(...result.x.slice(0, result.count)) -
      Math.min(...result.x.slice(0, result.count));
    const verticalSpread =
      Math.max(...result.y.slice(0, result.count)) -
      Math.min(...result.y.slice(0, result.count));

    expect(horizontalSpread).toBeGreaterThan(30);
    expect(verticalSpread).toBeGreaterThan(30);
  });

  it('keeps a medium-large simulation finite and bounded', () => {
    const simulation = new EmergentLifeSimulation({
      preset: 'chaos',
      seed: 88,
      particleCount: 600,
    });

    simulation.step(120);
    expectFiniteAndBounded(simulation);
  });

  it('clamps malformed options, matrix values, and large step requests', () => {
    const matrix = zeroMatrix();
    matrix[0][0] = Number.POSITIVE_INFINITY;
    matrix[0][1] = 99;
    const simulation = new EmergentLifeSimulation({
      seed: Number.NaN,
      particleCount: 150,
      matrix,
      options: {
        worldWidth: Number.NaN,
        worldHeight: -1,
        interactionStrength: Number.POSITIVE_INFINITY,
        repulsionStrength: 100_000,
        damping: 5,
        maxSpeed: 100_000,
        fixedTimeStep: 100,
      },
    });

    expect(simulation.getMatrix()[0]).toEqual([0, 2, 0, 0]);
    simulation.step(5_000);
    expectFiniteAndBounded(simulation);
  });
});
