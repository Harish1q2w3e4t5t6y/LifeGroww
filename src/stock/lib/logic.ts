// Arumugam Stock — pure helpers (no network), unit-tested in src/stock/stock.test.ts.

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
  /** Sizes typed for this product (e.g. L 12, M 400). Empty = single count in `quantity`. */
  variants?: StockVariant[];
}

export interface StockVariant {
  id: string;
  label: string;
  quantity: number;
  sort: number;
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

export function hasSizes(item: StockItem): boolean {
  return !!item.variants && item.variants.length > 0;
}

/** Sizes in the order they were typed. */
export function sortedVariants(item: StockItem): StockVariant[] {
  return [...(item.variants ?? [])].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

/** Each countable line: one per size, or the product itself if it has no sizes. */
export function itemLines(item: StockItem): Array<{ label: string | null; quantity: number }> {
  return hasSizes(item)
    ? sortedVariants(item).map((v) => ({ label: v.label, quantity: v.quantity }))
    : [{ label: null, quantity: item.quantity }];
}

export function itemTotal(item: StockItem): number {
  return itemLines(item).reduce((sum, l) => sum + Math.max(0, l.quantity), 0);
}

/** Worst line wins: any size out → "out", else any low → "low". */
export function itemLevel(item: StockItem): StockLevel {
  const levels = itemLines(item).map((l) => stockLevel(l.quantity));
  if (levels.includes("out")) return "out";
  if (levels.includes("low")) return "low";
  return "ok";
}

export interface StockStats {
  kinds: number;
  pieces: number;
  low: number;
  out: number;
}

/** Items = products; Low / Out count each size separately (so "M is out" shows up). */
export function stockStats(items: StockItem[]): StockStats {
  const s: StockStats = { kinds: 0, pieces: 0, low: 0, out: 0 };
  for (const it of items) {
    s.kinds += 1;
    for (const line of itemLines(it)) {
      s.pieces += Math.max(0, line.quantity);
      const level = stockLevel(line.quantity);
      if (level === "low") s.low += 1;
      if (level === "out") s.out += 1;
    }
  }
  return s;
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
    [it.name, it.size, it.color, it.notes, extraText?.(it), ...(it.variants ?? []).map((v) => v.label)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  const matchesFilter = (it: T) => {
    if (filter === "all") return true;
    const levels = itemLines(it).map((l) => stockLevel(l.quantity));
    return filter === "ok" ? levels.every((l) => l === "ok") : levels.includes(filter);
  };
  return items
    .filter((it) => (q ? haystack(it).includes(q) : true))
    .filter(matchesFilter)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

const LEVEL_LABEL: Record<StockLevel, string> = { out: "Out of stock", low: "Running low", ok: "In stock" };

function csvCell(value: string | number): string {
  let s = String(value);
  // Stop spreadsheet apps treating a name like "=SUM(...)" as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (opens in Excel / Google Sheets) of everything currently tracked: one row per size. */
export function stockCsv<T extends StockItem>(items: T[], typeLabel: (item: T) => string = () => ""): string {
  const rows = [["Type", "Item", "Size", "Quantity", "Status", "Colour", "Price", "Notes", "Last changed"]];
  const sorted = visibleItems(items, "", "all").sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  for (const it of sorted) {
    const price = it.price === null || it.price === undefined || it.price === "" ? "" : String(Number(it.price));
    for (const line of itemLines(it)) {
      rows.push([
        typeLabel(it),
        it.name,
        line.label ?? it.size ?? "",
        String(line.quantity),
        LEVEL_LABEL[stockLevel(line.quantity)],
        it.color ?? "",
        price,
        it.notes ?? "",
        it.updated_at.slice(0, 10),
      ]);
    }
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

/** Rows whose size name is empty or repeats another (ignoring case/spaces). */
export function badSizeRows(sizes: Array<{ label: string }>): Set<number> {
  const bad = new Set<number>();
  const seen = new Map<string, number>();
  sizes.forEach((s, i) => {
    const key = s.label.trim().toLowerCase();
    if (!key) return void bad.add(i);
    if (seen.has(key)) {
      bad.add(i);
      bad.add(seen.get(key)!);
    } else seen.set(key, i);
  });
  return bad;
}

/** Photo viewer zoom: 1 = whole photo fits the screen, up to 5× closer. */
export const MAX_ZOOM = 5;
export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_ZOOM, Math.max(1, Math.round(scale * 100) / 100));
}
