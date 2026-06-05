import { PathfindingVisualizerDemo } from '../components/demos/PathfindingVisualizerDemo';

export function PathfindingDemoPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Interactive Demo
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          Pathfinding Visualizer
        </h1>

        <p className="mt-5 max-w-3xl leading-7 text-neutral-400">
          Click cells to place or remove walls. The start and end nodes stay
          fixed for now. Next, we will add BFS to search through the grid.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <PathfindingVisualizerDemo />
      </section>
    </section>
  );
}