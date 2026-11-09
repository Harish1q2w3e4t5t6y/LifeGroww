// Phone-only "which app?" screen, shown before any Lifegrow login.
// Part of the Home Stock experiment; see REMOVE.md.
import { useState } from "react";
import { PackageOpen } from "lucide-react";
import { chooseApp } from "./appChoice";

export default function AppChooser() {
  const [remember, setRemember] = useState(true);

  return (
    <div className="flex min-h-screen flex-col justify-center bg-stone-100 px-6 py-10 text-stone-900">
      <h1 className="mb-8 text-center text-2xl font-bold">Which app?</h1>

      <div className="mx-auto grid w-full max-w-sm gap-4">
        <button
          onClick={() => chooseApp("stock", remember)}
          className="flex items-center gap-5 rounded-3xl bg-white p-5 text-left shadow-sm ring-2 ring-teal-600 active:scale-[0.98]"
        >
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white">
            <PackageOpen className="h-11 w-11" />
          </span>
          <span>
            <span className="block text-2xl font-extrabold">Home Stock</span>
            <span className="text-stone-500">What we have at home</span>
          </span>
        </button>

        <button
          onClick={() => chooseApp("lifegrow", remember)}
          className="flex items-center gap-5 rounded-3xl bg-white p-5 text-left shadow-sm ring-2 ring-indigo-500 active:scale-[0.98]"
        >
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-3xl font-bold text-white">
            E
          </span>
          <span>
            <span className="block text-2xl font-extrabold">Lifegrow</span>
            <span className="text-stone-500">Tasks &amp; habits</span>
          </span>
        </button>
      </div>

      <label className="mx-auto mt-8 flex max-w-sm items-center gap-3 text-stone-600">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-6 w-6 accent-teal-700"
        />
        Always open this app on this phone
      </label>
    </div>
  );
}
