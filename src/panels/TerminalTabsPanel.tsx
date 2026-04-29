/**
 * TerminalTabsPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-tab terminal panel, VS Code-style.
 *
 * Features:
 *  - Multiple simultaneous terminal sessions (each with its own PTY)
 *  - Add / close terminal tabs
 *  - The active terminal is rendered; inactive ones are hidden (not unmounted)
 *    so their PTY processes stay alive and their scroll history is preserved.
 *  - "+" button opens a new shell session
 *  - "×" on a tab kills that PTY and removes the tab
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { TerminalPanel, TerminalPanelHandle } from "./TerminalPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TerminalTab {
  id: string; // unique session ID, e.g. "term-1"
  title: string; // displayed in the tab bar
  exited: boolean; // true when the shell process has died
}

let tabCounter = 0;
function makeSessionId(): string {
  return `term-${++tabCounter}`;
}

// ─── Tab Bar Button ───────────────────────────────────────────────────────────

function TabButton({
  tab,
  isActive,
  onActivate,
  onClose,
}: {
  tab: TerminalTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  return (
    <button
      onClick={onActivate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "0 10px 0 12px",
        height: "100%",
        background: isActive ? "rgba(205, 214, 244, 0.08)" : "transparent",
        border: "none",
        borderBottom: isActive ? "2px solid #b4befe" : "2px solid transparent",
        color: isActive ? "#cdd6f4" : "#6c7086",
        fontSize: "12px",
        fontFamily: "var(--font-ui, system-ui)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.1s, color 0.1s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLButtonElement).style.color = "#a6adc8";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLButtonElement).style.color = "#6c7086";
      }}
    >
      {/* Terminal icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M2 4l4 4-4 4M9 12h5"
          stroke={tab.exited ? "#f38ba8" : isActive ? "#b4befe" : "#6c7086"}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span style={{ color: tab.exited ? "#f38ba8" : undefined }}>
        {tab.title}
        {tab.exited && " [exited]"}
      </span>

      {/* Close button */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          borderRadius: "3px",
          marginLeft: "2px",
          fontSize: "14px",
          lineHeight: 1,
          color: "#6c7086",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLSpanElement).style.background =
            "rgba(243,139,168,0.2)";
          (e.currentTarget as HTMLSpanElement).style.color = "#f38ba8";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLSpanElement).style.background = "transparent";
          (e.currentTarget as HTMLSpanElement).style.color = "#6c7086";
        }}
        title="Kill terminal"
        role="button"
        aria-label="Close terminal tab"
      >
        ×
      </span>
    </button>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function TerminalTabsPanel() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Refs to each TerminalPanel instance so we can call .fit() imperatively
  const panelRefs = useRef<Map<string, TerminalPanelHandle>>(new Map());

  // ── Open first terminal on mount ──────────────────────────────────────────
  useEffect(() => {
    openNewTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fit active terminal whenever active tab changes ────────────────────
  useEffect(() => {
    if (!activeId) return;
    // Wait for React to un-hide the panel
    requestAnimationFrame(() => {
      panelRefs.current.get(activeId)?.fit();
      panelRefs.current.get(activeId)?.focus();
    });
  }, [activeId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openNewTab = useCallback(() => {
    const id = makeSessionId();
    const count = tabCounter; // capture current count for title
    const tab: TerminalTab = { id, title: `Terminal ${count}`, exited: false };
    setTabs((prev) => [...prev, tab]);
    setActiveId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        // Switch active tab if we're closing the active one
        if (id === activeId && next.length > 0) {
          const newActive = next[Math.max(0, idx - 1)];
          setActiveId(newActive.id);
        } else if (next.length === 0) {
          setActiveId(null);
        }
        return next;
      });
      panelRefs.current.delete(id);
    },
    [activeId],
  );

  const markExited = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exited: true } : t)),
    );
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#1e1e2e",
        overflow: "hidden",
      }}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          height: "34px",
          background: "#181825",
          borderBottom: "1px solid rgba(69, 71, 90, 0.6)",
          flexShrink: 0,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeId}
            onActivate={() => setActiveId(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}

        {/* New terminal button */}
        <button
          onClick={openNewTab}
          title="New terminal (Ctrl+Shift+`)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "100%",
            background: "transparent",
            border: "none",
            color: "#6c7086",
            fontSize: "18px",
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.1s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#cdd6f4";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#6c7086";
          }}
        >
          +
        </button>

        {/* Spacer to push controls to the right */}
        <div style={{ flex: 1 }} />

        {/* Kill all / clear button area — reserved for future expansion */}
      </div>

      {/* ── Terminal panes ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {tabs.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#585b70",
              fontSize: "13px",
              fontFamily: "var(--font-ui)",
            }}
          >
            No terminal sessions. Click + to open one.
          </div>
        )}

        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              // Mount all panels but only show the active one.
              // Hidden panels stay mounted so their PTY process and scroll
              // history is preserved — same trick VS Code uses.
              position: "absolute",
              inset: 0,
              display: tab.id === activeId ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <TerminalPanel
              sessionId={tab.id}
              isActive={tab.id === activeId}
              onExit={(id) => markExited(id)}
              ref={(handle) => {
                if (handle) panelRefs.current.set(tab.id, handle);
                else panelRefs.current.delete(tab.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
