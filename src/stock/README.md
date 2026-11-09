# Home Stock (experimental)

A simple family stock tracker at **`/stock`**, with **no login**. Every item
has a photo, a name, a count and a **type** from a tree you build (Shirt →
Formal → Full sleeve, as deep as needed). It has big **−** / **+** buttons, a
dashboard (items, pieces, low, out), an **All items** page and a **By type**
page, search, remove, and export (Excel/CSV or print/PDF with photos).

## Types and details

* **By type** tab: tap a type to see what's inside it (sub-types and items),
  with totals for everything inside. The breadcrumb at the top jumps back up.
  **New type** adds one at the level you're on. The ✎ pencil renames a type,
  or deletes it once it's empty (no items, no sub-types).
* **Add item** asks for a **type** by stepping down the tree. Opened from inside
  a type, it starts with that type already chosen. New types can be added
  right in the picker.
* **Settings** (⋮ menu) → **Type must be chosen**: on by default. Turn it off
  to allow items without a type. It's shared by every family phone.
* **More details (optional)** on an item: Price (₹), Size, Colour, Notes.
  Hidden until tapped, so adding an item stays simple. Size and colour show
  under the item's name, and all details go into the Excel export.

It lives inside the Lifegrow website only to try the idea out. It is separate
from Lifegrow: its own code folder, its own database table and photo storage,
and its own phone icon. Lifegrow's data and login are never read or changed.
To take it out again, follow [REMOVE.md](./REMOVE.md).

## How it opens

* **On a phone**, opening the website first shows **"Which app?"** with two
  big buttons, before any Lifegrow login:
  * **Home Stock** opens the stock list straight away (no login).
  * **Lifegrow** goes to the normal Lifegrow login, as before.

  "Always open this app on this phone" (ticked by default) remembers the
  choice, so your parents' phones go straight to Home Stock every time. Home
  Stock's ⋮ menu → **Switch app** shows the choice screen again.
* **On a computer**, nothing changes: the website opens Lifegrow.
* **`/stock`** always opens Home Stock, on any device.
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
2. **Phones:** open the website. Tap **Home Stock** and keep "Always open"
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
| `src/stock/StockApp.tsx` | Home Stock entry point, home-screen name/icon |
| `src/stock/AppChooser.tsx`, `appChoice.ts` | The phone "Which app?" screen and its rules |
| `src/stock/components/*` | Screens: list, by-type, add/change, type picker, settings, print view |
| `src/stock/lib/*` | Supabase client (no session), data calls, pure logic, types tree (`tree.ts`) |
| `src/stock/stock.test.ts` | Tests |
| `src/stock/supabase-*.sql` | Database setup / removal |
| `public/stock/*` | Phone icon and manifest |
| `src/main.tsx` | The marked lines that pick Lifegrow / Home Stock / chooser |
