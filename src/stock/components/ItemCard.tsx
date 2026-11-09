// One item: big photo, name, and large − / + buttons around the count.
import { Minus, Plus } from "lucide-react";
import type { StockItemWithPhoto } from "../lib/api";
import { stockLevel } from "../lib/logic";

interface Props {
  item: StockItemWithPhoto;
  typeLabel?: string;
  onOpen: (item: StockItemWithPhoto) => void;
  onTap: (item: StockItemWithPhoto, delta: number) => void;
}

export function ItemCard({ item, typeLabel, onOpen, onTap }: Props) {
  const level = stockLevel(item.quantity);
  const extra = [item.size, item.color].filter(Boolean).join(" · ");
  return (
    <div
      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-2 ${
        level === "out" ? "ring-red-300" : level === "low" ? "ring-amber-300" : "ring-transparent"
      }`}
    >
      <button onClick={() => onOpen(item)} className="relative block w-full" aria-label={`Edit ${item.name}`}>
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            className={`aspect-square w-full object-cover ${level === "out" ? "grayscale opacity-60" : ""}`}
          />
        ) : (
          <div className="aspect-square w-full bg-stone-200" />
        )}
        {level !== "ok" && (
          <span
            className={`absolute left-2 top-2 rounded-full px-3 py-1 text-sm font-bold text-white ${
              level === "out" ? "bg-red-600" : "bg-amber-500"
            }`}
          >
            {level === "out" ? "None" : "Low"}
          </span>
        )}
      </button>
      <div className="px-3 pt-2 text-center">
        <div className="text-base font-semibold leading-tight">{item.name}</div>
        {(typeLabel || extra) && (
          <div className="mt-0.5 truncate text-xs text-stone-500">{[typeLabel, extra].filter(Boolean).join(" · ")}</div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 p-2">
        <button
          aria-label={`Take one ${item.name}`}
          onClick={() => onTap(item, -1)}
          disabled={item.quantity <= 0}
          className="grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700 active:scale-95 disabled:opacity-30"
        >
          <Minus className="h-8 w-8" strokeWidth={3} />
        </button>
        <span className={`min-w-[2ch] text-center text-4xl font-extrabold tabular-nums ${level === "out" ? "text-red-600" : ""}`}>
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
    </div>
  );
}
