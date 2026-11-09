// One product: big photo and name. Without sizes: large − / + around the count.
// With sizes: every size and its count; tapping opens the size table.
import { Maximize2, Minus, Plus } from "lucide-react";
import type { StockItemWithPhoto } from "../lib/api";
import { hasSizes, itemLevel, itemTotal, sortedVariants, stockLevel } from "../lib/logic";

interface Props {
  item: StockItemWithPhoto;
  typeLabel?: string;
  onOpen: (item: StockItemWithPhoto) => void;
  onOpenSizes: (item: StockItemWithPhoto) => void;
  onTap: (item: StockItemWithPhoto, delta: number) => void;
  onViewPhoto: (src: string, title: string) => void;
}

const chipTone = { out: "bg-red-100 text-red-700", low: "bg-amber-100 text-amber-800", ok: "bg-stone-100 text-stone-800" };

export function ItemCard({ item, typeLabel, onOpen, onOpenSizes, onTap, onViewPhoto }: Props) {
  const sized = hasSizes(item);
  const level = itemLevel(item);
  const total = itemTotal(item);
  const allOut = total === 0;
  const outSizes = sized ? sortedVariants(item).filter((v) => v.quantity <= 0).length : 0;
  const badge = allOut ? "None" : level === "out" ? `${outSizes} size${outSizes === 1 ? "" : "s"} none` : level === "low" ? "Low" : null;
  const extra = [item.size, item.color].filter(Boolean).join(" · ");
  const open = () => (sized ? onOpenSizes(item) : onOpen(item));

  return (
    <div
      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-2 ${
        level === "out" ? "ring-red-300" : level === "low" ? "ring-amber-300" : "ring-transparent"
      }`}
    >
      <div className="relative">
        <button onClick={open} className="relative block w-full" aria-label={sized ? `Sizes of ${item.name}` : `Edit ${item.name}`}>
          {item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={item.name}
              loading="lazy"
              className={`aspect-square w-full object-cover ${allOut ? "grayscale opacity-60" : ""}`}
            />
          ) : (
            <div className="aspect-square w-full bg-stone-200" />
          )}
          {badge && (
            <span
              className={`absolute left-2 top-2 rounded-full px-3 py-1 text-sm font-bold text-white ${
                level === "out" ? "bg-red-600" : "bg-amber-500"
              }`}
            >
              {badge}
            </span>
          )}
        </button>
        {item.photoUrl && (
          <button
            aria-label={`See full photo of ${item.name}`}
            onClick={() => onViewPhoto(item.photoUrl!, item.name)}
            className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="px-3 pt-2 text-center">
        <div className="text-base font-semibold leading-tight">{item.name}</div>
        {(typeLabel || extra) && (
          <div className="mt-0.5 truncate text-xs text-stone-500">{[typeLabel, extra].filter(Boolean).join(" · ")}</div>
        )}
      </div>

      {sized ? (
        <button onClick={open} className="block w-full p-2 text-left" aria-label={`Change sizes of ${item.name}`}>
          <div className="flex flex-wrap justify-center gap-1">
            {sortedVariants(item).map((v) => (
              <span key={v.id} className={`rounded-lg px-2 py-1 text-sm font-semibold tabular-nums ${chipTone[stockLevel(v.quantity)]}`}>
                {v.label} <b>{v.quantity}</b>
              </span>
            ))}
          </div>
          <div className="mt-1 text-center text-sm text-stone-500">
            Total <b className="text-lg text-stone-900">{total}</b>
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-1 p-2">
          <button
            aria-label={`Take one ${item.name}`}
            onClick={() => onTap(item, -1)}
            disabled={item.quantity <= 0}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700 active:scale-95 disabled:opacity-30"
          >
            <Minus className="h-8 w-8" strokeWidth={3} />
          </button>
          <span className={`min-w-[2ch] text-center text-4xl font-extrabold tabular-nums ${allOut ? "text-red-600" : ""}`}>
            {item.quantity}
          </span>
          <button
            aria-label={`Add one ${item.name}`}
            onClick={() => onTap(item, +1)}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-100 text-teal-800 active:scale-95"
          >
            <Plus className="h-8 w-8" strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}
