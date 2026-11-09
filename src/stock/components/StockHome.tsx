// Main screen: dashboard on top, "All items" / "By type" tabs, big photo
// cards with − / + buttons, search, export, settings and a big "Add item" button.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Download, FolderTree, LayoutGrid, MoreVertical, Plus, Printer, RefreshCw, Search, Settings, X } from "lucide-react";
import {
  addCategory,
  adjustQuantity,
  adjustSize,
  DEFAULT_SETTINGS,
  deleteCategory,
  listCategories,
  listItems,
  loadSettings,
  renameCategory,
  saveSetting,
  type StockItemWithPhoto,
  type StockSettings,
} from "../lib/api";
import { switchApp } from "../appChoice";
import { stockCsv, stockStats, visibleItems, type StockFilter, type StockVariant } from "../lib/logic";
import { categoryPathLabel, indexCategories, type Category } from "../lib/tree";
import { ByTypeView } from "./ByTypeView";
import { ItemCard } from "./ItemCard";
import { ItemSheet } from "./ItemSheet";
import { PrintList } from "./PrintList";
import { SettingsSheet } from "./SettingsSheet";
import { SizesSheet } from "./SizesSheet";
import { PhotoViewer } from "./PhotoViewer";
import { TypeSheet } from "./TypeSheet";

type SheetState = { mode: "add" } | { mode: "edit"; item: StockItemWithPhoto } | null;
type TypeSheetState = { category: Category | null; parentId: string | null } | null;

function downloadCsv(items: StockItemWithPhoto[], typeLabel: (item: StockItemWithPhoto) => string) {
  const blob = new Blob([stockCsv(items, typeLabel)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `home-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StockHome() {
  const [items, setItems] = useState<StockItemWithPhoto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StockSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"all" | "types">("all");
  const [typeAt, setTypeAt] = useState<string | null>(null);
  const [typeSheet, setTypeSheet] = useState<TypeSheetState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sizesFor, setSizesFor] = useState<string | null>(null); // product whose size table is open
  const [photo, setPhoto] = useState<{ src: string; title: string } | null>(null);
  const viewPhoto = (src: string, title: string) => setPhoto({ src, title });
  // Taps still waiting for the server, per item: ignore server counts until
  // the last tap's answer arrives, so fast tapping never jumps backwards.
  const pendingTaps = useRef(new Map<string, number>());

  const load = useCallback(async () => {
    try {
      const [fresh, cats, prefs] = await Promise.all([listItems(), listCategories(), loadSettings()]);
      setCategories(cats);
      setSettings(prefs);
      setItems((prev) => {
        if (!prev) return fresh;
        // Keep the on-screen counts for products / sizes with taps still in flight.
        const prevById = new Map(prev.map((i) => [i.id, i]));
        return fresh.map((i) => {
          const old = prevById.get(i.id);
          if (!old) return i;
          const quantity = pendingTaps.current.get(i.id) ? old.quantity : i.quantity;
          const variants = i.variants?.map((v) =>
            pendingTaps.current.get(v.id) ? { ...v, quantity: old.variants?.find((o) => o.id === v.id)?.quantity ?? v.quantity } : v,
          );
          return { ...i, quantity, variants };
        });
      });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    // Another family member may have changed things: reload when the app is opened again.
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [load]);

  // Optimistic + / −: show the change at once, then settle on the server's count
  // when the last tap for that product/size has come back.
  const sendTap = async (key: string, apply: (n: number) => void, call: () => Promise<number>) => {
    pendingTaps.current.set(key, (pendingTaps.current.get(key) ?? 0) + 1);
    try {
      const serverQty = await call();
      const left = (pendingTaps.current.get(key) ?? 1) - 1;
      if (left <= 0) {
        pendingTaps.current.delete(key);
        apply(serverQty);
      } else {
        pendingTaps.current.set(key, left);
      }
    } catch (err) {
      pendingTaps.current.delete(key);
      toast.error(err instanceof Error ? err.message : "Could not save. Check the internet.");
      void load();
    }
  };

  const setItemQty = (id: string, q: (old: number) => number) =>
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, quantity: q(i.quantity) } : i)) ?? prev);
  const setSizeQty = (itemId: string, sizeId: string, q: (old: number) => number) =>
    setItems(
      (prev) =>
        prev?.map((i) =>
          i.id === itemId ? { ...i, variants: i.variants?.map((v) => (v.id === sizeId ? { ...v, quantity: q(v.quantity) } : v)) } : i,
        ) ?? prev,
    );

  const tap = (item: StockItemWithPhoto, delta: number) => {
    if (delta < 0 && item.quantity <= 0) return;
    setItemQty(item.id, (n) => Math.max(0, n + delta));
    void sendTap(item.id, (n) => setItemQty(item.id, () => n), () => adjustQuantity(item.id, delta));
  };

  const tapSize = (item: StockItemWithPhoto, size: StockVariant, delta: number) => {
    if (delta < 0 && size.quantity <= 0) return;
    setSizeQty(item.id, size.id, (n) => Math.max(0, n + delta));
    void sendTap(size.id, (n) => setSizeQty(item.id, size.id, () => n), () => adjustSize(size.id, delta));
  };

  const idx = useMemo(() => indexCategories(categories), [categories]);
  const typeLabel = useCallback((item: StockItemWithPhoto) => categoryPathLabel(idx, item.category_id), [idx]);
  const stats = useMemo(() => stockStats(items ?? []), [items]);
  const shown = useMemo(() => visibleItems(items ?? [], search, filter, typeLabel), [items, search, filter, typeLabel]);
  // Moving between the tree and a type's page: start at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [typeAt]);
  // A type deleted on another phone: step back to the top.
  useEffect(() => {
    if (typeAt && !idx.byId.has(typeAt)) setTypeAt(null);
  }, [idx, typeAt]);

  const createCategory = async (name: string, parentId: string | null) => {
    const cat = await addCategory(name, parentId);
    setCategories((prev) => [...prev, cat]);
    return cat;
  };
  const changeSetting = async <K extends keyof StockSettings>(key: K, value: StockSettings[K]) => {
    const before = settings;
    setSettings((s) => ({ ...s, [key]: value }));
    try {
      await saveSetting(key, value);
    } catch (err) {
      setSettings(before);
      toast.error(err instanceof Error ? err.message : "Could not save the setting.");
    }
  };
  const openItem = (item: StockItemWithPhoto) => setSheet({ mode: "edit", item });
  const openSizes = (item: StockItemWithPhoto) => setSizesFor(item.id);
  const sizesItem = sizesFor ? items?.find((i) => i.id === sizesFor) ?? null : null;

  const tiles: Array<{ key: StockFilter; label: string; value: number; tone: string }> = [
    { key: "all", label: "Items", value: stats.kinds, tone: "bg-white text-stone-900" },
    { key: "ok", label: "Pieces", value: stats.pieces, tone: "bg-white text-teal-800" },
    { key: "low", label: "Low", value: stats.low, tone: "bg-amber-50 text-amber-800" },
    { key: "out", label: "Out", value: stats.out, tone: "bg-red-50 text-red-700" },
  ];

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-4 print:hidden">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-teal-800">Arumugam Stock</h1>
          <div className="relative flex items-center gap-1">
            <button aria-label="Refresh" onClick={() => void load()} className="rounded-full p-3 text-stone-500 hover:bg-stone-200">
              <RefreshCw className="h-6 w-6" />
            </button>
            <button aria-label="More" onClick={() => setMenuOpen((o) => !o)} className="rounded-full p-3 text-stone-600 hover:bg-stone-200">
              <MoreVertical className="h-6 w-6" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-stone-50"
                    onClick={() => {
                      setMenuOpen(false);
                      downloadCsv(items ?? [], typeLabel);
                    }}
                  >
                    <Download className="h-5 w-5 text-teal-700" /> Download list (Excel)
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-stone-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setTimeout(() => window.print(), 50);
                    }}
                  >
                    <Printer className="h-5 w-5 text-teal-700" /> Print / PDF with photos
                  </button>
                  <button
                    className="flex w-full items-center gap-3 border-t border-stone-100 px-4 py-4 text-left hover:bg-stone-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings className="h-5 w-5 text-stone-500" /> Settings
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-stone-50"
                    onClick={() => {
                      setMenuOpen(false);
                      switchApp();
                    }}
                  >
                    <ArrowLeftRight className="h-5 w-5 text-stone-500" /> Switch app
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Dashboard: tap a tile to show only those items */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {tiles.map((t) => {
            const active = filter === t.key || (t.key === "all" && filter === "all");
            const clickable = t.key !== "ok";
            return (
              <button
                key={t.key}
                disabled={!clickable}
                onClick={() => setFilter(filter === t.key ? "all" : t.key)}
                className={`rounded-2xl px-2 py-3 text-center shadow-sm ring-2 transition ${t.tone} ${
                  active && t.key !== "all" ? "ring-current" : "ring-transparent"
                }`}
              >
                <div className="text-2xl font-extrabold leading-none">{t.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">{t.label}</div>
              </button>
            );
          })}
        </div>

        {/* All items / By type */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-stone-200 p-1">
          {([
            ["all", "All items", LayoutGrid],
            ["types", "By type", FolderTree],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-base font-bold ${
                tab === key ? "bg-white text-teal-800 shadow-sm" : "text-stone-500"
              }`}
            >
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </div>

        {tab === "all" && (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full rounded-2xl border-0 bg-white py-3 pl-12 pr-12 text-lg shadow-sm outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-teal-700"
              />
              {search && (
                <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mb-3 inline-flex items-center gap-2 rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white">
                Showing: {filter === "out" ? "Out of stock" : "Running low"} <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}

        {/* Items */}
        {items === null && !loadError && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-stone-200" />
            ))}
          </div>
        )}
        {loadError && (
          <div className="rounded-2xl bg-red-50 p-5 text-red-800">
            <p className="font-semibold">Could not load the items.</p>
            <p className="mt-1 text-sm">{loadError}</p>
            {/stock_categories|stock_settings|category_id|schema cache/i.test(loadError) && (
              <p className="mt-2 text-sm">Run the updated src/stock/supabase-setup.sql in Supabase once.</p>
            )}
            <button onClick={() => void load()} className="mt-3 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white">
              Try again
            </button>
          </div>
        )}
        {items && items.length === 0 && tab === "all" && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-bold">No items yet</p>
            <p className="mt-2 text-stone-500">Tap the big + button to add the first one with a photo.</p>
          </div>
        )}
        {tab === "all" && items && items.length > 0 && shown.length === 0 && <p className="py-10 text-center text-stone-500">Nothing matches.</p>}

        {tab === "all" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((item) => (
              <ItemCard key={item.id} item={item} typeLabel={typeLabel(item)} onOpen={openItem} onOpenSizes={openSizes} onTap={tap} onViewPhoto={viewPhoto} />
            ))}
          </div>
        )}

        {tab === "types" && items && (
          <ByTypeView
            idx={idx}
            items={items}
            at={typeAt}
            setAt={setTypeAt}
            onOpenItem={openItem}
            onOpenSizes={openSizes}
            onViewPhoto={viewPhoto}
            onTap={tap}
            onNewType={(parentId) => setTypeSheet({ category: null, parentId })}
            onEditType={(category) => setTypeSheet({ category, parentId: category.parent_id })}
          />
        )}
      </div>

      {/* Big add button */}
      <button
        onClick={() => setSheet({ mode: "add" })}
        className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-teal-700 px-8 py-5 text-xl font-bold text-white shadow-2xl active:scale-95 print:hidden"
      >
        <Plus className="h-7 w-7" strokeWidth={3} /> Add item
      </button>

      {sheet && (
        <ItemSheet
          item={sheet.mode === "edit" ? sheet.item : null}
          idx={idx}
          typeRequired={settings.typeRequired}
          defaultCategoryId={tab === "types" ? typeAt : null}
          onCreateCategory={createCategory}
          onViewPhoto={viewPhoto}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            void load();
          }}
        />
      )}

      {typeSheet && (
        <TypeSheet
          idx={idx}
          items={items ?? []}
          category={typeSheet.category}
          parentId={typeSheet.parentId}
          onCreate={createCategory}
          onRename={async (id, name) => {
            await renameCategory(id, name);
            setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
          }}
          onDelete={async (id) => {
            await deleteCategory(id);
            setCategories((prev) => prev.filter((c) => c.id !== id));
            if (typeAt === id) setTypeAt(typeSheet.category?.parent_id ?? null);
          }}
          onClose={() => setTypeSheet(null)}
        />
      )}

      {sizesItem && (
        <SizesSheet
          item={sizesItem}
          typeLabel={typeLabel(sizesItem)}
          onTapSize={tapSize}
          onViewPhoto={viewPhoto}
          onEdit={(it) => {
            setSizesFor(null);
            openItem(it);
          }}
          onClose={() => setSizesFor(null)}
        />
      )}

      {photo && <PhotoViewer src={photo.src} title={photo.title} onClose={() => setPhoto(null)} />}

      {settingsOpen && <SettingsSheet settings={settings} onChange={changeSetting} onClose={() => setSettingsOpen(false)} />}

      <PrintList items={items ?? []} typeLabel={typeLabel} />
    </>
  );
}
