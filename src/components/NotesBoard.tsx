import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { PenLine, Redo2, Trash2, Undo2, X } from "lucide-react";
import { useSync } from "@/context/SyncContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  addStroke,
  clearBoard,
  createHistory,
  fitScale,
  redo,
  undo,
  type BoardHistory,
  type Stroke,
} from "@/lib/notesBoard";

const INK = "#111827";
const LINE_WIDTH = 2.5;
const SAVE_DELAY_MS = 1200;

function traceStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.beginPath();
  ctx.moveTo(stroke[0], stroke[1]);
  if (stroke.length === 2) {
    ctx.lineTo(stroke[0] + 0.01, stroke[1]);
  } else {
    // Curve through the midpoints so handwriting doesn't look jagged.
    for (let i = 2; i < stroke.length - 2; i += 2) {
      const midX = (stroke[i] + stroke[i + 2]) / 2;
      const midY = (stroke[i + 1] + stroke[i + 3]) / 2;
      ctx.quadraticCurveTo(stroke[i], stroke[i + 1], midX, midY);
    }
    ctx.lineTo(stroke[stroke.length - 2], stroke[stroke.length - 1]);
  }
  ctx.stroke();
}

export function NotesBoard() {
  const { pathname } = useLocation();
  const { user, isConfigured } = useAuth();
  const { settings, updateSetting } = useSync();

  const savedStrokes = (settings.notesBoard as { strokes?: Stroke[] } | undefined)?.strokes;
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<BoardHistory>(() => createHistory(savedStrokes));
  const [penHeld, setPenHeld] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(1);
  const strokesRef = useRef(history.present);
  const currentRef = useRef<Stroke | null>(null);
  const penHeldRef = useRef(false);
  const frameRef = useRef(0);
  const unsavedRef = useRef(false);
  const saveTimerRef = useRef<number>();

  strokesRef.current = history.present;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pixelScale = canvas.width / canvas.clientWidth || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(pixelScale * scaleRef.current, 0, 0, pixelScale * scaleRef.current, 0, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokesRef.current.forEach((stroke) => traceStroke(ctx, stroke));
    if (currentRef.current) traceStroke(ctx, currentRef.current);
  }, []);

  const requestPaint = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(paint);
  };

  const save = useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    if (!unsavedRef.current) return;
    unsavedRef.current = false;
    void updateSetting("notesBoard", { strokes: strokesRef.current });
  }, [updateSetting]);

  const change = useCallback(
    (update: (history: BoardHistory) => BoardHistory) => {
      setHistory((current) => {
        const next = update(current);
        if (next !== current) {
          unsavedRef.current = true;
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(save, SAVE_DELAY_MS);
        }
        return next;
      });
    },
    [save]
  );

  // Notes finish loading from the server after this component mounts.
  useEffect(() => {
    if (!open && !unsavedRef.current && savedStrokes) {
      setHistory((current) => (current.present === savedStrokes ? current : createHistory(savedStrokes)));
    }
  }, [open, savedStrokes]);

  useLayoutEffect(paint, [paint, history.present, open]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const canvas = canvasRef.current;
    if (!open || !area || !canvas) return;
    const resize = () => {
      const { width, height } = area.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      scaleRef.current = fitScale(strokesRef.current, width, height);
      paint();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(area);
    resize();
    return () => observer.disconnect();
  }, [open, paint]);

  const addPoint = (e: { clientX: number; clientY: number }) => {
    const stroke = currentRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!stroke || !rect) return;
    const x = Math.round(((e.clientX - rect.left) / scaleRef.current) * 10) / 10;
    const y = Math.round(((e.clientY - rect.top) / scaleRef.current) * 10) / 10;
    const lastX = stroke[stroke.length - 2];
    const lastY = stroke[stroke.length - 1];
    if (lastX === undefined || Math.hypot(x - lastX, y - lastY) >= 1) stroke.push(x, y);
  };

  const finishStroke = useCallback(() => {
    const stroke = currentRef.current;
    currentRef.current = null;
    if (stroke && stroke.length > 0) change((current) => addStroke(current, stroke));
  }, [change]);

  const liftPen = useCallback(() => {
    penHeldRef.current = false;
    setPenHeld(false);
    finishStroke();
  }, [finishStroke]);

  const startStroke = (e: PointerEvent<HTMLCanvasElement>) => {
    currentRef.current = [];
    addPoint(e);
    requestPaint();
  };

  // Touch and stylus draw on contact. There's no key on a phone, and a mouse
  // or trackpad only draws while A is held (see the key handlers below).
  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startStroke(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && penHeldRef.current && !currentRef.current) {
      startStroke(e);
      return;
    }
    if (!currentRef.current) return;
    e.nativeEvent.getCoalescedEvents?.().forEach(addPoint);
    addPoint(e);
    requestPaint();
  };

  const handlePointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== "mouse") finishStroke();
  };

  const handlePointerLeave = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse") finishStroke();
  };

  const close = useCallback(() => {
    liftPen();
    setOpen(false);
    save();
  }, [liftPen, save]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        change(e.shiftKey ? redo : undo);
      } else if (e.code === "KeyA" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) {
          penHeldRef.current = true;
          setPenHeld(true);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyA") liftPen();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Switching apps while holding A would otherwise never report the release.
    window.addEventListener("blur", liftPen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", liftPen);
    };
  }, [open, close, change, liftPen]);

  if (pathname === "/login" || (isConfigured && !user)) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-[38%] z-40 h-12 w-6 grid place-items-center rounded-l-lg border border-r-0 border-border/60 bg-card/70 text-foreground backdrop-blur-sm opacity-25 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        aria-label="Open notes"
        title="Notes"
      >
        <PenLine className="h-3.5 w-3.5" />
      </button>
    );
  }

  const toolClass =
    "h-10 w-10 sm:h-8 sm:w-8 grid place-items-center rounded-md hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="flex flex-col w-[94vw] h-[80dvh] sm:w-[75vw] sm:h-[75dvh] overflow-hidden rounded-xl bg-white text-neutral-700 shadow-2xl"
        role="dialog"
        aria-label="Notes"
      >
      <div className="flex items-center gap-1 px-2 h-12 border-b border-neutral-200 shrink-0">
        <button onClick={() => change(undo)} disabled={history.past.length === 0} className={toolClass} aria-label="Undo" title="Undo">
          <Undo2 className="h-5 w-5" />
        </button>
        <button onClick={() => change(redo)} disabled={history.future.length === 0} className={toolClass} aria-label="Redo" title="Redo">
          <Redo2 className="h-5 w-5" />
        </button>
        <button onClick={() => change(clearBoard)} disabled={history.present.length === 0} className={toolClass} aria-label="Clear all" title="Clear all">
          <Trash2 className="h-5 w-5" />
        </button>
        <p className="hidden [@media(pointer:fine)]:block ml-2 min-w-0 truncate text-xs text-neutral-500">
          {penHeld ? "Writing: let go of A to stop" : "Hold A and move one finger to write"}
        </p>
        <button onClick={close} className={`${toolClass} ml-auto`} aria-label="Close notes" title="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div ref={areaRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerLeave}
          className={cn("absolute inset-0 h-full w-full touch-none", penHeld && "cursor-crosshair")}
        />
      </div>
      </div>
    </div>,
    document.body
  );
}
