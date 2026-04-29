/**
 * IDELayout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Top-level JetBrains-style layout engine.
 *
 * Structure:
 *   ┌─────────────────────────────────────────────────────┐
 *   │                    TitleBar                         │
 *   ├────┬──────────┬──────────────────────┬─────────────┤
 *   │    │  LEFT    │                      │    RIGHT    │
 *   │ AB │  TOOL    │    CENTER (editor)   │    TOOL     │
 *   │    │  WINDOW  │                      │    WINDOW   │
 *   │    ├──────────┴──────────────────────┴─────────────┤
 *   │    │              BOTTOM TOOL WINDOW               │
 *   ├────┴───────────────────────────────────────────────┤
 *   │                    StatusBar                        │
 *   └─────────────────────────────────────────────────────┘
 *
 * Key behaviors:
 *   - Tool windows slide in/out by changing CSS width/height (no remount)
 *   - Editor area grows/shrinks via flex to fill remaining space
 *   - Resizers only render when their anchor is open
 *   - Center always renders (never unmounts — preserves editor state)
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

// ── Existing systems ──────────────────────────────────────────────────────────
import { useIDEStore } from "../store/ideStore";
import { DockAreaView } from "./DockAreaView";
import { DragPreview } from "./DragPreview";

// ── New tool window system ────────────────────────────────────────────────────
import { useToolWindowStore } from "../toolwindows/toolWindowStore";
import { ActivityBar } from "../toolwindows/ActivityBar";
import { ToolWindowPanel } from "../toolwindows/ToolWindowPanel";
import { ToolWindowResizer } from "../toolwindows/ToolWindowResizer";

// ─── IDELayout ────────────────────────────────────────────────────────────────

export function IDELayout() {
  // ── Existing store — still needed for center editor area ──────────────────
  const areas = useIDEStore((s) => s.areas);
  const dragState = useIDEStore((s) => s.dragState);
  const updateDragPos = useIDEStore((s) => s.updateDragPos);
  const endDrag = useIDEStore((s) => s.endDrag);

  // ── Tool window store ─────────────────────────────────────────────────────
  const leftState = useToolWindowStore((s) => s.left);
  const rightState = useToolWindowStore((s) => s.right);
  const bottomState = useToolWindowStore((s) => s.bottom);

  const leftOpen = leftState.activeToolId !== null;
  const rightOpen = rightState.activeToolId !== null;
  const bottomOpen = bottomState.activeToolId !== null;

  // ── Global drag listeners for tab drag (existing system) ──────────────────
  useEffect(() => {
    if (!dragState.isDragging) return;
    const onMove = (e: MouseEvent) => updateDragPos(e.clientX, e.clientY);
    const onUp = () => endDrag();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState.isDragging, updateDragPos, endDrag]);

  // ── Center area (editor) from existing store ──────────────────────────────
  const center = areas.find((a) => a.slot === "center");

  return (
    <div
      className="dock-layout"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100vh",
        background: "var(--bg-primary)",
        fontFamily: "var(--font-ui)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <TitleBar />

      {/* ── Main workspace ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Activity Bar — always visible */}
        <ActivityBar />

        {/* ── Left tool window ──────────────────────────────────────────────── */}
        {leftOpen && (
          <>
            <div
              style={{
                width: leftState.size,
                flexShrink: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ToolWindowPanel
                anchor="left"
                activeToolId={leftState.activeToolId!}
              />
            </div>
            <ToolWindowResizer anchor="left" />
          </>
        )}

        {/* ── Center + Bottom column ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 200,
          }}
        >
          {/* Editor area */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {center && <DockAreaView area={center} />}
          </div>

          {/* Bottom tool window */}
          {bottomOpen && (
            <>
              <ToolWindowResizer anchor="bottom" />
              <div
                style={{
                  height: bottomState.size,
                  flexShrink: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <ToolWindowPanel
                  anchor="bottom"
                  activeToolId={bottomState.activeToolId!}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Right tool window ─────────────────────────────────────────────── */}
        {rightOpen && (
          <>
            <ToolWindowResizer anchor="right" />
            <div
              style={{
                width: rightState.size,
                flexShrink: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ToolWindowPanel
                anchor="right"
                activeToolId={rightState.activeToolId!}
              />
            </div>
          </>
        )}
      </div>

      <StatusBar />

      {/* Tab drag preview (existing system) */}
      {dragState.isDragging && dragState.tab && (
        <DragPreview tab={dragState.tab} x={dragState.x} y={dragState.y} />
      )}
    </div>
  );
}

// ─── TitleBar (unchanged from original) ──────────────────────────────────────

function ViewMenu() {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
  const ref = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const openTool = useToolWindowStore((s) => s.openTool);
  const collapseAnchor = useToolWindowStore((s) => s.collapseAnchor);
  const leftOpen = useToolWindowStore((s) => s.left.activeToolId !== null);
  const rightOpen = useToolWindowStore((s) => s.right.activeToolId !== null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      )
        setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const menuItems = [
    {
      type: "toggle",
      label: "Explorer",
      checked: leftOpen,
      action: () => (leftOpen ? collapseAnchor("left") : openTool("explorer")),
    },
    {
      type: "toggle",
      label: "Properties",
      checked: rightOpen,
      action: () =>
        rightOpen ? collapseAnchor("right") : openTool("inspector"),
    },
    { type: "divider" },
    {
      type: "action",
      label: "Terminal",
      shortcut: "⌃`",
      action: () => openTool("terminal"),
    },
    { type: "action", label: "Logs", action: () => openTool("logs") },
    { type: "action", label: "Cluster Diff", action: () => openTool("diff") },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => {
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setMenuPos({ top: r.bottom + 6, left: r.left });
          }
          setOpen((o) => !o);
        }}
        style={{
          background: open ? "var(--bg-elevated)" : "transparent",
          border: "none",
          color: open ? "var(--text-primary)" : "var(--text-subtle)",
          fontSize: "var(--font-size-sm)",
          padding: "3px 8px",
          cursor: "pointer",
          borderRadius: "var(--radius-xs)",
          fontFamily: "var(--font-ui)",
          transition: "var(--ease-fast)",
        }}
        onMouseEnter={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background =
              "var(--bg-elevated)";
        }}
        onMouseLeave={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        View
      </button>

      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              background: "var(--bg-modal)",
              backdropFilter: "var(--blur-md)",
              WebkitBackdropFilter: "var(--blur-md)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "4px 0",
              minWidth: 200,
              boxShadow: "var(--shadow-lg)",
              zIndex: 9999,
            }}
          >
            {menuItems.map((item, i) => {
              if (item.type === "divider") {
                return (
                  <div
                    key={i}
                    style={{
                      height: 1,
                      background: "var(--border-subtle)",
                      margin: "3px 0",
                    }}
                  />
                );
              }
              return (
                <ViewMenuItem
                  key={item.label}
                  label={item.label!}
                  checked={item.checked}
                  shortcut={(item as any).shortcut}
                  onClick={() => {
                    item.action?.();
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ViewMenuItem({
  label,
  checked,
  shortcut,
  onClick,
}: {
  label: string;
  checked?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 14px 5px 10px",
        cursor: "pointer",
        background: hov ? "var(--bg-sidebar-active)" : "transparent",
        color: hov ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: "var(--font-size-sm)",
        transition: "var(--ease-fast)",
        borderRadius: "var(--radius-xs)",
        margin: "1px 4px",
      }}
    >
      <span
        style={{
          width: 14,
          fontSize: 10,
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        {checked === true ? "✓" : ""}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: 10,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}

function TitleBar() {
  const projectPath = useIDEStore((s) => s.projectPath);
  const closeProject = useIDEStore((s) => s.closeProject);
  const projectName = projectPath?.split("/").pop() ?? "Endfield";

  return (
    <div
      style={{
        height: 34,
        background: "var(--bg-toolbar)",
        backdropFilter: "var(--blur-md)",
        WebkitBackdropFilter: "var(--blur-md)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 76,
        paddingRight: 14,
        gap: 8,
        flexShrink: 0,
      }}
      className="drag-region"
    >
      <div
        className="no-drag"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <div
          onClick={closeProject}
          title="Back to start"
          style={{
            width: 16,
            height: 16,
            borderRadius: "var(--radius-xs)",
            background:
              "linear-gradient(135deg, var(--ctp-mauve), var(--ctp-lavender))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 7,
            color: "var(--ctp-crust)",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            transition: "var(--ease-fast)",
            userSelect: "none",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.opacity = "0.7")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.opacity = "1")
          }
        >
          E
        </div>
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            letterSpacing: "0.08em",
            userSelect: "none",
          }}
        >
          ENDFIELD
        </span>
      </div>

      <span
        className="no-drag"
        style={{ color: "var(--border-strong)", fontSize: 12 }}
      >
        ·
      </span>

      <span
        className="no-drag"
        style={{
          color: "var(--text-muted)",
          fontSize: "var(--font-size-sm)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.01em",
          userSelect: "none",
        }}
      >
        {projectName}
      </span>

      <div
        className="no-drag"
        style={{ display: "flex", gap: 2, marginLeft: 8 }}
      >
        <ViewMenu />
      </div>

      <div data-tauri-drag-region style={{ flex: 1, height: "100%" }} />

      <span
        className="no-drag"
        style={{
          color: "var(--text-faint)",
          fontSize: 9,
          padding: "2px 6px",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-full)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.05em",
        }}
      >
        alpha
      </span>
    </div>
  );
}

function StatusBar() {
  const selectedEntity = useIDEStore((s) => s.selectedEntity);
  const projectPath = useIDEStore((s) => s.projectPath);
  const clusterStatus = useIDEStore((s) => s.clusterStatus);
  const nodes = useIDEStore((s) => s.nodes);

  const allGreen = clusterStatus?.fields.every((f) => f.status === "green");
  const hasProblem = clusterStatus?.fields.some((f) => f.status === "red");

  const dotColor = !clusterStatus
    ? "var(--status-unknown)"
    : hasProblem
      ? "var(--status-error)"
      : allGreen
        ? "var(--status-ok)"
        : "var(--status-warn)";
  const dotLabel = !clusterStatus
    ? "no kubectl"
    : hasProblem
      ? "degraded"
      : allGreen
        ? "healthy"
        : "partial";

  return (
    <div
      style={{
        height: 22,
        background: "var(--bg-statusbar)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 14,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          {dotLabel}
        </span>
      </div>
      {nodes.length > 0 && (
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          {nodes.length} {nodes.length === 1 ? "field" : "fields"}
        </span>
      )}
      {selectedEntity && (
        <span
          style={{
            color: "var(--text-subtle)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          {selectedEntity.type}: {selectedEntity.label}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 360,
        }}
      >
        {projectPath ?? "Endfield IDE"}
      </span>
    </div>
  );
}
