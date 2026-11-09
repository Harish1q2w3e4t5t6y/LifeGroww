// Family-wide settings (shared by every phone).
import { X } from "lucide-react";
import type { StockSettings } from "../lib/api";

interface Props {
  settings: StockSettings;
  onChange: <K extends keyof StockSettings>(key: K, value: StockSettings[K]) => void;
  onClose: () => void;
}

export function SettingsSheet({ settings, onChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Settings"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X className="h-7 w-7" />
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-4 rounded-2xl bg-stone-50 p-4">
          <span className="flex-1">
            <span className="block text-lg font-semibold">Type must be chosen</span>
            <span className="text-sm text-stone-500">
              When on, every new item needs a type (e.g. Shirt › Formal). Turn off to allow items without one.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Type must be chosen"
            checked={settings.typeRequired}
            onChange={(e) => onChange("typeRequired", e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-8 w-14 shrink-0 rounded-full bg-stone-300 transition peer-checked:bg-teal-700 after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-6" />
        </label>
        <p className="mt-3 text-center text-xs text-stone-400">Applies to every family phone.</p>
      </div>
    </div>
  );
}
