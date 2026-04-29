/**
 * ToolWindowPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders one active tool window inside an anchor.
 * Includes a JetBrains-style header with:
 *   - Tool window title
 *   - Collapse button (×)
 *   - Optional tab strip when multiple tools share the same anchor
 */

import { Minus } from "lucide-react";
import { useToolWindowStore } from "./toolWindowStore";
import { getToolsForAnchor, getToolWindowById } from "./toolWindowRegistry";
import { PanelRenderer } from "../layout/PanelRenderer";
import { type ToolWindowAnchor } from "./toolWindowTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ToolWindowPanelProps {
  anchor: ToolWindowAnchor;
  activeToolId: string;
}

// ─── Header tab (JetBrains shows sibling tools as tabs in the header) ─────────

function HeaderTab({
  toolId,
  isActive,
  onClick,
}: {
  toolId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const tool = getToolWindowById(toolId);
  if (!tool) return null;
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "0 10px",
        height: "100%",
        border: "none",
        borderBottom: isActive
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        background: isActive ? "var(--bg-sidebar-active)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-subtle)",
        fontSize: 11,
        fontFamily: "var(--font-ui)",
        fontWeight: isActive ? 500 : 400,
        cursor: "pointer",
        letterSpacing: "0.01em",
        transition: "color 0.1s ease, background 0.1s ease",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.color =
            "var(--text-secondary)";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.color = "var(--text-subtle)";
      }}
    >
      <Icon size={12} strokeWidth={1.8} />
      {tool.label}
    </button>
  );
}

// ─── ToolWindowPanel ──────────────────────────────────────────────────────────

export function ToolWindowPanel({
  anchor,
  activeToolId,
}: ToolWindowPanelProps) {
  const activateTool = useToolWindowStore((s) => s.activateTool);
  const collapseAnchor = useToolWindowStore((s) => s.collapseAnchor);

  const tool = getToolWindowById(activeToolId);
  const siblingsInAnchor = getToolsForAnchor(anchor);

  if (!tool) return null;

  // Fake tab object for PanelRenderer (adapts to existing system)
  const fakeTab = {
    id: `tw-${tool.id}`,
    title: tool.label,
    contentType: tool.contentType,
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 30,
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-app)",
          flexShrink: 0,
          gap: 0,
        }}
      >
        {/* Tab strip — all tools in this anchor shown as tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {siblingsInAnchor.map((t) => (
            <HeaderTab
              key={t.id}
              toolId={t.id}
              isActive={t.id === activeToolId}
              onClick={() => activateTool(t.id)}
            />
          ))}
        </div>

        {/* Collapse button */}
        <button
          onClick={() => collapseAnchor(anchor)}
          title="Hide"
          style={{
            width: 28,
            height: "100%",
            border: "none",
            background: "transparent",
            color: "var(--text-faint)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "color 0.1s ease, background 0.1s ease",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "var(--text-primary)";
            el.style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "var(--text-faint)";
            el.style.background = "transparent";
          }}
        >
          <Minus size={13} strokeWidth={2} />
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <PanelRenderer tab={fakeTab as any} groupId={`tw-group-${anchor}`} />
      </div>
    </div>
  );
}
