// Choose an item's type by stepping down the tree: Shirt → Formal → Full sleeve.
// A type with sub-types opens them; "Choose …" picks the level you're on.
import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, FolderTree, Loader2, Plus, X } from "lucide-react";
import { categoryPath, childrenOf, nameTaken, type Category, type CategoryIndex } from "../lib/tree";

interface Props {
  idx: CategoryIndex;
  value: string | null;
  allowNone: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
  onCreate: (name: string, parentId: string | null) => Promise<Category>;
}

export function TypePicker({ idx, value, allowNone, onPick, onClose, onCreate }: Props) {
  // Start one level above the current choice, so it's visible and easy to change.
  const [at, setAt] = useState<string | null>(() => (value ? idx.byId.get(value)?.parent_id ?? null : null));
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const path = categoryPath(idx, at);
  const here = at ? idx.byId.get(at) ?? null : null;
  const list = childrenOf(idx, at);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    if (nameTaken(idx, at, name)) return void toast.error(`"${name}" already exists here.`);
    setBusy(true);
    try {
      const cat = await onCreate(name, at);
      setNewName("");
      setAdding(false);
      onPick(cat.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the type.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        // Close only the picker, not the "Add item" screen underneath.
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Choose type"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-stone-100 p-4">
          {at !== null ? (
            <button aria-label="Back" onClick={() => setAt(here?.parent_id ?? null)} className="rounded-full p-2 hover:bg-stone-100">
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : (
            <FolderTree className="m-2 h-6 w-6 text-teal-700" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Choose type</h2>
            <p className="truncate text-sm text-stone-500">{path.length ? path.map((c) => c.name).join(" › ") : "All types"}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {here && (
            <button
              onClick={() => onPick(here.id)}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-4 text-lg font-bold text-white"
            >
              <Check className="h-6 w-6" /> Choose “{here.name}”
            </button>
          )}

          {list.length === 0 && !adding && (
            <p className="px-2 py-6 text-center text-stone-500">
              {here ? `No sub-types inside “${here.name}”.` : "No types yet. Add the first one, e.g. “Shirt”."}
            </p>
          )}

          <ul className="space-y-2">
            {list.map((c) => {
              const hasKids = childrenOf(idx, c.id).length > 0;
              const selected = c.id === value;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => (hasKids ? setAt(c.id) : onPick(c.id))}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-semibold ring-2 ${
                      selected ? "bg-teal-50 ring-teal-600" : "bg-stone-50 ring-transparent hover:bg-stone-100"
                    }`}
                  >
                    <span className="flex-1">{c.name}</span>
                    {selected && <Check className="h-6 w-6 text-teal-700" />}
                    {hasKids && (
                      <span className="flex items-center text-sm font-normal text-stone-500">
                        {childrenOf(idx, c.id).length} <ChevronRight className="h-6 w-6" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {adding ? (
            <div className="mt-3 flex gap-2">
              <input
                autoFocus
                value={newName}
                maxLength={80}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
                placeholder={here ? `Inside “${here.name}”` : "e.g. Shirt"}
                className="min-w-0 flex-1 rounded-2xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-teal-700"
              />
              <button
                onClick={() => void create()}
                disabled={busy || !newName.trim()}
                className="grid w-20 place-items-center rounded-2xl bg-teal-700 font-bold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Add"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-4 font-semibold text-stone-600"
            >
              <Plus className="h-5 w-5" /> New type {here ? `inside “${here.name}”` : ""}
            </button>
          )}

          {allowNone && at === null && (
            <button onClick={() => onPick(null)} className="mt-3 w-full rounded-2xl py-3 text-stone-500 underline">
              No type
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
