import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TOUCH_LAYOUT_QUERY = "(max-width: 639px), (pointer: coarse)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

// Phone-sized windows and touch screens: tasks drag from a handle only, so a
// finger on the rest of the row scrolls the page instead of grabbing the task.
export function useTouchLayout() {
  const [touchLayout, setTouchLayout] = React.useState(() => window.matchMedia(TOUCH_LAYOUT_QUERY).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(TOUCH_LAYOUT_QUERY);
    const onChange = () => setTouchLayout(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return touchLayout;
}
