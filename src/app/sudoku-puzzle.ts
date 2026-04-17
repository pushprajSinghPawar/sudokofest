export type Difficulty = 'easy' | 'medium' | 'hard';

export type PuzzleAssetEntry =
  | {
      puzzle?: unknown;
      solution?: unknown;
      difficulty?: unknown;
    }
  | unknown[];

export type NormalizedPuzzleEntry = {
  puzzle: string;
  solution: string;
  difficulty?: Difficulty;
};

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const FULL_MASK = 0b1111111110;

export function normalizePuzzleEntry(entry: PuzzleAssetEntry): NormalizedPuzzleEntry | null {
  const puzzle = readPuzzle(entry);
  const difficulty = readDifficulty(entry);
  const providedSolution = readSolution(entry);

  if (!puzzle || puzzle.length < 81) {
    return null;
  }

  const normalizedPuzzle = puzzle.slice(0, 81);
  const solution = providedSolution?.slice(0, 81) ?? solveSudoku(normalizedPuzzle);

  if (!solution || solution.length < 81) {
    return null;
  }

  return {
    puzzle: normalizedPuzzle,
    solution,
    difficulty,
  };
}

function readPuzzle(entry: PuzzleAssetEntry): string | null {
  const value = Array.isArray(entry) ? entry[0] : entry.puzzle;
  return typeof value === 'string' ? value.trim() : null;
}

function readSolution(entry: PuzzleAssetEntry): string | null {
  const value = Array.isArray(entry) ? entry[1] : entry.solution;

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length >= 81 ? trimmed : null;
}

function readDifficulty(entry: PuzzleAssetEntry): Difficulty | undefined {
  const value = Array.isArray(entry) ? entry.at(-1) : entry.difficulty;

  if (typeof value === 'number' && Number.isInteger(value)) {
    return DIFFICULTIES[value];
  }

  if (typeof value === 'string' && isDifficulty(value)) {
    return value;
  }

  return undefined;
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function solveSudoku(puzzle: string): string | null {
  const cells = puzzle.split('').map((digit) => Number(digit));
  const rows = Array<number>(9).fill(0);
  const cols = Array<number>(9).fill(0);
  const boxes = Array<number>(9).fill(0);
  const emptyCells: number[] = [];

  for (let index = 0; index < 81; index++) {
    const rawValue = puzzle[index] ?? '0';

    if (rawValue === '0' || rawValue === '.') {
      cells[index] = 0;
      emptyCells.push(index);
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 9) {
      return null;
    }

    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const bit = 1 << value;

    if ((rows[row] & bit) !== 0 || (cols[col] & bit) !== 0 || (boxes[box] & bit) !== 0) {
      return null;
    }

    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }

  return fillCells(cells, rows, cols, boxes, emptyCells) ? cells.join('') : null;
}

function fillCells(
  cells: number[],
  rows: number[],
  cols: number[],
  boxes: number[],
  emptyCells: number[],
): boolean {
  let bestOffset = -1;
  let bestMask = 0;
  let bestCount = 10;

  for (let offset = 0; offset < emptyCells.length; offset++) {
    const index = emptyCells[offset];

    if (cells[index] !== 0) {
      continue;
    }

    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const mask = FULL_MASK & ~(rows[row] | cols[col] | boxes[box]);
    const count = countBits(mask);

    if (count === 0) {
      return false;
    }

    if (count < bestCount) {
      bestOffset = offset;
      bestMask = mask;
      bestCount = count;
    }
  }

  if (bestOffset === -1) {
    return true;
  }

  const index = emptyCells[bestOffset];
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

  for (let value = 1; value <= 9; value++) {
    const bit = 1 << value;

    if ((bestMask & bit) === 0) {
      continue;
    }

    cells[index] = value;
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;

    if (fillCells(cells, rows, cols, boxes, emptyCells)) {
      return true;
    }

    cells[index] = 0;
    rows[row] &= ~bit;
    cols[col] &= ~bit;
    boxes[box] &= ~bit;
  }

  return false;
}

function countBits(value: number): number {
  let count = 0;
  let remaining = value;

  while (remaining !== 0) {
    remaining &= remaining - 1;
    count++;
  }

  return count;
}
