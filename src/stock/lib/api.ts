// Home Stock — Supabase reads/writes. Tables and bucket: src/stock/supabase-setup.sql.
import { stockSupabase as db } from "./client";
import { fitWithin, newId, type StockItem } from "./logic";
import type { Category } from "./tree";

const BUCKET = "stock-photos";
const PHOTO_MAX_SIDE = 900;
const PHOTO_QUALITY = 0.75;

export type StockItemWithPhoto = StockItem & { photoUrl: string | null };

/** Shrinks a camera photo (often 3–8 MB) to a ~100 KB JPEG before upload. */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo."))), "image/jpeg", PHOTO_QUALITY),
  );
}

async function uploadPhoto(file: File): Promise<string> {
  const path = `items/${newId()}.jpg`;
  const blob = await compressPhoto(file);
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

async function removePhoto(path: string) {
  // Best effort: a leftover photo file is harmless.
  await db.storage.from(BUCKET).remove([path]);
}

export async function listItems(): Promise<StockItemWithPhoto[]> {
  const { data, error } = await db
    .from("stock_items")
    .select("id, name, quantity, photo_path, created_at, updated_at, category_id, price, size, color, notes");
  if (error) throw new Error(error.message);
  // Public bucket: photo links are built locally, no extra request.
  return ((data ?? []) as StockItem[]).map((i) => ({
    ...i,
    photoUrl: db.storage.from(BUCKET).getPublicUrl(i.photo_path).data.publicUrl,
  }));
}

/** Optional details; empty text is stored as "nothing". */
export interface ItemDetails {
  category_id?: string | null;
  price?: number | null;
  size?: string | null;
  color?: string | null;
  notes?: string | null;
}

function cleanDetails(d: ItemDetails): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  if (d.category_id !== undefined) out.category_id = d.category_id || null;
  if (d.price !== undefined) out.price = d.price === null || Number.isNaN(d.price) ? null : Math.max(0, d.price);
  if (d.size !== undefined) out.size = text(d.size);
  if (d.color !== undefined) out.color = text(d.color);
  if (d.notes !== undefined) out.notes = text(d.notes);
  return out;
}

export async function addItem(input: { name: string; quantity: number; photo: File } & ItemDetails): Promise<void> {
  const photo_path = await uploadPhoto(input.photo);
  const { error } = await db.from("stock_items").insert({
    name: input.name.trim(),
    quantity: Math.max(0, Math.floor(input.quantity)),
    photo_path,
    ...cleanDetails(input),
  });
  if (error) {
    await removePhoto(photo_path);
    throw new Error(error.message);
  }
}

export async function updateItem(
  item: StockItem,
  changes: { name?: string; quantity?: number; photo?: File | null } & ItemDetails,
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), ...cleanDetails(changes) };
  if (changes.name !== undefined) patch.name = changes.name.trim();
  if (changes.quantity !== undefined) patch.quantity = Math.max(0, Math.floor(changes.quantity));
  let newPhoto: string | null = null;
  if (changes.photo) patch.photo_path = newPhoto = await uploadPhoto(changes.photo);

  const { error } = await db.from("stock_items").update(patch).eq("id", item.id);
  if (error) {
    if (newPhoto) await removePhoto(newPhoto);
    throw new Error(error.message);
  }
  if (newPhoto) await removePhoto(item.photo_path);
}

/** + / − : returns the new quantity as the server sees it. */
export async function adjustQuantity(id: string, delta: number): Promise<number> {
  const { data, error } = await db.rpc("stock_adjust", { item_id: id, delta });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as StockItem | null;
  if (!row) throw new Error("This item was removed on another phone.");
  return row.quantity;
}

export async function deleteItem(item: StockItem): Promise<void> {
  const { error } = await db.from("stock_items").delete().eq("id", item.id);
  if (error) throw new Error(error.message);
  await removePhoto(item.photo_path);
}

// ── Types tree ──────────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await db.from("stock_categories").select("id, name, parent_id, created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export async function addCategory(name: string, parentId: string | null): Promise<Category> {
  const { data, error } = await db
    .from("stock_categories")
    .insert({ name: name.trim(), parent_id: parentId })
    .select("id, name, parent_id, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Category;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const { error } = await db.from("stock_categories").update({ name: name.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db.from("stock_categories").delete().eq("id", id);
  // 23503 = still has sub-types (another phone may have just added one).
  if (error) throw new Error(error.code === "23503" ? "This type still has sub-types inside." : error.message);
}

// ── Family-wide settings ────────────────────────────────────────────────

export interface StockSettings {
  typeRequired: boolean;
}

export const DEFAULT_SETTINGS: StockSettings = { typeRequired: true };

export async function loadSettings(): Promise<StockSettings> {
  const { data, error } = await db.from("stock_settings").select("key, value");
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    typeRequired: typeof map.get("typeRequired") === "boolean" ? (map.get("typeRequired") as boolean) : DEFAULT_SETTINGS.typeRequired,
  };
}

export async function saveSetting<K extends keyof StockSettings>(key: K, value: StockSettings[K]): Promise<void> {
  const { error } = await db.from("stock_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
