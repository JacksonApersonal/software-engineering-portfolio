export type TerrainType = 'empty' | 'start' | 'end' | 'wall' | 'weight';

export type VisualizationType = 'visited' | 'path';

export type CellDisplayType = TerrainType | VisualizationType;

export type EditMode = 'wall' | 'weight';

export type GridNavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight';

export type GridCell = {
  row: number;
  col: number;
  terrain: TerrainType;
  visualization: VisualizationType | null;
};

export type Position = {
  row: number;
  col: number;
};

export const rowCount = 15;
export const colCount = 25;

export const startPosition: Position = { row: 7, col: 5 };
export const endPosition: Position = { row: 7, col: 19 };

export function createInitialGrid(): GridCell[][] {
  return Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: colCount }, (_, col) => {
      if (row === startPosition.row && col === startPosition.col) {
        return { row, col, terrain: 'start', visualization: null };
      }

      if (row === endPosition.row && col === endPosition.col) {
        return { row, col, terrain: 'end', visualization: null };
      }

      return { row, col, terrain: 'empty', visualization: null };
    }),
  );
}

export function positionKey(position: Position) {
  return `${position.row}-${position.col}`;
}

export function getMovementCost(cell: GridCell) {
  return cell.terrain === 'weight' ? 5 : 1;
}

export function getManhattanDistance(a: Position, b: Position) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function buildPath(
  previous: Map<string, Position>,
  start: Position = startPosition,
  end: Position = endPosition,
) {
  const path: Position[] = [end];
  let current = end;

  while (current.row !== start.row || current.col !== start.col) {
    const previousPosition = previous.get(positionKey(current));

    if (!previousPosition) {
      return [];
    }

    path.unshift(previousPosition);
    current = previousPosition;
  }

  return path;
}

export function getPathMetrics(grid: GridCell[][], path: Position[]) {
  return {
    steps: Math.max(path.length - 1, 0),
    weightedCost: path
      .slice(1)
      .reduce(
        (total, position) =>
          total + getMovementCost(grid[position.row][position.col]),
        0,
      ),
  };
}

export function clearVisualization(grid: GridCell[][]) {
  return grid.map((gridRow) =>
    gridRow.map((cell) =>
      cell.visualization ? { ...cell, visualization: null } : cell,
    ),
  );
}

export function editTerrain(
  grid: GridCell[][],
  position: Position,
  editMode: EditMode,
): GridCell[][] {
  return clearVisualization(grid).map((gridRow) =>
    gridRow.map((cell) => {
      if (cell.row !== position.row || cell.col !== position.col) {
        return cell;
      }

      if (cell.terrain === 'start' || cell.terrain === 'end') {
        return cell;
      }

      const terrain: TerrainType =
        cell.terrain === editMode ? 'empty' : editMode;

      return {
        ...cell,
        terrain,
      };
    }),
  );
}

export function getNextGridPosition(
  position: Position,
  key: GridNavigationKey,
) {
  switch (key) {
    case 'ArrowUp':
      return { ...position, row: Math.max(position.row - 1, 0) };
    case 'ArrowDown':
      return { ...position, row: Math.min(position.row + 1, rowCount - 1) };
    case 'ArrowLeft':
      return { ...position, col: Math.max(position.col - 1, 0) };
    case 'ArrowRight':
      return { ...position, col: Math.min(position.col + 1, colCount - 1) };
  }
}

export function updateCellVisualization(
  grid: GridCell[][],
  position: Position,
  visualization: VisualizationType,
) {
  return grid.map((gridRow) =>
    gridRow.map((cell) => {
      if (cell.row !== position.row || cell.col !== position.col) {
        return cell;
      }

      if (
        cell.terrain === 'start' ||
        cell.terrain === 'end' ||
        cell.terrain === 'wall'
      ) {
        return cell;
      }

      if (cell.terrain === 'weight' && visualization === 'visited') {
        return cell;
      }

      return { ...cell, visualization };
    }),
  );
}

export function applySearchVisualization(
  grid: GridCell[][],
  visitedOrder: Position[],
  path: Position[],
) {
  const visitedGrid = visitedOrder.reduce(
    (currentGrid, position) =>
      updateCellVisualization(currentGrid, position, 'visited'),
    clearVisualization(grid),
  );

  return path.slice(1, -1).reduce(
    (currentGrid, position) =>
      updateCellVisualization(currentGrid, position, 'path'),
    visitedGrid,
  );
}
