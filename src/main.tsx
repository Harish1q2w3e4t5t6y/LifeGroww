import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import App from "./App.tsx";
import "./index.css";

// Experimental Home Stock app (/stock) and the phone "which app?" screen.
// Separate from Lifegrow; to delete it, see src/stock/REMOVE.md.
import { pickAppForThisVisit } from "./stock/appChoice";
const StockApp = lazy(() => import("./stock/StockApp.tsx"));
const AppChooser = lazy(() => import("./stock/AppChooser.tsx"));
const pick = pickAppForThisVisit();
if (pick === "stock" && !location.pathname.startsWith("/stock")) history.replaceState(null, "", "/stock");

createRoot(document.getElementById("root")!).render(
  pick === "lifegrow" ? (
    <App />
  ) : (
    <Suspense fallback={null}>{pick === "stock" ? <StockApp /> : <AppChooser />}</Suspense>
  ),
);
