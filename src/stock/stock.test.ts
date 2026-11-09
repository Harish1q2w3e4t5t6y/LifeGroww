import { describe, it, expect } from "vitest";
import { fitWithin, newId, stockCsv, stockLevel, stockStats, visibleItems, type StockItem } from "./lib/logic";

const item = (name: string, quantity: number, extra: Partial<StockItem> = {}): StockItem => ({
  id: name,
  name,
  quantity,
  photo_path: `u/${name}.jpg`,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-09T10:00:00Z",
  ...extra,
});

describe("Home Stock logic", () => {
  it("classifies stock levels", () => {
    expect([0, 1, 2, 3].map(stockLevel)).toEqual(["out", "low", "low", "ok"]);
  });

  it("counts kinds, pieces, low and out", () => {
    expect(stockStats([item("A", 0), item("B", 2), item("C", 10)])).toEqual({ kinds: 3, pieces: 12, low: 1, out: 1 });
  });

  it("searches, filters and sorts naturally", () => {
    const items = [item("Shirt 10", 5), item("shirt 2", 0), item("Pant", 1)];
    expect(visibleItems(items, "", "all").map((i) => i.name)).toEqual(["Pant", "shirt 2", "Shirt 10"]);
    expect(visibleItems(items, "SHIRT", "all").map((i) => i.name)).toEqual(["shirt 2", "Shirt 10"]);
    expect(visibleItems(items, "", "out").map((i) => i.name)).toEqual(["shirt 2"]);
    expect(visibleItems(items, "", "low").map((i) => i.name)).toEqual(["Pant"]);
    expect(visibleItems(items, "formal", "all", (i) => (i.name === "Pant" ? "Trousers › Formal" : "")).map((i) => i.name)).toEqual(["Pant"]);
  });

  it("exports CSV that Excel reads safely", () => {
    const csv = stockCsv(
      [item('Shirt "blue", M', 3, { price: "450.00", size: "M" }), item("=cmd", 0)],
      (i) => (i.name === "=cmd" ? "" : "Shirt › Formal"),
    );
    expect(csv.startsWith("\uFEFFType,Item,Quantity,Status,Size,Colour,Price,Notes,Last changed\r\n")).toBe(true);
    expect(csv).toContain('Shirt › Formal,"Shirt ""blue"", M",3,In stock,M,,450,,2026-11-09');
    expect(csv).toContain(",'=cmd,0,Out of stock,,,,,2026-11-09");
  });

  it("shrinks photos keeping their shape and never enlarges", () => {
    expect(fitWithin(4000, 3000, 900)).toEqual({ width: 900, height: 675 });
    expect(fitWithin(3000, 4000, 900)).toEqual({ width: 675, height: 900 });
    expect(fitWithin(500, 400, 900)).toEqual({ width: 500, height: 400 });
  });
});

import { pickApp, type VisitInfo } from "./appChoice";

describe("which app opens", () => {
  const visit = (over: Partial<VisitInfo>): VisitInfo => ({
    pathname: "/",
    search: "",
    hash: "",
    isPhone: true,
    remembered: null,
    chosenThisVisit: null,
    ...over,
  });

  it("asks on a phone at the front door, before the Lifegrow login", () => {
    expect(pickApp(visit({}))).toBe("ask");
    expect(pickApp(visit({ pathname: "/login" }))).toBe("ask");
  });

  it("never asks on a computer", () => {
    expect(pickApp(visit({ isPhone: false }))).toBe("lifegrow");
  });

  it("uses the remembered or just-made choice", () => {
    expect(pickApp(visit({ remembered: "stock" }))).toBe("stock");
    expect(pickApp(visit({ remembered: "lifegrow" }))).toBe("lifegrow");
    expect(pickApp(visit({ remembered: "stock", chosenThisVisit: "lifegrow" }))).toBe("lifegrow");
  });

  it("always opens /stock as Home Stock", () => {
    expect(pickApp(visit({ pathname: "/stock", isPhone: false, remembered: "lifegrow" }))).toBe("stock");
  });

  it("never interrupts sign-in round trips or other Lifegrow pages", () => {
    expect(pickApp(visit({ search: "?code=abc" }))).toBe("lifegrow");
    expect(pickApp(visit({ hash: "#access_token=x&type=recovery", pathname: "/login" }))).toBe("lifegrow");
    expect(pickApp(visit({ pathname: "/oauth/consent", search: "?authorization_id=1", remembered: "stock" }))).toBe("lifegrow");
    expect(pickApp(visit({ pathname: "/dashboard" }))).toBe("lifegrow");
  });
});

describe("photo ids on plain http (home Wi-Fi testing)", () => {
  it("falls back when crypto.randomUUID is missing", () => {
    const noUuid = { getRandomValues: <T extends ArrayBufferView | null>(a: T) => crypto.getRandomValues(a as never) as T };
    const id = newId(noUuid);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId(noUuid)).not.toBe(id);
  });
});

import {
  branchSummary,
  categoryPathLabel,
  childrenOf,
  deleteBlocker,
  indexCategories,
  itemsDirectlyIn,
  nameTaken,
  subtreeIds,
  type Category,
} from "./lib/tree";

describe("types tree", () => {
  const cats: Category[] = [
    { id: "shirt", name: "Shirt", parent_id: null },
    { id: "formal", name: "Formal", parent_id: "shirt" },
    { id: "full", name: "Full sleeve", parent_id: "formal" },
    { id: "half", name: "Half sleeve", parent_id: "formal" },
    { id: "casual", name: "Casual", parent_id: "shirt" },
    { id: "pant", name: "Pant", parent_id: null },
    { id: "orphan", name: "Lost", parent_id: "gone" },
  ];
  const idx = indexCategories(cats);
  const items = [
    item("A", 4, { category_id: "full" }),
    item("B", 0, { category_id: "half" }),
    item("C", 1, { category_id: "shirt" }),
    item("D", 9, { category_id: "pant" }),
    item("E", 2, { category_id: null }),
  ].map((i) => ({ ...i, photoUrl: `url-${i.name}` }));

  it("lists children sorted, with orphans at the top level", () => {
    expect(childrenOf(idx, null).map((c) => c.name)).toEqual(["Lost", "Pant", "Shirt"]);
    expect(childrenOf(idx, "shirt").map((c) => c.name)).toEqual(["Casual", "Formal"]);
  });

  it("shows the full path of a type", () => {
    expect(categoryPathLabel(idx, "full")).toBe("Shirt › Formal › Full sleeve");
    expect(categoryPathLabel(idx, null)).toBe("");
  });

  it("collects a whole branch, at any depth", () => {
    expect([...subtreeIds(idx, "shirt")].sort()).toEqual(["casual", "formal", "full", "half", "shirt"]);
  });

  it("totals a branch including sub-types, with an in-stock cover photo", () => {
    expect(branchSummary(idx, "shirt", items)).toEqual({ pieces: 5, kinds: 3, low: 1, out: 1, coverPhotoUrl: "url-A" });
    expect(branchSummary(idx, "casual", items)).toEqual({ pieces: 0, kinds: 0, low: 0, out: 0, coverPhotoUrl: null });
  });

  it("finds items filed directly at a level", () => {
    expect(itemsDirectlyIn(idx, "shirt", items).map((i) => i.name)).toEqual(["C"]);
    expect(itemsDirectlyIn(idx, null, items).map((i) => i.name)).toEqual(["E"]);
  });

  it("only lets empty types be deleted", () => {
    expect(deleteBlocker(idx, "formal", items)).toMatch(/2 sub-type/);
    expect(deleteBlocker(idx, "full", items)).toMatch(/1 item/);
    expect(deleteBlocker(idx, "casual", items)).toBeNull();
  });

  it("spots duplicate names next to each other only", () => {
    expect(nameTaken(idx, "shirt", " formal ")).toBe(true);
    expect(nameTaken(idx, "formal", "Formal")).toBe(false);
    expect(nameTaken(idx, "shirt", "Formal", "formal")).toBe(false);
  });
});
