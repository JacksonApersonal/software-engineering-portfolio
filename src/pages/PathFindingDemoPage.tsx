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
          Place walls or weighted terrain, then compare how BFS, Dijkstra, and
          A* explore the grid. BFS minimizes moves, while Dijkstra and A*
          account for weighted traversal cost. The start and end nodes remain
          fixed.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <PathfindingVisualizerDemo />
      </section>
    </section>
  );
}
