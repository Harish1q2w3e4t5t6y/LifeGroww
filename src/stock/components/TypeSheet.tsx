// Add a new type, or rename / delete an existing one.
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, X } from "lucide-react";
import { categoryPathLabel, deleteBlocker, nameTaken, type Category, type CategoryIndex } from "../lib/tree";
import type { StockItem } from "../lib/logic";

interface Props {
  idx: CategoryIndex;
  items: StockItem[];
  /** Existing type to change, or null to add a new one inside `parentId`. */
  category: Category | null;
  parentId: string | null;
  onCreate: (name: string, parentId: string | null) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TypeSheet({ idx, items, category, parentId, onCreate, onRename, onDelete, onClose }: Props) {
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const where = category ? category.parent_id : parentId;
  const whereLabel = where ? categoryPathLabel(idx, where) : "Top level";
  const blocker = category ? deleteBlocker(idx, category.id, items) : null;

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    if (nameTaken(idx, where, n, category?.id)) return void toast.error(`"${n}" already exists here.`);
    setBusy("save");
    try {
      if (category) await onRename(category.id, n);
      else await onCreate(n, parentId);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!category) return;
    setBusy("delete");
    try {
      await onDelete(category.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label={category ? "Change type" : "New type"}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{category ? "Change type" : "New type"}</h2>
            <p className="text-sm text-stone-500">In: {whereLabel}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-7 w-7" />
          </button>
        </div>

        {confirmDelete && category ? (
          <div className="text-center">
            <p className="text-xl font-bold">Delete type “{category.name}”?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmDelete(false)} className="rounded-2xl bg-stone-100 py-4 text-lg font-bold">
                No
              </button>
              <button
                onClick={remove}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-lg font-bold text-white disabled:opacity-60"
              >
                {busy === "delete" && <Loader2 className="h-5 w-5 animate-spin" />} Yes, delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-semibold text-stone-600">Name</span>
              <input
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                placeholder="e.g. Shirt, Formal, Full sleeve"
                className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-4 text-xl outline-none focus:border-teal-700"
              />
            </label>
            <button
              onClick={save}
              disabled={!name.trim() || busy !== null}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-5 text-xl font-bold text-white disabled:opacity-40"
            >
              {busy === "save" && <Loader2 className="h-6 w-6 animate-spin" />}
              {category ? "Save" : "Add type"}
            </button>
            {category && (
              <>
                <button
                  onClick={() => (blocker ? toast.error(`Can't delete yet. ${blocker}`) : setConfirmDelete(true))}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold ${
                    blocker ? "text-stone-400" : "text-red-600 hover:bg-red-50"
                  }`}
                >
                  <Trash2 className="h-5 w-5" /> Delete this type
                </button>
                {blocker && <p className="text-center text-sm text-stone-500">{blocker}</p>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
