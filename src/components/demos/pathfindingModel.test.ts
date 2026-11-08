import { describe, expect, it } from 'vitest';
import {
  runAStar,
  runBreadthFirstSearch,
  runDijkstra,
} from './pathfindingAlgorithms';
import {
  applySearchVisualization,
  buildPath,
  clearVisualization,
  createInitialGrid,
  editTerrain,
  endPosition,
  getNextGridPosition,
  getPathMetrics,
  positionKey,
  startPosition,
  updateCellVisualization,
  type GridCell,
  type Position,
} from './pathfindingModel';

describe('terrain editing and grid navigation', () => {
  it('uses explicit wall and weight modes and toggles the selected terrain', () => {
    const position = { row: 4, col: 4 };
    const initialGrid = createInitialGrid();

    const wallGrid = editTerrain(initialGrid, position, 'wall');
    const weightGrid = editTerrain(wallGrid, position, 'weight');
    const clearedGrid = editTerrain(weightGrid, position, 'weight');

    expect(wallGrid[position.row][position.col].terrain).toBe('wall');
    expect(weightGrid[position.row][position.col].terrain).toBe('weight');
    expect(clearedGrid[position.row][position.col].terrain).toBe('empty');
  });

  it('does not edit the fixed start or end cells', () => {
    const grid = createInitialGrid();

    const editedStart = editTerrain(grid, startPosition, 'wall');
    const editedEnd = editTerrain(grid, endPosition, 'weight');

    expect(editedStart[startPosition.row][startPosition.col].terrain).toBe(
      'start',
    );
    expect(editedEnd[endPosition.row][endPosition.col].terrain).toBe('end');
  });

  it('moves focus with arrow keys while staying inside grid boundaries', () => {
    expect(getNextGridPosition({ row: 0, col: 0 }, 'ArrowUp')).toEqual({
      row: 0,
      col: 0,
    });
    expect(getNextGridPosition({ row: 0, col: 0 }, 'ArrowLeft')).toEqual({
      row: 0,
      col: 0,
    });
    expect(getNextGridPosition({ row: 0, col: 0 }, 'ArrowRight')).toEqual({
      row: 0,
      col: 1,
    });
    expect(getNextGridPosition({ row: 0, col: 1 }, 'ArrowDown')).toEqual({
      row: 1,
      col: 1,
    });
  });

  it('applies immediate search results without changing underlying terrain', () => {
    const grid = createInitialGrid();
    const weightedPosition = { row: 7, col: 10 };
    grid[weightedPosition.row][weightedPosition.col] = {
      ...grid[weightedPosition.row][weightedPosition.col],
      terrain: 'weight',
    };

    const resultGrid = applySearchVisualization(
      grid,
      [{ row: 7, col: 9 }],
      [startPosition, weightedPosition, endPosition],
    );

    expect(resultGrid[7][9].visualization).toBe('visited');
    expect(resultGrid[weightedPosition.row][weightedPosition.col]).toMatchObject({
      terrain: 'weight',
      visualization: 'path',
    });
  });
});

describe('path reconstruction and metrics', () => {
  it('treats adjacent start and end nodes as a one-step path', () => {
    const start = { row: 0, col: 0 };
    const end = { row: 0, col: 1 };
    const previous = new Map<string, Position>([[positionKey(end), start]]);
    const grid: GridCell[][] = [[
      { ...start, terrain: 'start', visualization: null },
      { ...end, terrain: 'end', visualization: null },
    ]];

    const path = buildPath(previous, start, end);

    expect(path).toEqual([start, end]);
    expect(getPathMetrics(grid, path)).toEqual({ steps: 1, weightedCost: 1 });
  });

  it('reports moves separately from weighted traversal cost', () => {
    const grid: GridCell[][] = [[
      { row: 0, col: 0, terrain: 'start', visualization: null },
      { row: 0, col: 1, terrain: 'weight', visualization: null },
      { row: 0, col: 2, terrain: 'end', visualization: null },
    ]];
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];

    expect(getPathMetrics(grid, path)).toEqual({ steps: 2, weightedCost: 6 });
  });
});

describe('terrain preservation', () => {
  it('restores weighted terrain after clearing a displayed path', () => {
    const grid = createInitialGrid();
    const weightedPosition = { row: 7, col: 10 };
    grid[weightedPosition.row][weightedPosition.col] = {
      ...grid[weightedPosition.row][weightedPosition.col],
      terrain: 'weight',
    };

    const visualizedGrid = updateCellVisualization(
      grid,
      weightedPosition,
      'path',
    );
    const clearedGrid = clearVisualization(visualizedGrid);

    expect(
      visualizedGrid[weightedPosition.row][weightedPosition.col],
    ).toMatchObject({
      terrain: 'weight',
      visualization: 'path',
    });
    expect(
      clearedGrid[weightedPosition.row][weightedPosition.col],
    ).toMatchObject({
      terrain: 'weight',
      visualization: null,
    });
  });
});

describe('pathfinding algorithms', () => {
  it('lets BFS minimize steps while Dijkstra and A* minimize weighted cost', () => {
    const grid = createInitialGrid();

    for (let col = startPosition.col + 1; col < endPosition.col; col += 1) {
      grid[startPosition.row][col] = {
        ...grid[startPosition.row][col],
        terrain: 'weight',
      };
    }

    const bfsMetrics = getPathMetrics(grid, runBreadthFirstSearch(grid).path);
    const dijkstraMetrics = getPathMetrics(grid, runDijkstra(grid).path);
    const aStarMetrics = getPathMetrics(grid, runAStar(grid).path);

    expect(bfsMetrics).toEqual({ steps: 14, weightedCost: 66 });
    expect(dijkstraMetrics).toEqual({ steps: 16, weightedCost: 16 });
    expect(aStarMetrics).toEqual({ steps: 16, weightedCost: 16 });
  });

  it.each([
    ['BFS', runBreadthFirstSearch],
    ['Dijkstra', runDijkstra],
    ['A*', runAStar],
  ])('returns no path when the target is enclosed for %s', (_name, runSearch) => {
    const grid = createInitialGrid();
    const surroundingPositions = [
      { row: endPosition.row - 1, col: endPosition.col },
      { row: endPosition.row + 1, col: endPosition.col },
      { row: endPosition.row, col: endPosition.col - 1 },
      { row: endPosition.row, col: endPosition.col + 1 },
    ];

    surroundingPositions.forEach((position) => {
      grid[position.row][position.col] = {
        ...grid[position.row][position.col],
        terrain: 'wall',
      };
    });

    expect(runSearch(grid).path).toEqual([]);
  });
});
