// The size table inside "Add / Change item": each row is a size you type
// (L, M, 32, Free size…) and how many you have of it.
import { Minus, Plus, X } from "lucide-react";
import type { SizeDraft } from "../lib/api";

interface Props {
  sizes: SizeDraft[];
  onChange: (sizes: SizeDraft[]) => void;
  /** Labels that are empty or used twice, for red outlines. */
  badRows: Set<number>;
}

export function SizesEditor({ sizes, onChange, badRows }: Props) {
  const update = (i: number, patch: Partial<SizeDraft>) => onChange(sizes.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const total = sizes.reduce((sum, s) => sum + Math.max(0, s.quantity), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-stone-600">
        <span>Size</span>
        <span className="mr-12">How many</span>
      </div>
      <ul className="space-y-2">
        {sizes.map((s, i) => (
          <li key={s.id ?? `new-${i}`} className="flex items-center gap-2 rounded-2xl bg-stone-100 p-2">
            <input
              aria-label={`Size ${i + 1} name`}
              value={s.label}
              maxLength={40}
              autoFocus={!s.id && !s.label && i === sizes.length - 1}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="e.g. L"
              className={`w-20 min-w-0 flex-1 rounded-xl border bg-white px-3 py-3 text-lg font-bold outline-none focus:border-teal-700 ${
                badRows.has(i) ? "border-red-400" : "border-stone-300"
              }`}
            />
            <button
              aria-label={`One less ${s.label || "size"}`}
              onClick={() => update(i, { quantity: Math.max(0, s.quantity - 1) })}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-red-700 shadow-sm active:scale-95"
            >
              <Minus className="h-6 w-6" strokeWidth={3} />
            </button>
            <input
              aria-label={`${s.label || "Size"} quantity`}
              inputMode="numeric"
              value={s.quantity}
              onChange={(e) => update(i, { quantity: Math.min(99999, Number(e.target.value.replace(/\D/g, "")) || 0) })}
              className="w-14 bg-transparent text-center text-2xl font-extrabold tabular-nums outline-none"
            />
            <button
              aria-label={`One more ${s.label || "size"}`}
              onClick={() => update(i, { quantity: Math.min(99999, s.quantity + 1) })}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-teal-800 shadow-sm active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={3} />
            </button>
            <button
              aria-label={`Remove size ${s.label}`}
              onClick={() => onChange(sizes.filter((_, j) => j !== i))}
              className="grid h-10 w-8 shrink-0 place-items-center text-stone-400 hover:text-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => onChange([...sizes, { label: "", quantity: 1 }])}
          className="flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-teal-700 hover:bg-teal-50"
        >
          <Plus className="h-5 w-5" /> Add size
        </button>
        <span className="pr-2 text-stone-500">
          Total <b className="text-lg text-stone-900">{total}</b>
        </span>
      </div>
    </div>
  );
}
