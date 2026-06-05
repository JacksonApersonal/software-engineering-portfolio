import { useState } from 'react';

type CellType = 'empty' | 'start' | 'end' | 'wall' | 'visited' | 'path';

type GridCell = {
  row: number;
  col: number;
  type: CellType;
};

type Position = {
  row: number;
  col: number;
};

type Algorithm = 'BFS' | 'Dijkstra' | 'A*';

const rowCount = 15;
const colCount = 25;

const startPosition: Position = { row: 7, col: 5 };
const endPosition: Position = { row: 7, col: 19 };

function createInitialGrid(): GridCell[][] {
  return Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: colCount }, (_, col) => {
      if (row === startPosition.row && col === startPosition.col) {
        return { row, col, type: 'start' };
      }

      if (row === endPosition.row && col === endPosition.col) {
        return { row, col, type: 'end' };
      }

      return { row, col, type: 'empty' };
    }),
  );
}

function getNeighbors(position: Position): Position[] {
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  return directions
    .map((direction) => ({
      row: position.row + direction.row,
      col: position.col + direction.col,
    }))
    .filter(
      (neighbor) =>
        neighbor.row >= 0 &&
        neighbor.row < rowCount &&
        neighbor.col >= 0 &&
        neighbor.col < colCount,
    );
}

function positionKey(position: Position) {
  return `${position.row}-${position.col}`;
}

function runBreadthFirstSearch(grid: GridCell[][]) {
  const queue: Position[] = [startPosition];
  const visited = new Set<string>([positionKey(startPosition)]);
  const previous = new Map<string, Position>();

  const visitedOrder: Position[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    if (current.row === endPosition.row && current.col === endPosition.col) {
      return {
        visitedOrder,
        path: buildPath(previous),
      };
    }

    const neighbors = getNeighbors(current);

    for (const neighbor of neighbors) {
      const key = positionKey(neighbor);
      const neighborCell = grid[neighbor.row][neighbor.col];

      if (visited.has(key) || neighborCell.type === 'wall') {
        continue;
      }

      visited.add(key);
      previous.set(key, current);

      if (neighborCell.type !== 'end') {
        visitedOrder.push(neighbor);
      }

      queue.push(neighbor);
    }
  }

  return {
    visitedOrder,
    path: [],
  };
}

function runDijkstra(grid: GridCell[][]) {
  const distances = new Map<string, number>();
  const previous = new Map<string, Position>();
  const unvisited: Position[] = [];
  const visitedOrder: Position[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const cell = grid[row][col];

      if (cell.type !== 'wall') {
        const position = { row, col };
        const key = positionKey(position);

        distances.set(key, Number.POSITIVE_INFINITY);
        unvisited.push(position);
      }
    }
  }

  distances.set(positionKey(startPosition), 0);

  while (unvisited.length > 0) {
    unvisited.sort(
      (a, b) =>
        (distances.get(positionKey(a)) ?? Number.POSITIVE_INFINITY) -
        (distances.get(positionKey(b)) ?? Number.POSITIVE_INFINITY),
    );

    const current = unvisited.shift();

    if (!current) {
      break;
    }

    const currentDistance =
      distances.get(positionKey(current)) ?? Number.POSITIVE_INFINITY;

    if (currentDistance === Number.POSITIVE_INFINITY) {
      break;
    }

    if (current.row === endPosition.row && current.col === endPosition.col) {
      return {
        visitedOrder,
        path: buildPath(previous),
      };
    }

    if (
      !(current.row === startPosition.row && current.col === startPosition.col)
    ) {
      visitedOrder.push(current);
    }

    const neighbors = getNeighbors(current);

    for (const neighbor of neighbors) {
      const neighborCell = grid[neighbor.row][neighbor.col];

      if (neighborCell.type === 'wall') {
        continue;
      }

      const neighborKey = positionKey(neighbor);
      const newDistance = currentDistance + 1;
      const oldDistance =
        distances.get(neighborKey) ?? Number.POSITIVE_INFINITY;

      if (newDistance < oldDistance) {
        distances.set(neighborKey, newDistance);
        previous.set(neighborKey, current);
      }
    }
  }

  return {
    visitedOrder,
    path: [],
  };
}

function buildPath(previous: Map<string, Position>) {
  const path: Position[] = [];
  let current: Position | undefined = endPosition;

  while (current) {
    const key = positionKey(current);
    const previousPosition = previous.get(key);

    if (!previousPosition) {
      break;
    }

    if (
      previousPosition.row === startPosition.row &&
      previousPosition.col === startPosition.col
    ) {
      break;
    }

    path.unshift(previousPosition);
    current = previousPosition;
  }

  return path;
}

export function PathfindingVisualizerDemo() {
  const [grid, setGrid] = useState<GridCell[][]>(() => createInitialGrid());
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState(
    'Place walls, then run BFS to find the shortest path.',
  );
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm>('BFS');

  function handleCellClick(row: number, col: number) {
    if (isRunning) {
      return;
    }

    setMessage('Grid updated. Run BFS to calculate a path.');

    setGrid((currentGrid) =>
      currentGrid.map((gridRow) =>
        gridRow.map((cell) => {
          if (cell.row !== row || cell.col !== col) {
            return cell;
          }

          if (cell.type === 'start' || cell.type === 'end') {
            return cell;
          }

          return {
            ...cell,
            type: cell.type === 'wall' ? 'empty' : 'wall',
          };
        }),
      ),
    );
  }

  function clearGrid() {
    if (isRunning) {
      return;
    }

    setGrid(createInitialGrid());
    setMessage('Grid reset. Place walls, then run BFS to find the shortest path.');
  }

  function clearPath() {
    if (isRunning) {
      return;
    }

    setGrid((currentGrid) => clearPathFromGrid(currentGrid));
    setMessage('Path cleared. Walls were preserved.');
  }

  function clearPathFromGrid(currentGrid: GridCell[][]) {
    return currentGrid.map((gridRow) =>
      gridRow.map((cell) => {
        if (cell.type === 'visited' || cell.type === 'path') {
          return {
            ...cell,
            type: 'empty' as CellType,
          };
        }

        return cell;
      }),
    );
  }

  function runSelectedAlgorithm() {
    if (isRunning) {
      return;
    }

    if (selectedAlgorithm === 'A*') {
      setMessage('A* is coming soon. BFS and Dijkstra are available now.');
      return;
    }

    const cleanedGrid = clearPathFromGrid(grid);

    const result =
      selectedAlgorithm === 'BFS'
        ? runBreadthFirstSearch(cleanedGrid)
        : runDijkstra(cleanedGrid);

    setIsRunning(true);
    setMessage(`Running ${selectedAlgorithm}...`);
    setGrid(cleanedGrid);

    animateSearch(result.visitedOrder, result.path);
  }

  function animateSearch(visitedOrder: Position[], path: Position[]) {
    visitedOrder.forEach((position, index) => {
      window.setTimeout(() => {
        setGrid((currentGrid) =>
          updateCellType(currentGrid, position, 'visited'),
        );

        if (index === visitedOrder.length - 1) {
          animatePath(path);
        }
      }, index * 25);
    });

    if (visitedOrder.length === 0) {
      animatePath(path);
    }
  }

  function animatePath(path: Position[]) {
    if (path.length === 0) {
      window.setTimeout(() => {
        setMessage('No path found. Try removing some walls.');
        setIsRunning(false);
      }, 300);

      return;
    }

    path.forEach((position, index) => {
      window.setTimeout(() => {
        setGrid((currentGrid) => updateCellType(currentGrid, position, 'path'));

        if (index === path.length - 1) {
          setMessage(
            `${selectedAlgorithm} found a path. Shortest path length: ${path.length} cells.`,
          );
          setIsRunning(false);
        }
      }, index * 40);
    });
  }

  function updateCellType(
    currentGrid: GridCell[][],
    position: Position,
    type: CellType,
  ) {
    return currentGrid.map((gridRow) =>
      gridRow.map((cell) => {
        if (cell.row !== position.row || cell.col !== position.col) {
          return cell;
        }

        if (cell.type === 'start' || cell.type === 'end' || cell.type === 'wall') {
          return cell;
        }

        return {
          ...cell,
          type,
        };
      }),
    );
  }

  return (
    <div className="mx-auto w-fit max-w-full space-y-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Interactive Grid Demo
          </h3>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Click cells to place or remove walls. Run BFS to visualize how the
            algorithm explores the grid and finds the shortest path.
          </p>

          <p className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-300">
            {message}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
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
                        'BFS selected. This finds the shortest path in an unweighted grid.',
                      );
                    } else if (algorithm === 'Dijkstra') {
                      setMessage(
                        'Dijkstra selected. This finds the shortest path by tracking distance costs.',
                      );
                    } else {
                      setMessage('A* selected. Implementation coming soon.');
                    }
                  }}
                  disabled={isRunning}
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
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${colCount}, 1.75rem)`,
            }}
          >
            {grid.flat().map((cell) => (
              <button
                key={`${cell.row}-${cell.col}`}
                type="button"
                onClick={() => handleCellClick(cell.row, cell.col)}
                className={`h-7 w-7 rounded-md border transition ${getCellClassName(
                  cell.type,
                )}`}
                aria-label={`Row ${cell.row}, column ${cell.col}, ${cell.type}`}
              />
            ))}
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

function getCellClassName(type: CellType) {
  switch (type) {
    case 'start':
      return 'border-white bg-white';
    case 'end':
      return 'border-neutral-500 bg-neutral-500';
    case 'wall':
      return 'border-rose-700 bg-rose-600';
    case 'visited':
      return 'border-sky-800 bg-sky-900';
    case 'path':
      return 'border-emerald-600 bg-emerald-500';
    case 'empty':
    default:
      return 'border-neutral-800 bg-neutral-950 hover:border-neutral-500 hover:bg-neutral-900';
  }
}