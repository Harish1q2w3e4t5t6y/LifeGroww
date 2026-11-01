import { describe, it, expect } from "vitest";
import { addStroke, clearBoard, createHistory, fitScale, redo, undo } from "@/lib/notesBoard";

const a = [1, 1, 2, 2];
const b = [3, 3, 4, 4];

describe("notes board history", () => {
  it("undoes and redoes strokes in order", () => {
    const drawn = addStroke(addStroke(createHistory(), a), b);
    const undone = undo(drawn);
    expect(undone.present).toEqual([a]);
    expect(undo(undone).present).toEqual([]);
    expect(redo(undone).present).toEqual([a, b]);
  });

  it("drops redo steps once a new stroke is drawn", () => {
    const history = addStroke(undo(addStroke(createHistory(), a)), b);
    expect(history.present).toEqual([b]);
    expect(redo(history).present).toEqual([b]);
  });

  it("lets a clear be undone", () => {
    const cleared = clearBoard(addStroke(createHistory(), a));
    expect(cleared.present).toEqual([]);
    expect(undo(cleared).present).toEqual([a]);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const empty = createHistory();
    expect(undo(empty)).toBe(empty);
    expect(redo(empty)).toBe(empty);
    expect(clearBoard(empty)).toBe(empty);
  });
});

describe("fitScale", () => {
  it("keeps notes full size when they fit", () => {
    expect(fitScale([[100, 100]], 400, 800)).toBe(1);
  });

  it("shrinks notes drawn on a larger screen", () => {
    expect(fitScale([[1000, 200]], 500, 800)).toBe(0.5);
  });
});
