import {
  buildPath,
  colCount,
  endPosition,
  getManhattanDistance,
  getMovementCost,
  positionKey,
  rowCount,
  startPosition,
  type GridCell,
  type Position,
} from './pathfindingModel';

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

export function runBreadthFirstSearch(grid: GridCell[][]) {
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

      if (visited.has(key) || neighborCell.terrain === 'wall') {
        continue;
      }

      visited.add(key);
      previous.set(key, current);

      if (neighborCell.terrain !== 'end') {
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

export function runDijkstra(grid: GridCell[][]) {
  const distances = new Map<string, number>();
  const previous = new Map<string, Position>();
  const unvisited: Position[] = [];
  const visitedOrder: Position[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const cell = grid[row][col];

      if (cell.terrain !== 'wall') {
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

      if (neighborCell.terrain === 'wall') {
        continue;
      }

      const neighborKey = positionKey(neighbor);
      const newDistance = currentDistance + getMovementCost(neighborCell);
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

export function runAStar(grid: GridCell[][]) {
  const openSet: Position[] = [startPosition];

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const previous = new Map<string, Position>();
  const visited = new Set<string>();

  const visitedOrder: Position[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const cell = grid[row][col];

      if (cell.terrain !== 'wall') {
        const position = { row, col };
        const key = positionKey(position);

        gScore.set(key, Number.POSITIVE_INFINITY);
        fScore.set(key, Number.POSITIVE_INFINITY);
      }
    }
  }

  gScore.set(positionKey(startPosition), 0);
  fScore.set(
    positionKey(startPosition),
    getManhattanDistance(startPosition, endPosition),
  );

  while (openSet.length > 0) {
    openSet.sort(
      (a, b) =>
        (fScore.get(positionKey(a)) ?? Number.POSITIVE_INFINITY) -
        (fScore.get(positionKey(b)) ?? Number.POSITIVE_INFINITY),
    );

    const current = openSet.shift();

    if (!current) {
      break;
    }

    const currentKey = positionKey(current);

    if (visited.has(currentKey)) {
      continue;
    }

    visited.add(currentKey);

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

      if (neighborCell.terrain === 'wall') {
        continue;
      }

      const neighborKey = positionKey(neighbor);

      if (visited.has(neighborKey)) {
        continue;
      }

      const currentGScore =
        gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;

      const tentativeGScore = currentGScore + getMovementCost(neighborCell);
      const oldGScore =
        gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY;

      if (tentativeGScore < oldGScore) {
        previous.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(
          neighborKey,
          tentativeGScore + getManhattanDistance(neighbor, endPosition),
        );

        openSet.push(neighbor);
      }
    }
  }

  return {
    visitedOrder,
    path: [],
  };
}

