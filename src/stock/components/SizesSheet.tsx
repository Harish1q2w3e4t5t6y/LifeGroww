// Size table for one product: big − / + on every size, for taking or adding stock.
import { useEffect } from "react";
import { Minus, Pencil, Plus, X } from "lucide-react";
import type { StockItemWithPhoto } from "../lib/api";
import { itemTotal, sortedVariants, stockLevel, type StockVariant } from "../lib/logic";

interface Props {
  item: StockItemWithPhoto;
  typeLabel: string;
  onTapSize: (item: StockItemWithPhoto, variant: StockVariant, delta: number) => void;
  onEdit: (item: StockItemWithPhoto) => void;
  onClose: () => void;
  onViewPhoto: (src: string, title: string) => void;
}

const rowTone = { out: "bg-red-50 ring-red-200", low: "bg-amber-50 ring-amber-200", ok: "bg-stone-50 ring-transparent" };

export function SizesSheet({ item, typeLabel, onTapSize, onEdit, onClose, onViewPhoto }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Sizes of ${item.name}`}
        className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          {item.photoUrl ? (
            <button aria-label={`See full photo of ${item.name}`} onClick={() => onViewPhoto(item.photoUrl!, item.name)} className="shrink-0">
              <img src={item.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            </button>
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-stone-200" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-tight">{item.name}</h2>
            {typeLabel && <p className="truncate text-sm text-stone-500">{typeLabel}</p>}
          </div>
          <button aria-label="Close" onClick={onClose} className="self-start rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="mb-2 flex justify-between px-2 text-sm font-semibold text-stone-500">
          <span>Size</span>
          <span>How many</span>
        </div>
        <ul className="space-y-2">
          {sortedVariants(item).map((v) => {
            const level = stockLevel(v.quantity);
            return (
              <li key={v.id} className={`flex items-center gap-2 rounded-2xl p-2 ring-2 ${rowTone[level]}`}>
                <span className="min-w-0 flex-1 truncate px-2 text-2xl font-extrabold">{v.label}</span>
                <button
                  aria-label={`Take one ${v.label}`}
                  onClick={() => onTapSize(item, v, -1)}
                  disabled={v.quantity <= 0}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700 active:scale-95 disabled:opacity-30"
                >
                  <Minus className="h-8 w-8" strokeWidth={3} />
                </button>
                <span className={`w-16 text-center text-3xl font-extrabold tabular-nums ${level === "out" ? "text-red-600" : ""}`}>
                  {v.quantity}
                </span>
                <button
                  aria-label={`Add one ${v.label}`}
                  onClick={() => onTapSize(item, v, +1)}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-800 active:scale-95"
                >
                  <Plus className="h-8 w-8" strokeWidth={3} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-stone-800 px-4 py-3 text-white">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-extrabold tabular-nums">{itemTotal(item)}</span>
        </div>

        <button
          onClick={() => onEdit(item)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-4 text-lg font-semibold text-stone-700"
        >
          <Pencil className="h-5 w-5" /> Change product, sizes or photo
        </button>
      </div>
    </div>
  );
}
