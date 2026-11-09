// The whole stock as an open/close tree with counts on every line:
// types → sub-types → products → sizes. ⊟ / ⊞ opens and closes a branch;
// tapping a name opens it (a type's page, or a product's size table).
import { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Minus, Plus } from "lucide-react";
import type { StockItemWithPhoto } from "../lib/api";
import { hasSizes, itemLevel, itemTotal, sortedVariants, stockLevel, visibleItems, type StockLevel } from "../lib/logic";
import { branchSummary, childrenOf, itemsDirectlyIn, type Category, type CategoryIndex } from "../lib/tree";

interface Props {
  idx: CategoryIndex;
  items: StockItemWithPhoto[];
  onOpenType: (id: string) => void;
  onOpenItem: (item: StockItemWithPhoto) => void;
  onOpenSizes: (item: StockItemWithPhoto) => void;
  onViewPhoto: (src: string, title: string) => void;
}

const OPEN_KEY = "arumugam-stock.tree-open.v1";

const countTone: Record<StockLevel, string> = {
  out: "bg-red-100 text-red-700",
  low: "bg-amber-100 text-amber-800",
  ok: "bg-teal-50 text-teal-800",
};

function Toggle({ isOpen, label, onToggle }: { isOpen: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={`${isOpen ? "Close" : "Open"} ${label}`}
      aria-expanded={isOpen}
      className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-stone-400 bg-white text-stone-600 active:scale-95"
    >
      {isOpen ? <Minus className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}

function Spacer() {
  return <span className="h-8 w-8 shrink-0" />;
}

function Count({ value, level }: { value: number; level: StockLevel }) {
  return <span className={`ml-2 shrink-0 rounded-lg px-2.5 py-1 text-base font-extrabold tabular-nums ${countTone[level]}`}>{value}</span>;
}

/** One line of the tree: a dashed elbow from the parent's line, then the content. */
function Row({ children, depth }: { children: React.ReactNode; depth: number }) {
  return (
    <div className="relative flex min-h-[3rem] items-center gap-2 py-1">
      {depth > 0 && <span aria-hidden className="absolute -left-4 top-1/2 w-4 border-t-2 border-dashed border-stone-300" />}
      {children}
    </div>
  );
}

/** Children of a line, hung off a dashed vertical rule under its ⊟ box. */
function Branch({ children }: { children: React.ReactNode }) {
  return <div className="ml-4 border-l-2 border-dashed border-stone-300 pl-4">{children}</div>;
}

function loadOpen(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function TreeView({ idx, items, onOpenType, onOpenItem, onOpenSizes, onViewPhoto }: Props) {
  // Start with every type open and products closed; remember changes for this visit.
  const allTypeKeys = useMemo(() => [...idx.byId.keys()].map((id) => `c:${id}`), [idx]);
  const [open, setOpen] = useState<Set<string>>(() => loadOpen() ?? new Set([...allTypeKeys, "c:none"]));
  const save = (next: Set<string>) => {
    setOpen(next);
    try {
      sessionStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };
  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save(next);
  };
  const expandAll = () =>
    save(new Set([...allTypeKeys, "c:none", ...items.filter(hasSizes).map((i) => `i:${i.id}`)]));
  const collapseAll = () => save(new Set());

  const topTypes = childrenOf(idx, null);
  const untyped = visibleItems(itemsDirectlyIn(idx, null, items), "", "all");



  const renderItem = (item: StockItemWithPhoto, depth: number) => {
    const sized = hasSizes(item);
    const k = `i:${item.id}`;
    return (
      <div key={item.id}>
        <Row depth={depth}>
          {sized ? <Toggle isOpen={open.has(k)} label={item.name} onToggle={() => toggle(k)} /> : <Spacer />}
          {item.photoUrl && (
            <button aria-label={`See full photo of ${item.name}`} onClick={() => onViewPhoto(item.photoUrl!, item.name)} className="shrink-0">
              <img src={item.photoUrl} alt="" loading="lazy" className="h-9 w-9 rounded-lg object-cover" />
            </button>
          )}
          <button
            onClick={() => (sized ? onOpenSizes(item) : onOpenItem(item))}
            className="min-w-0 flex-1 truncate py-2 text-left text-lg font-semibold text-stone-800 underline-offset-4 active:underline"
          >
            {item.name}
          </button>
          <Count value={itemTotal(item)} level={itemLevel(item)} />
        </Row>
        {sized && open.has(k) && (
          <Branch>
            {sortedVariants(item).map((v) => (
              <Row key={v.id} depth={depth + 1}>
                <button onClick={() => onOpenSizes(item)} className="min-w-0 flex-1 truncate py-2 text-left text-lg text-stone-700">
                  {v.label}
                </button>
                <Count value={v.quantity} level={stockLevel(v.quantity)} />
              </Row>
            ))}
          </Branch>
        )}
      </div>
    );
  };

  const renderType = (c: Category, depth: number): React.ReactNode => {
    const k = `c:${c.id}`;
    const subs = childrenOf(idx, c.id);
    const direct = visibleItems(itemsDirectlyIn(idx, c.id, items), "", "all");
    const s = branchSummary(idx, c.id, items);
    const hasKids = subs.length + direct.length > 0;
    return (
      <div key={c.id}>
        <Row depth={depth}>
          {hasKids ? <Toggle isOpen={open.has(k)} label={c.name} onToggle={() => toggle(k)} /> : <Spacer />}
          <button
            onClick={() => onOpenType(c.id)}
            className={`min-w-0 flex-1 truncate py-2 text-left font-bold text-stone-900 underline-offset-4 active:underline ${
              depth === 0 ? "text-xl" : "text-lg"
            }`}
          >
            {c.name}
          </button>
          {(s.out > 0 || s.low > 0) && (
            <span
              title={s.out > 0 ? `${s.out} out of stock` : `${s.low} running low`}
              aria-label={s.out > 0 ? `${s.out} out of stock` : `${s.low} running low`}
              className={`h-3 w-3 shrink-0 rounded-full ${s.out > 0 ? "bg-red-600" : "bg-amber-500"}`}
            />
          )}
          <Count value={s.pieces} level="ok" />
        </Row>
        {hasKids && open.has(k) && (
          <Branch>
            {subs.map((sub) => renderType(sub, depth + 1))}
            {direct.map((it) => renderItem(it, depth + 1))}
          </Branch>
        )}
      </div>
    );
  };

  if (topTypes.length === 0 && untyped.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center text-stone-500 shadow-sm">No types yet. Tap <b>New type</b> to start, e.g. “T-shirt”.</p>;
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex justify-end gap-2">
        <button onClick={expandAll} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">
          <ChevronsUpDown className="h-4 w-4" /> Open all
        </button>
        <button onClick={collapseAll} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-stone-500 hover:bg-stone-100">
          <ChevronsDownUp className="h-4 w-4" /> Close all
        </button>
      </div>
      {topTypes.map((c) => renderType(c, 0))}
      {untyped.length > 0 && (
        <div>
          <Row depth={0}>
            <Toggle isOpen={open.has("c:none")} label="No type" onToggle={() => toggle("c:none")} />
            <span className="flex-1 py-2 text-xl font-bold italic text-stone-500">No type</span>
            <Count value={untyped.reduce((n, i) => n + itemTotal(i), 0)} level="ok" />
          </Row>
          {open.has("c:none") && <Branch>{untyped.map((it) => renderItem(it, 1))}</Branch>}
        </div>
      )}
    </div>
  );
}
