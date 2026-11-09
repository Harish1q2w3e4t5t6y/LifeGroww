// Arumugam Stock — the types tree (Shirt → Formal → Full sleeve …). Pure helpers,
// unit-tested in src/stock/stock.test.ts.
import { itemLines, itemTotal, stockLevel, type StockItem } from "./logic";

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
}

export interface CategoryIndex {
  byId: Map<string, Category>;
  /** Children of each category, sorted by name; key "" = top level. */
  children: Map<string, Category[]>;
}

const sortByName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export function indexCategories(categories: Category[]): CategoryIndex {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const children = new Map<string, Category[]>();
  for (const c of categories) {
    // A parent that no longer exists puts the type at the top level.
    const key = c.parent_id && byId.has(c.parent_id) ? c.parent_id : "";
    const list = children.get(key) ?? [];
    list.push(c);
    children.set(key, list);
  }
  children.forEach((list) => list.sort(sortByName));
  return { byId, children };
}

export function childrenOf(idx: CategoryIndex, id: string | null): Category[] {
  return idx.children.get(id ?? "") ?? [];
}

/** Top → this type, e.g. [Shirt, Formal, Full sleeve]. Safe against loops. */
export function categoryPath(idx: CategoryIndex, id: string | null | undefined): Category[] {
  const path: Category[] = [];
  const seen = new Set<string>();
  let cur = id ? idx.byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_id ? idx.byId.get(cur.parent_id) : undefined;
  }
  return path;
}

export function categoryPathLabel(idx: CategoryIndex, id: string | null | undefined): string {
  return categoryPath(idx, id)
    .map((c) => c.name)
    .join(" › ");
}

/** This type and every type inside it, at any depth. */
export function subtreeIds(idx: CategoryIndex, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of childrenOf(idx, cur)) stack.push(child.id);
  }
  return out;
}

export interface BranchSummary {
  pieces: number;
  kinds: number;
  low: number;
  out: number;
  /** Photo of some item in this branch, used as the type's picture. */
  coverPhotoUrl: string | null;
}

/** Totals for a type including everything inside it. */
export function branchSummary<T extends StockItem & { photoUrl?: string | null }>(
  idx: CategoryIndex,
  id: string,
  items: T[],
): BranchSummary {
  const ids = subtreeIds(idx, id);
  const summary: BranchSummary = { pieces: 0, kinds: 0, low: 0, out: 0, coverPhotoUrl: null };
  for (const it of items) {
    if (!it.category_id || !ids.has(it.category_id)) continue;
    summary.kinds += 1;
    summary.pieces += itemTotal(it);
    for (const line of itemLines(it)) {
      const level = stockLevel(line.quantity);
      if (level === "low") summary.low += 1;
      if (level === "out") summary.out += 1;
    }
    if (!summary.coverPhotoUrl && it.photoUrl && itemTotal(it) > 0) summary.coverPhotoUrl = it.photoUrl;
  }
  if (!summary.coverPhotoUrl) summary.coverPhotoUrl = items.find((i) => i.category_id && ids.has(i.category_id))?.photoUrl ?? null;
  return summary;
}

/** Items filed directly under this type (null = items with no type). */
export function itemsDirectlyIn<T extends StockItem>(idx: CategoryIndex, id: string | null, items: T[]): T[] {
  return items.filter((it) => {
    const known = it.category_id && idx.byId.has(it.category_id) ? it.category_id : null;
    return known === id;
  });
}

/** Why a type can't be deleted yet, or null if it can. */
export function deleteBlocker(idx: CategoryIndex, id: string, items: StockItem[]): string | null {
  const subs = childrenOf(idx, id).length;
  const direct = items.filter((i) => i.category_id === id).length;
  if (subs && direct) return `It still has ${subs} sub-type(s) and ${direct} item(s) inside.`;
  if (subs) return `It still has ${subs} sub-type(s) inside. Delete or empty those first.`;
  if (direct) return `It still has ${direct} item(s). Move them to another type first.`;
  return null;
}

/** Same name already used next to it (case-insensitive)? */
export function nameTaken(idx: CategoryIndex, parentId: string | null, name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return childrenOf(idx, parentId).some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === n);
}
