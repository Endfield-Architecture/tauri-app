/**
 * ToolWindowResizer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin drag handle for resizing tool window anchors.
 * JetBrains uses a 4px-wide invisible hit zone with a 1px visual divider.
 */

import { useRef, useCallback } from "react";
import { useToolWindowStore } from "./toolWindowStore";
import { type ToolWindowAnchor } from "./toolWindowTypes";

interface ToolWindowResizerProps {
  anchor: ToolWindowAnchor;
}

export function ToolWindowResizer({ anchor }: ToolWindowResizerProps) {
  const resizeAnchor = useToolWindowStore((s) => s.resizeAnchor);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const isVertical = anchor === "bottom";

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = isVertical ? e.clientY : e.clientX;
      startSize.current = useToolWindowStore.getState()[anchor].size;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = isVertical
          ? startPos.current - ev.clientY // bottom: drag up = larger
          : anchor === "left"
            ? ev.clientX - startPos.current // left: drag right = larger
            : startPos.current - ev.clientX; // right: drag left = larger

        resizeAnchor(anchor, startSize.current + delta);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = isVertical ? "ns-resize" : "ew-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [anchor, isVertical, resizeAnchor],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        ...(isVertical
          ? {
              width: "100%",
              height: 4,
              cursor: "ns-resize",
              background: "transparent",
              borderTop: "1px solid var(--border-subtle)",
              position: "relative",
            }
          : {
              width: 4,
              height: "100%",
              cursor: "ew-resize",
              background: "transparent",
              ...(anchor === "left"
                ? { borderRight: "1px solid var(--border-subtle)" }
                : { borderLeft: "1px solid var(--border-subtle)" }),
            }),
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        if (!dragging.current)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    />
  );
}
