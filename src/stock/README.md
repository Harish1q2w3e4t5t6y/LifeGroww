# Arumugam Stock (experimental)

A simple family stock tracker at **`/stock`**, with **no login**. Every item
has a photo, a name, a count and a **type** from a tree you build (Shirt →
Formal → Full sleeve, as deep as needed). It has big **−** / **+** buttons, a
dashboard (items, pieces, low, out), an **All items** page and a **By type**
page, search, remove, and export (Excel/CSV or print/PDF with photos).

## Types and details

* **By type** tab opens on a **tree** of the whole stock (types → sub-types →
  products → sizes) with a count on every line. ⊟ / ⊞ opens or closes a
  branch, and **Open all / Close all** does every branch at once. Tapping a
  type's name opens its page; tapping a product or size opens its size table
  (or its edit screen if it has no sizes). A red / orange dot on a type means
  something inside is out / low.
* A type's page shows its sub-types and items with photos, and totals for
  everything inside. The breadcrumb at the top ("All types") goes back to the tree.
  **New type** adds one at the level you're on. The ✎ pencil renames a type,
  or deletes it once it's empty (no items, no sub-types).
* **Add item** asks for a **type** by stepping down the tree. Opened from inside
  a type, it starts with that type already chosen. New types can be added
  right in the picker.
* **Settings** (⋮ menu) → **Type must be chosen**: on by default. Turn it off
  to allow items without a type. It's shared by every family phone.
* **More details (optional)** on an item: Price (₹), Colour, Notes. Hidden
  until tapped, so adding an item stays simple.

## Seeing a photo in full

The ⤢ button on a product's photo (or tapping the photo in its size table, its
edit screen or the tree) opens it full screen, showing the whole picture
uncropped. Zoom by pinching with two fingers, double-tapping, or the + / −
buttons, and drag to move around when zoomed in. ✕, the phone's Back button,
or tapping the dark edge closes it.

## Sizes inside a product

A product can have a **size table** that you type yourself, e.g. *Sigma shirt*:
L 12 · M 400 · S 4 · XL 42. Sizes are optional; a product without sizes keeps
one big − / + count.

* **Add item** → **Add sizes (S, M, L…)** turns the single count into a table.
  **Add size** adds a row, ✕ removes one. Each size name must be different.
* On the main screen, a product with sizes shows every size and its count
  (red = none, orange = low) plus the total. Tapping it opens the size table
  with big − / + on every size.
* Dashboard **Low / Out** count each size separately, so "M is out" shows up.
  Type totals and the Excel export (one row per size) include the sizes.

It lives inside the Lifegrow website only to try the idea out. It is separate
from Lifegrow: its own code folder, its own database table and photo storage,
and its own phone icon. Lifegrow's data and login are never read or changed.
To take it out again, follow [REMOVE.md](./REMOVE.md).

## How it opens

* **On a phone**, opening the website first shows **"Which app?"** with two
  big buttons, before any Lifegrow login:
  * **Arumugam Stock** opens the stock list straight away (no login).
  * **Lifegrow** goes to the normal Lifegrow login, as before.

  "Always open this app on this phone" (ticked by default) remembers the
  choice, so your parents' phones go straight to Arumugam Stock every time. Home
  Stock's ⋮ menu → **Switch app** shows the choice screen again.
* **On a computer**, nothing changes: the website opens Lifegrow.
* **`/stock`** always opens Arumugam Stock, on any device.
* ChatGPT sign-in (`/oauth/consent`) and Lifegrow's own login links are never
  interrupted by the choice screen.

## Open to anyone with the link

By choice there is no login. Anyone who opens `/stock` can see, add, change and
delete stock items and photos. Only the `stock_items` table and the
`stock-photos` bucket are open. Lifegrow's `user_data` stays protected by its
login.

## One-time setup

1. **Supabase → SQL Editor:** paste and run [`supabase-setup.sql`](./supabase-setup.sql).
   It's safe to run again, and it also upgrades the earlier login-based version.
2. **Phones:** open the website. Tap **Arumugam Stock** and keep "Always open"
   ticked. To get its own icon, add it to the home screen:
   * **Android (Chrome):** ⋮ → **Add to Home screen**
   * **iPhone (Safari):** Share → **Add to Home Screen**

   While testing at home on the same Wi-Fi, use `http://<your-mac-ip>:8080`.
   The home-screen icon works fully only on the live `https://` site.

## How it works

* `+` / `−` change the count on the server in one step (`stock_adjust`), so two
  phones tapping at once both count, and it never goes below 0.
* Photos are shrunk on the phone to about 50–150 KB before upload, so the free
  1 GB of Supabase storage holds thousands of them.
* "Low" means 1–2 left (`LOW_AT` in `lib/logic.ts`). "Out" means 0. The item
  stays in the list so you can see what's missing.
* The list reloads when the app is opened again, and you can also tap ⟳.

## Files

| Path | What |
|---|---|
| `src/stock/StockApp.tsx` | Arumugam Stock entry point, home-screen name/icon |
| `src/stock/AppChooser.tsx`, `appChoice.ts` | The phone "Which app?" screen and its rules |
| `src/stock/components/*` | Screens: list, tree, by-type, add/change, sizes table, type picker, settings, print view |
| `src/stock/lib/*` | Supabase client (no session), data calls, pure logic, types tree (`tree.ts`) |
| `src/stock/stock.test.ts` | Tests |
| `src/stock/supabase-*.sql` | Database setup / removal |
| `public/stock/*` | Phone icon and manifest |
| `src/main.tsx` | The marked lines that pick Lifegrow / Arumugam Stock / chooser |
