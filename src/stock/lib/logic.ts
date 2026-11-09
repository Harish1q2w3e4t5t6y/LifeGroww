// Home Stock — pure helpers (no network), unit-tested in src/stock/stock.test.ts.

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  photo_path: string;
  created_at: string;
  updated_at: string;
  category_id?: string | null;
  price?: number | string | null; // Postgres numeric arrives as a string
  size?: string | null;
  color?: string | null;
  notes?: string | null;
}

/** 1 or 2 left counts as "running low". */
export const LOW_AT = 2;

export type StockLevel = "out" | "low" | "ok";
export type StockFilter = "all" | StockLevel;

export function stockLevel(quantity: number): StockLevel {
  if (quantity <= 0) return "out";
  if (quantity <= LOW_AT) return "low";
  return "ok";
}

export interface StockStats {
  kinds: number;
  pieces: number;
  low: number;
  out: number;
}

export function stockStats(items: StockItem[]): StockStats {
  return items.reduce<StockStats>(
    (s, it) => {
      const level = stockLevel(it.quantity);
      return {
        kinds: s.kinds + 1,
        pieces: s.pieces + Math.max(0, it.quantity),
        low: s.low + (level === "low" ? 1 : 0),
        out: s.out + (level === "out" ? 1 : 0),
      };
    },
    { kinds: 0, pieces: 0, low: 0, out: 0 },
  );
}

/** Search + filter, sorted by name (A→Z, natural order so "Shirt 2" < "Shirt 10"). */
export function visibleItems<T extends StockItem>(
  items: T[],
  search: string,
  filter: StockFilter,
  /** Extra text to search in, e.g. the item's type path. */
  extraText?: (item: T) => string,
): T[] {
  const q = search.trim().toLowerCase();
  const haystack = (it: T) =>
    [it.name, it.size, it.color, it.notes, extraText?.(it)].filter(Boolean).join(" ").toLowerCase();
  return items
    .filter((it) => (q ? haystack(it).includes(q) : true))
    .filter((it) => (filter === "all" ? true : stockLevel(it.quantity) === filter))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

const LEVEL_LABEL: Record<StockLevel, string> = { out: "Out of stock", low: "Running low", ok: "In stock" };

function csvCell(value: string | number): string {
  let s = String(value);
  // Stop spreadsheet apps treating a name like "=SUM(...)" as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (opens in Excel / Google Sheets) of everything currently tracked. */
export function stockCsv<T extends StockItem>(items: T[], typeLabel: (item: T) => string = () => ""): string {
  const rows = [["Type", "Item", "Quantity", "Status", "Size", "Colour", "Price", "Notes", "Last changed"]];
  const sorted = visibleItems(items, "", "all").sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  for (const it of sorted) {
    rows.push([
      typeLabel(it),
      it.name,
      String(it.quantity),
      LEVEL_LABEL[stockLevel(it.quantity)],
      it.size ?? "",
      it.color ?? "",
      it.price === null || it.price === undefined || it.price === "" ? "" : String(Number(it.price)),
      it.notes ?? "",
      it.updated_at.slice(0, 10),
    ]);
  }
  // BOM so Excel reads non-English names (e.g. Tamil, Hindi) correctly.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Size to shrink a photo to, keeping its shape, so the longest side is at most `max`. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: max, height: max };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function stockLevelLabel(level: StockLevel): string {
  return LEVEL_LABEL[level];
}

/**
 * Random id for photo file names. crypto.randomUUID only exists on https (and
 * localhost), so phones testing over the home Wi-Fi (http://192.168.x.x) need
 * the getRandomValues fallback, which works everywhere.
 */
export function newId(cryptoImpl: Pick<Crypto, "getRandomValues"> & { randomUUID?: () => string } = crypto): string {
  if (typeof cryptoImpl.randomUUID === "function") return cryptoImpl.randomUUID();
  const b = cryptoImpl.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
