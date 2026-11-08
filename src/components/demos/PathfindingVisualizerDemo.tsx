import { useEffect, useId, useRef, useState } from 'react';
import {
  runAStar,
  runBreadthFirstSearch,
  runDijkstra,
} from './pathfindingAlgorithms';
import {
  applySearchVisualization,
  clearVisualization,
  colCount,
  createInitialGrid,
  editTerrain,
  getNextGridPosition,
  getPathMetrics,
  positionKey,
  rowCount,
  startPosition,
  updateCellVisualization,
  type CellDisplayType,
  type EditMode,
  type GridCell,
  type GridNavigationKey,
  type Position,
} from './pathfindingModel';

type Algorithm = 'BFS' | 'Dijkstra' | 'A*';

export function PathfindingVisualizerDemo() {
  const [grid, setGrid] = useState<GridCell[][]>(() => createInitialGrid());
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState(
    'Place walls, then run BFS to find the shortest path.',
  );
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm>('BFS');
  const [selectedEditMode, setSelectedEditMode] = useState<EditMode>('wall');
  const [activeGridPosition, setActiveGridPosition] =
    useState<Position>(startPosition);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const animationTimersRef = useRef<number[]>([]);
  const gridCellRefs = useRef(new Map<string, HTMLButtonElement>());
  const instructionsId = useId();

  useEffect(
    () => () => {
      animationTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      animationTimersRef.current = [];
    },
    [],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  function clearAnimationTimers() {
    animationTimersRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    animationTimersRef.current = [];
  }

  function scheduleAnimation(callback: () => void, delay: number) {
    const timerId = window.setTimeout(() => {
      animationTimersRef.current = animationTimersRef.current.filter(
        (activeTimerId) => activeTimerId !== timerId,
      );
      callback();
    }, delay);

    animationTimersRef.current.push(timerId);
  }

  function handleCellClick(row: number, col: number) {
    if (isRunning) {
      return;
    }

    const selectedCell = grid[row][col];

    if (selectedCell.terrain === 'start' || selectedCell.terrain === 'end') {
      setMessage('The start and end positions are fixed.');
      return;
    }

    setMessage(
      `${selectedEditMode === 'wall' ? 'Wall' : 'Weight'} terrain updated. Run an algorithm to calculate a path.`,
    );
    setGrid((currentGrid) =>
      editTerrain(currentGrid, { row, col }, selectedEditMode),
    );
  }

  function handleGridKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    position: Position,
  ) {
    if (!isGridNavigationKey(event.key)) {
      return;
    }

    event.preventDefault();
    const nextPosition = getNextGridPosition(position, event.key);
    setActiveGridPosition(nextPosition);
    gridCellRefs.current.get(positionKey(nextPosition))?.focus();
  }

  function getResultMessage(
    algorithm: Algorithm,
    searchGrid: GridCell[][],
    path: Position[],
  ) {
    if (path.length === 0) {
      return 'No path found. Try removing some walls.';
    }

    const { steps, weightedCost } = getPathMetrics(searchGrid, path);
    return `${algorithm} found a path. Steps: ${steps}. Weighted cost: ${weightedCost}.`;
  }

  function clearGrid() {
    if (isRunning) {
      return;
    }

    clearAnimationTimers();
    setGrid(createInitialGrid());
    setMessage('Grid reset. Place walls, then run BFS to find the shortest path.');
  }

  function clearPath() {
    if (isRunning) {
      return;
    }

    clearAnimationTimers();
    setGrid((currentGrid) => clearVisualization(currentGrid));
    setMessage('Path cleared. Walls and weights were preserved.');
  }

  function runSelectedAlgorithm() {
    if (isRunning) {
      return;
    }

    clearAnimationTimers();
    const cleanedGrid = clearVisualization(grid);

    const result =
      selectedAlgorithm === 'BFS'
        ? runBreadthFirstSearch(cleanedGrid)
        : selectedAlgorithm === 'Dijkstra'
          ? runDijkstra(cleanedGrid)
          : runAStar(cleanedGrid);

    if (prefersReducedMotion) {
      setGrid(
        applySearchVisualization(
          cleanedGrid,
          result.visitedOrder,
          result.path,
        ),
      );
      setMessage(
        getResultMessage(selectedAlgorithm, cleanedGrid, result.path),
      );
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    setMessage(`Running ${selectedAlgorithm}...`);
    setGrid(cleanedGrid);

    animateSearch(
      result.visitedOrder,
      result.path,
      cleanedGrid,
      selectedAlgorithm,
    );
  }

  function animateSearch(
    visitedOrder: Position[],
    path: Position[],
    searchGrid: GridCell[][],
    algorithm: Algorithm,
  ) {
    visitedOrder.forEach((position, index) => {
      scheduleAnimation(() => {
        setGrid((currentGrid) =>
          updateCellVisualization(currentGrid, position, 'visited'),
        );

        if (index === visitedOrder.length - 1) {
          animatePath(path, searchGrid, algorithm);
        }
      }, index * 25);
    });

    if (visitedOrder.length === 0) {
      animatePath(path, searchGrid, algorithm);
    }
  }

  function animatePath(
    path: Position[],
    searchGrid: GridCell[][],
    algorithm: Algorithm,
  ) {
    if (path.length === 0) {
      scheduleAnimation(() => {
        setMessage(getResultMessage(algorithm, searchGrid, path));
        setIsRunning(false);
      }, 300);

      return;
    }

    const pathToAnimate = path.slice(1, -1);
    const finishAnimation = () => {
      setMessage(getResultMessage(algorithm, searchGrid, path));
      setIsRunning(false);
    };

    if (pathToAnimate.length === 0) {
      scheduleAnimation(finishAnimation, 0);
      return;
    }

    pathToAnimate.forEach((position, index) => {
      scheduleAnimation(() => {
        setGrid((currentGrid) =>
          updateCellVisualization(currentGrid, position, 'path'),
        );

        if (index === pathToAnimate.length - 1) {
          finishAnimation();
        }
      }, index * 40);
    });
  }

  return (
    <div className="mx-auto w-fit max-w-full space-y-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Interactive Grid Demo
          </h3>

          <p
            id={instructionsId}
            className="mt-2 text-sm leading-6 text-neutral-400"
          >
            Choose Wall or Weight mode, then click or tap cells to edit terrain.
            Keyboard users can enter the grid once, move with the arrow keys,
            and press Enter or Space to edit the focused cell.
          </p>

          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-300"
          >
            {message}
          </p>

          <div
            role="group"
            aria-label="Pathfinding algorithm"
            className="mt-4 flex flex-wrap gap-2"
          >
            {(['BFS', 'Dijkstra', 'A*'] as Algorithm[]).map((algorithm) => {
              const isSelected = selectedAlgorithm === algorithm;

              return (
                <button
                  key={algorithm}
                  type="button"
                  onClick={() => {
                    if (isRunning) {
                      return;
                    }

                    setSelectedAlgorithm(algorithm);

                    if (algorithm === 'BFS') {
                      setMessage(
                        'BFS selected. It ignores weights and finds the shortest path by number of steps.',
                      );
                    } else if (algorithm === 'Dijkstra') {
                      setMessage(
                        'Dijkstra selected. It accounts for weighted cells and chooses the lowest-cost path.',
                      );
                    } else {
                      setMessage(
                        'A* selected. It uses distance cost plus a goal-distance estimate to search more directly.',
                      );
                    }
                  }}
                  disabled={isRunning}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400'
                      : 'rounded-xl border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:text-neutral-700'
                  }
                >
                  {algorithm}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Terrain editing mode"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-sm text-neutral-500">Edit mode:</span>
            {(['wall', 'weight'] as EditMode[]).map((editMode) => {
              const isSelected = selectedEditMode === editMode;
              const label = editMode === 'wall' ? 'Wall' : 'Weight';

              return (
                <button
                  key={editMode}
                  type="button"
                  onClick={() => {
                    if (isRunning) {
                      return;
                    }

                    setSelectedEditMode(editMode);
                    setMessage(`${label} editing mode selected.`);
                  }}
                  disabled={isRunning}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400'
                      : 'rounded-xl border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:text-neutral-700'
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runSelectedAlgorithm}
            disabled={isRunning}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {isRunning ? `Running ${selectedAlgorithm}...` : `Run ${selectedAlgorithm}`}
          </button>

          <button
            type="button"
            onClick={clearPath}
            disabled={isRunning}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
          >
            Clear Path
          </button>

          <button
            type="button"
            onClick={clearGrid}
            disabled={isRunning}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
          >
            Clear Grid
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
        <LegendItem label="Start" className="border border-white bg-white" />
        <LegendItem label="End" className="border border-neutral-500 bg-neutral-500" />
        <LegendItem label="Wall" className="border border-rose-700 bg-rose-600" />
        <LegendItem label="Weight" className="border border-amber-600 bg-amber-500" />
        <LegendItem label="Visited" className="border border-sky-800 bg-sky-900" />
        <LegendItem label="Path" className="border border-emerald-600 bg-emerald-500" />
        <LegendItem
          label="Empty"
          className="border border-neutral-700 bg-neutral-950"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
          <div
            role="grid"
            aria-label="Pathfinding terrain grid"
            aria-describedby={instructionsId}
            aria-rowcount={rowCount}
            aria-colcount={colCount}
            aria-busy={isRunning}
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${colCount}, 1.75rem)`,
            }}
          >
            {grid.flat().map((cell) => {
              const displayType = cell.visualization ?? cell.terrain;
              const terrainDescription = cell.visualization
                ? `, ${cell.terrain} terrain`
                : '';
              const isActiveCell =
                activeGridPosition.row === cell.row &&
                activeGridPosition.col === cell.col;
              const editDescription =
                cell.terrain === 'start' || cell.terrain === 'end'
                  ? ', fixed position'
                  : `, activate to toggle ${selectedEditMode} terrain`;

              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  role="gridcell"
                  aria-rowindex={cell.row + 1}
                  aria-colindex={cell.col + 1}
                >
                  <button
                    ref={(element) => {
                      const key = positionKey(cell);

                      if (element) {
                        gridCellRefs.current.set(key, element);
                      } else {
                        gridCellRefs.current.delete(key);
                      }
                    }}
                    type="button"
                    tabIndex={isActiveCell ? 0 : -1}
                    onFocus={() =>
                      setActiveGridPosition({ row: cell.row, col: cell.col })
                    }
                    onKeyDown={(event) =>
                      handleGridKeyDown(event, {
                        row: cell.row,
                        col: cell.col,
                      })
                    }
                    onClick={() => handleCellClick(cell.row, cell.col)}
                    aria-disabled={isRunning}
                    aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}, ${displayType}${terrainDescription}${editDescription}`}
                    className={`h-7 w-7 rounded-md border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${getCellClassName(
                      displayType,
                    )}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type LegendItemProps = {
  label: string;
  className: string;
};

function LegendItem({ label, className }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-4 w-4 rounded ${className}`} />
      <span>{label}</span>
    </div>
  );
}

function getCellClassName(type: CellDisplayType) {
  switch (type) {
    case 'start':
      return 'border-white bg-white';
    case 'end':
      return 'border-neutral-500 bg-neutral-500';
    case 'wall':
      return 'border-rose-700 bg-rose-600';
    case 'weight':
      return 'border-amber-600 bg-amber-500';
    case 'visited':
      return 'border-sky-800 bg-sky-900';
    case 'path':
      return 'border-emerald-600 bg-emerald-500';
    case 'empty':
    default:
      return 'border-neutral-800 bg-neutral-950 hover:border-neutral-500 hover:bg-neutral-900';
  }
}

function isGridNavigationKey(key: string): key is GridNavigationKey {
  return (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight'
  );
}
