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

  function handleCellClick(row: number, col: number) {
    if (isRunning) {
      return;
    }

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

  function runBfs() {
    if (isRunning) {
      return;
    }

    const cleanedGrid = clearPathFromGrid(grid);
    const result = runBreadthFirstSearch(cleanedGrid);

    setIsRunning(true);
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
    path.forEach((position, index) => {
      window.setTimeout(() => {
        setGrid((currentGrid) => updateCellType(currentGrid, position, 'path'));

        if (index === path.length - 1) {
          setIsRunning(false);
        }
      }, index * 40);
    });

    if (path.length === 0) {
      setIsRunning(false);
    }
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
    <div className="w-fit max-w-full space-y-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Interactive Grid Demo
          </h3>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Click cells to place or remove walls. Run BFS to visualize how the
            algorithm explores the grid and finds the shortest path.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runBfs}
            disabled={isRunning}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {isRunning ? 'Running BFS...' : 'Run BFS'}
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
        <div className="mx-auto inline-block w-max rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
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