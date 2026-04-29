/**
 * useTerminalShortcut.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Global keyboard shortcut hook for the terminal panel.
 *
 * Shortcuts:
 *   Ctrl+`  (backtick)       — toggle terminal panel visibility
 *   Ctrl+Shift+`             — open a new terminal tab (the TerminalTabsPanel
 *                              handles this internally via its "+" button, but
 *                              this shortcut also ensures the panel is visible)
 *
 * Usage: Call useTerminalShortcut() once in App.tsx or DockLayout.tsx.
 */

import { useEffect } from "react";
import { useIDEStore } from "../store/ideStore";

export function useTerminalShortcut() {
  const setAreaVisible = useIDEStore((s) => s.setAreaVisible);
  const openTab = useIDEStore((s) => s.openTab);
  const areas = useIDEStore((s) => s.areas);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isBacktick = e.key === "`";
      const ctrl = e.ctrlKey || e.metaKey; // Cmd on Mac, Ctrl on Win/Linux

      if (!ctrl || !isBacktick) return;

      e.preventDefault();

      const bottomArea = areas.find((a) => a.slot === "bottom");
      const isVisible = bottomArea?.visible ?? false;

      if (e.shiftKey) {
        // Ctrl+Shift+` — show panel and ensure terminal tab is active
        openTab(
          {
            id: "tab-terminal",
            title: "Terminal",
            contentType: "terminal",
            icon: "terminal",
          },
          "bottom",
        );
        setAreaVisible("bottom", true);
      } else {
        // Ctrl+` — toggle panel
        if (!isVisible) {
          // Make sure terminal tab exists
          openTab(
            {
              id: "tab-terminal",
              title: "Terminal",
              contentType: "terminal",
              icon: "terminal",
            },
            "bottom",
          );
        }
        setAreaVisible("bottom", !isVisible);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [areas, setAreaVisible, openTab]);
}
