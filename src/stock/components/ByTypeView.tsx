// "By type" page: step through the types tree (Shirt → Formal → Full sleeve),
// with stock totals for each branch and the items filed at each level.
import { ChevronLeft, ChevronRight, FolderPlus, Pencil } from "lucide-react";
import type { StockItemWithPhoto } from "../lib/api";
import { visibleItems } from "../lib/logic";
import { branchSummary, categoryPath, childrenOf, itemsDirectlyIn, type Category, type CategoryIndex } from "../lib/tree";
import { ItemCard } from "./ItemCard";

interface Props {
  idx: CategoryIndex;
  items: StockItemWithPhoto[];
  at: string | null;
  setAt: (id: string | null) => void;
  onOpenItem: (item: StockItemWithPhoto) => void;
  onTap: (item: StockItemWithPhoto, delta: number) => void;
  onNewType: (parentId: string | null) => void;
  onEditType: (category: Category) => void;
}

export function ByTypeView({ idx, items, at, setAt, onOpenItem, onTap, onNewType, onEditType }: Props) {
  const path = categoryPath(idx, at);
  const here = path[path.length - 1] ?? null;
  const subs = childrenOf(idx, at);
  const direct = visibleItems(itemsDirectlyIn(idx, at, items), "", "all");
  const hereSummary = here ? branchSummary(idx, here.id, items) : null;

  return (
    <div>
      {/* Where am I: tap any part to jump back up */}
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-base">
        {at !== null && (
          <button aria-label="Back" onClick={() => setAt(here?.parent_id ?? null)} className="mr-1 rounded-full bg-white p-2 shadow-sm">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <button onClick={() => setAt(null)} className={`rounded-lg px-2 py-1 ${at === null ? "font-bold" : "text-teal-700 underline"}`}>
          All types
        </button>
        {path.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-stone-400" />
            <button
              onClick={() => setAt(c.id)}
              className={`rounded-lg px-2 py-1 ${i === path.length - 1 ? "font-bold" : "text-teal-700 underline"}`}
            >
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      {here && hereSummary && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
          <div>
            <div className="text-xl font-extrabold">{here.name}</div>
            <div className="text-sm text-stone-500">
              {hereSummary.pieces} pieces · {hereSummary.kinds} items
              {hereSummary.low > 0 && <span className="text-amber-700"> · {hereSummary.low} low</span>}
              {hereSummary.out > 0 && <span className="text-red-700"> · {hereSummary.out} none</span>}
            </div>
          </div>
          <button aria-label={`Change type ${here.name}`} onClick={() => onEditType(here)} className="rounded-full p-3 text-stone-500 hover:bg-stone-100">
            <Pencil className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Sub-types */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {subs.map((c) => {
          const s = branchSummary(idx, c.id, items);
          const subCount = childrenOf(idx, c.id).length;
          return (
            <div key={c.id} className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
              <button onClick={() => setAt(c.id)} className="block w-full text-left" aria-label={`Open ${c.name}`}>
                {s.coverPhotoUrl ? (
                  <img src={s.coverPhotoUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] w-full place-items-center bg-teal-50 text-4xl font-extrabold text-teal-700/60">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-1 text-lg font-bold leading-tight">
                    <span className="flex-1 truncate">{c.name}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
                  </div>
                  <div className="mt-0.5 text-sm text-stone-500">
                    {s.pieces} pcs{subCount > 0 && ` · ${subCount} ${subCount === 1 ? "type" : "types"}`}
                  </div>
                  {(s.low > 0 || s.out > 0) && (
                    <div className="mt-1 flex gap-1">
                      {s.out > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{s.out} none</span>}
                      {s.low > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{s.low} low</span>}
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
        <button
          onClick={() => onNewType(at)}
          className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-300 p-3 text-center font-semibold text-stone-600"
        >
          <FolderPlus className="h-8 w-8" />
          {here ? `New type inside “${here.name}”` : "New type"}
        </button>
      </div>

      {/* Items filed right here */}
      {direct.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
            {here ? `Items in ${here.name}` : "Items without a type"}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {direct.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={onOpenItem} onTap={onTap} />
            ))}
          </div>
        </>
      )}
      {here && direct.length === 0 && subs.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-stone-500 shadow-sm">
          Nothing in “{here.name}” yet. Tap <b>Add item</b> to add one here.
        </p>
      )}
    </div>
  );
}
