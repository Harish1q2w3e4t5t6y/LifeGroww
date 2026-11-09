// Full-screen photo: the whole picture (not cropped), with zoom.
// Pinch with two fingers, double-tap, mouse wheel, or the + / − buttons.
// When zoomed in, drag to move around. ✕, Escape or tapping the dark edge closes it.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { clampZoom, MAX_ZOOM } from "../lib/logic";

interface Props {
  src: string;
  title?: string;
  onClose: () => void;
}

export function PhotoViewer({ src, title, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; panX: number; panY: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // The phone's Back button closes the photo instead of leaving the app.
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    history.pushState({ photoViewer: true }, "");
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const close = () => {
    if (pushed.current) history.back(); // fires popstate → onClose
    else onClose();
  };

  const zoomTo = (next: number) => {
    const s = clampZoom(next);
    setScale(s);
    if (s === 1) setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=") setScale((s) => clampZoom(s * 1.5));
      if (e.key === "-") setScale((s) => clampZoom(s / 1.5));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close() only reads refs
  }, []);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { dist, scale, panX: pan.x, panY: pan.y, x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety (keeps dragging smooth off the edge); never let it block zooming */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
    if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) zoomTo(scale > 1 ? 1 : 2.5); // double-tap
      lastTap.current = now;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length >= 2 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setScale(clampZoom((g.scale * dist) / g.dist));
    } else if (pts.length === 1 && scale > 1) {
      setPan({ x: g.panX + (pts[0].x - g.x), y: g.panY + (pts[0].y - g.y) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (scale <= 1) setPan({ x: 0, y: 0 });
    } else startGesture();
  };

  const onWheel = (e: React.WheelEvent) => zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));

  // Portal to <body> so it covers everything, even when opened from inside a sheet.
  return createPortal(
    <div role="dialog" aria-label={`Photo of ${title ?? "item"}`} className="fixed inset-0 z-50 flex flex-col bg-black text-white print:hidden">
      <div className="flex items-center gap-3 p-3">
        <span className="min-w-0 flex-1 truncate px-2 text-lg font-semibold">{title}</span>
        <button aria-label="Close photo" onClick={close} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 active:scale-95">
          <X className="h-7 w-7" />
        </button>
      </div>

      <div
        className="relative flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={(e) => {
          // A tap on the dark area around the photo (not zoomed) closes it.
          const r = imgRef.current?.getBoundingClientRect();
          const outside = r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
          if (scale === 1 && outside) close();
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={title ?? ""}
          draggable={false}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-75"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        />
      </div>

      <div className="flex items-center justify-center gap-3 p-4">
        <button
          aria-label="Zoom out"
          onClick={() => zoomTo(scale / 1.5)}
          disabled={scale <= 1}
          className="grid h-14 w-14 place-items-center rounded-full bg-white/15 active:scale-95 disabled:opacity-30"
        >
          <ZoomOut className="h-7 w-7" />
        </button>
        <button
          aria-label="Fit whole photo"
          onClick={() => zoomTo(1)}
          className="flex h-14 items-center gap-2 rounded-full bg-white/15 px-5 font-semibold tabular-nums active:scale-95"
        >
          <RotateCcw className="h-5 w-5" /> {Math.round(scale * 100)}%
        </button>
        <button
          aria-label="Zoom in"
          onClick={() => zoomTo(scale * 1.5)}
          disabled={scale >= MAX_ZOOM}
          className="grid h-14 w-14 place-items-center rounded-full bg-white/15 active:scale-95 disabled:opacity-30"
        >
          <ZoomIn className="h-7 w-7" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
