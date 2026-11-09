// Add a new item, or change / delete an existing one. A photo is required.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronDown, ChevronRight, FolderTree, ImagePlus, Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { addItem, deleteItem, updateItem, type SizeDraft, type StockItemWithPhoto } from "../lib/api";
import { badSizeRows, sortedVariants } from "../lib/logic";
import { categoryPathLabel, type Category, type CategoryIndex } from "../lib/tree";
import { TypePicker } from "./TypePicker";
import { SizesEditor } from "./SizesEditor";

interface Props {
  item: StockItemWithPhoto | null; // null = add new
  idx: CategoryIndex;
  typeRequired: boolean;
  defaultCategoryId: string | null;
  onCreateCategory: (name: string, parentId: string | null) => Promise<Category>;
  onClose: () => void;
  onSaved: () => void;
  onViewPhoto: (src: string, title: string) => void;
}

const priceText = (p: StockItemWithPhoto["price"]) => (p === null || p === undefined || p === "" ? "" : String(Number(p)));

export function ItemSheet({ item, idx, typeRequired, defaultCategoryId, onCreateCategory, onClose, onSaved, onViewPhoto }: Props) {
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [categoryId, setCategoryId] = useState<string | null>(
    item ? (item.category_id && idx.byId.has(item.category_id) ? item.category_id : null) : defaultCategoryId,
  );
  const [pickingType, setPickingType] = useState(false);
  const [price, setPrice] = useState(priceText(item?.price));
  const [sizes, setSizes] = useState<SizeDraft[]>(() =>
    item ? sortedVariants(item).map((v) => ({ id: v.id, label: v.label, quantity: v.quantity })) : [],
  );
  const [color, setColor] = useState(item?.color ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const hasDetails = !!(item && (priceText(item.price) || item.color || item.notes));
  const [showDetails, setShowDetails] = useState(hasDetails);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(item?.photoUrl ?? null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Stop the page behind from scrolling while this is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(file);
    e.target.value = "";
  };

  const typeMissing = typeRequired && !categoryId;
  const priceValue = price.trim() === "" ? null : Number(price.replace(",", "."));
  const priceInvalid = priceValue !== null && (Number.isNaN(priceValue) || priceValue < 0);
  const badSizes = badSizeRows(sizes);
  const canSave =
    name.trim().length > 0 && (item ? true : !!photo) && !typeMissing && !priceInvalid && badSizes.size === 0 && busy === null;

  const save = async () => {
    if (!item && !photo) return void toast.error("Please add a photo.");
    if (typeMissing) return void toast.error("Please choose a type.");
    if (!name.trim()) return void toast.error("Please type a name.");
    if (priceInvalid) return void toast.error("Price must be a number.");
    if (badSizes.size) return void toast.error("Each size needs a different name.");
    setBusy("save");
    const details = { category_id: categoryId, price: priceValue, color, notes, sizes };
    try {
      if (item) await updateItem(item, { name, quantity, photo, ...details });
      else await addItem({ name, quantity, photo: photo!, ...details });
      toast.success(item ? "Saved" : "Added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save. Check the internet.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!item) return;
    setBusy("delete");
    try {
      await deleteItem(item);
      toast.success("Removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove. Check the internet.");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label={item ? "Change item" : "Add item"}
        className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{item ? "Change item" : "Add item"}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-7 w-7" />
          </button>
        </div>

        {confirmDelete && item ? (
          <div className="text-center">
            {preview && <img src={preview} alt="" className="mx-auto mb-4 aspect-square w-56 rounded-3xl object-cover" />}
            <p className="text-xl font-bold">Remove “{item.name}” completely?</p>
            <p className="mt-1 text-stone-500">To take just one, use the − button instead.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmDelete(false)} className="rounded-2xl bg-stone-100 py-4 text-lg font-bold">
                No
              </button>
              <button
                onClick={remove}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-lg font-bold text-white disabled:opacity-60"
              >
                {busy === "delete" && <Loader2 className="h-5 w-5 animate-spin" />} Yes, remove
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Photo (required) */}
            <div className="mb-5">
              {preview ? (
                <div className="relative">
                  <button
                    aria-label="See full photo"
                    onClick={() => onViewPhoto(preview, name || "Photo")}
                    className="block w-full"
                  >
                    <img src={preview} alt="" className="aspect-square w-full rounded-3xl object-cover" />
                  </button>
                  <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 gap-2">
                    <button onClick={() => cameraInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-black/60 py-3 font-semibold text-white backdrop-blur">
                      <Camera className="h-5 w-5" /> New photo
                    </button>
                    <button onClick={() => galleryInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-black/60 py-3 font-semibold text-white backdrop-blur">
                      <ImagePlus className="h-5 w-5" /> Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => cameraInput.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border-4 border-dashed border-teal-300 bg-teal-50 text-teal-800"
                  >
                    <Camera className="h-14 w-14" />
                    <span className="text-lg font-bold">Take photo</span>
                  </button>
                  <button
                    onClick={() => galleryInput.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border-4 border-dashed border-stone-300 bg-stone-50 text-stone-700"
                  >
                    <ImagePlus className="h-14 w-14" />
                    <span className="text-lg font-bold">From gallery</span>
                  </button>
                </div>
              )}
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
              <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={pick} />
            </div>

            {/* Type */}
            <div className="mb-5">
              <span className="text-sm font-semibold text-stone-600">
                Type {typeRequired ? <span className="text-red-600">*</span> : <span className="font-normal">(optional)</span>}
              </span>
              <button
                onClick={() => setPickingType(true)}
                className={`mt-1 flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left text-lg ${
                  categoryId ? "border-stone-300" : typeRequired ? "border-red-300 bg-red-50/50" : "border-stone-300"
                }`}
              >
                <FolderTree className="h-6 w-6 shrink-0 text-teal-700" />
                <span className={`flex-1 ${categoryId ? "font-semibold" : "text-stone-400"}`}>
                  {categoryId ? categoryPathLabel(idx, categoryId) : "Choose type"}
                </span>
                <ChevronRight className="h-6 w-6 text-stone-400" />
              </button>
            </div>

            {/* Name */}
            <label className="mb-5 block">
              <span className="text-sm font-semibold text-stone-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Blue shirt M"
                className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-4 text-xl outline-none focus:border-teal-700"
              />
            </label>

            {/* Sizes table, or a single count for products without sizes */}
            {sizes.length > 0 ? (
              <div className="mb-6">
                <SizesEditor sizes={sizes} onChange={setSizes} badRows={badSizes} />
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-600">How many?</span>
                  <button
                    onClick={() => setSizes([{ label: "", quantity: quantity || 1 }])}
                    className="flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                  >
                    <Plus className="h-4 w-4" /> Add sizes (S, M, L…)
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-stone-100 p-2">
                  <button
                    aria-label="One less"
                    onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                    className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-red-700 shadow-sm active:scale-95"
                  >
                    <Minus className="h-9 w-9" strokeWidth={3} />
                  </button>
                  <input
                    aria-label="Quantity"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0, Math.min(99999, Number(e.target.value.replace(/\D/g, "")) || 0)))}
                    className="w-24 bg-transparent text-center text-5xl font-extrabold tabular-nums outline-none"
                  />
                  <button
                    aria-label="One more"
                    onClick={() => setQuantity((q) => Math.min(99999, q + 1))}
                    className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-teal-800 shadow-sm active:scale-95"
                  >
                    <Plus className="h-9 w-9" strokeWidth={3} />
                  </button>
                </div>
              </div>
            )}

            {/* Optional details, hidden until asked for */}
            <div className="mb-6">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 font-semibold text-stone-600"
              >
                More details (optional)
                <ChevronDown className={`h-5 w-5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>
              {showDetails && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="col-span-2 block">
                    <span className="text-sm font-semibold text-stone-600">Price (₹)</span>
                    <input
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
                      placeholder="e.g. 450"
                      className={`mt-1 w-full rounded-xl border px-4 py-3 text-lg outline-none focus:border-teal-700 ${
                        priceInvalid ? "border-red-400" : "border-stone-300"
                      }`}
                    />
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-sm font-semibold text-stone-600">Colour</span>
                    <input
                      value={color}
                      maxLength={40}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="e.g. Blue"
                      className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-teal-700"
                    />
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-sm font-semibold text-stone-600">Notes</span>
                    <textarea
                      value={notes}
                      maxLength={1000}
                      rows={2}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything else"
                      className="mt-1 w-full resize-none rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-teal-700"
                    />
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={save}
              disabled={!canSave}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-5 text-xl font-bold text-white disabled:opacity-40"
            >
              {busy === "save" && <Loader2 className="h-6 w-6 animate-spin" />}
              {item ? "Save" : "Add"}
            </button>

            {item && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5" /> Remove this item
              </button>
            )}
          </>
        )}
      </div>
      {pickingType && (
        <TypePicker
          idx={idx}
          value={categoryId}
          allowNone={!typeRequired}
          onCreate={onCreateCategory}
          onClose={() => setPickingType(false)}
          onPick={(id) => {
            setCategoryId(id);
            setPickingType(false);
          }}
        />
      )}
    </div>
  );
}
