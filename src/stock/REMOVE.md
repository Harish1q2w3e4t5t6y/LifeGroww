# Removing Arumugam Stock

Ask Claude "remove the Arumugam Stock app", or do it yourself:

1. **Code**
   * delete the folders `src/stock/` and `public/stock/` (copy
     `supabase-remove.sql` first)
   * in `src/main.tsx`, delete the marked Arumugam Stock block (`lazy`/`Suspense`
     import, `pickAppForThisVisit`, `StockApp`, `AppChooser`, `pick`, the
     `replaceState` line and the `pick === … ?` choice), leaving just
     `createRoot(document.getElementById("root")!).render(<App />);`
   * run `npm test` and `npm run build`, commit and push.
2. **Supabase**
   * Storage → `stock-photos` → select all files → Delete
   * SQL Editor → run `supabase-remove.sql`
3. **Phones:** long-press the Arumugam Stock icon → Remove. Phones that remembered
   "Arumugam Stock" will simply open Lifegrow once the code is gone.

Lifegrow's own table (`user_data`), login, MCP server and settings are not
affected by any of these steps.
