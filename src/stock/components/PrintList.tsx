// Only visible when printing (or "Save as PDF"): every item with its photo.
import { stockLevel, stockLevelLabel, visibleItems } from "../lib/logic";
import type { StockItemWithPhoto } from "../lib/api";

export function PrintList({ items, typeLabel }: { items: StockItemWithPhoto[]; typeLabel: (item: StockItemWithPhoto) => string }) {
  const sorted = visibleItems(items, "", "all").sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  return (
    <div className="hidden p-6 text-black print:block">
      <h1 className="text-2xl font-bold">Home Stock</h1>
      <p className="mb-4 text-sm">{new Date().toLocaleString()}</p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 pr-3">Photo</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Item</th>
            <th className="py-2 pr-3 text-right">Qty</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it) => (
            <tr key={it.id} className="break-inside-avoid border-b border-stone-300">
              <td className="py-2 pr-3">{it.photoUrl && <img src={it.photoUrl} alt="" className="h-16 w-16 rounded object-cover" />}</td>
              <td className="py-2 pr-3 text-sm">{typeLabel(it)}</td>
              <td className="py-2 pr-3 font-semibold">
                {it.name}
                {(it.size || it.color) && <div className="text-xs font-normal">{[it.size, it.color].filter(Boolean).join(" · ")}</div>}
              </td>
              <td className="py-2 pr-3 text-right text-xl font-bold">{it.quantity}</td>
              <td className="py-2">{stockLevelLabel(stockLevel(it.quantity))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
