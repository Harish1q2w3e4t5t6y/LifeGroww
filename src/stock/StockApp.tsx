// Home Stock — experimental family stock tracker, served at /stock.
// No login. Fully separate from Lifegrow: own table and photo bucket, own
// home-screen icon. To remove it, see src/stock/REMOVE.md.

import { useEffect } from "react";
import { Toaster } from "sonner";
import { stockConfigured } from "./lib/client";
import { StockHome } from "./components/StockHome";

// Give /stock its own name and icon when added to a phone's home screen.
function useHomeScreenIdentity() {
  useEffect(() => {
    document.title = "Home Stock";
    const tags: HTMLElement[] = [];
    const add = (tag: string, attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      tags.push(el);
    };
    add("link", { rel: "manifest", href: "/stock/manifest.webmanifest" });
    add("link", { rel: "apple-touch-icon", href: "/stock/icon-180.png" });
    add("meta", { name: "apple-mobile-web-app-title", content: "Home Stock" });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "mobile-web-app-capable", content: "yes" });
    add("meta", { name: "theme-color", content: "#0f766e" });
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const oldIcon = icon?.href;
    if (icon) icon.href = "/stock/icon.svg";
    return () => {
      tags.forEach((t) => t.remove());
      if (icon && oldIcon) icon.href = oldIcon;
    };
  }, []);
}

export default function StockApp() {
  useHomeScreenIdentity();

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <Toaster position="top-center" richColors />
      {!stockConfigured ? (
        <p className="p-8 text-center text-lg">Supabase is not configured for this site.</p>
      ) : (
        <StockHome />
      )}
    </div>
  );
}
