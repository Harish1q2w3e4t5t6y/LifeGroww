// A stroke is a flat list of board coordinates: [x0, y0, x1, y1, ...].
export type Stroke = number[];

export interface BoardHistory {
  past: Stroke[][];
  present: Stroke[];
  future: Stroke[][];
}

const MAX_UNDO_STEPS = 200;

export function createHistory(strokes: Stroke[] = []): BoardHistory {
  return { past: [], present: strokes, future: [] };
}

function commit(history: BoardHistory, present: Stroke[]): BoardHistory {
  return {
    past: [...history.past, history.present].slice(-MAX_UNDO_STEPS),
    present,
    future: [],
  };
}

export function addStroke(history: BoardHistory, stroke: Stroke): BoardHistory {
  return commit(history, [...history.present, stroke]);
}

export function clearBoard(history: BoardHistory): BoardHistory {
  return history.present.length === 0 ? history : commit(history, []);
}

export function undo(history: BoardHistory): BoardHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: BoardHistory): BoardHistory {
  const [next, ...future] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future };
}

// Notes written on a bigger screen shrink to fit a smaller one; nothing is
// ever scaled up, so handwriting keeps its size where there's room.
export function fitScale(strokes: Stroke[], width: number, height: number): number {
  let maxX = 0;
  let maxY = 0;
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length; i += 2) {
      maxX = Math.max(maxX, stroke[i]);
      maxY = Math.max(maxY, stroke[i + 1]);
    }
  }
  if (maxX === 0 || maxY === 0) return 1;
  return Math.min(1, width / maxX, height / maxY);
}
