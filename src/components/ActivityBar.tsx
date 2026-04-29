/**
 * ActivityBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * VS Code-style vertical activity bar.
 *
 * Architecture:
 *   - Config-driven: items live in activityBarConfig.ts
 *   - State in activityBarStore.ts (Zustand, decoupled from IDEStore)
 *   - Panel integration via useIDEStore (openTab / setAreaVisible)
 *   - Tooltip built inline (no external dep) with 300ms delay
 *   - Keyboard shortcuts: Ctrl+1…5 map to items by index
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { type LucideIcon } from "lucide-react";

import { useActivityBarStore } from "../store/activityBarStore.ts";
import {
  ACTIVITY_ITEMS,
  ACTIVITY_SECONDARY,
  type ActivityItem,
  type ActivitySecondaryItem,
} from "../activityBarConfig.ts";
import { useIDEStore } from "../store/ideStore"; // adjust to your import path

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_WIDTH = 56;
const ICON_SIZE = 20;

// ─── Inline styles (no Tailwind purge risk for dynamic values) ────────────────

const barStyle: CSSProperties = {
  width: BAR_WIDTH,
  height: "100%",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: "var(--bg-app)",
  borderRight: "1px solid var(--border-subtle)",
  paddingTop: 6,
  paddingBottom: 8,
  gap: 0,
  overflow: "visible",
  position: "relative",
  zIndex: 10,
  userSelect: "none",
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  label: string;
  shortcut?: string;
  visible: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function Tooltip({ label, shortcut, visible, anchorRef }: TooltipProps) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setTop(rect.top + rect.height / 2);
    }
  }, [visible, anchorRef]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: BAR_WIDTH + 6,
        top,
        transform: "translateY(-50%)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "4px 9px",
        pointerEvents: "none",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
        animation: "ef-slidein 0.08s ease-out",
      }}
    >
      <span
        style={{
          color: "var(--text-primary)",
          fontSize: 11,
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      {shortcut && (
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}

// ─── ActivityBarButton ────────────────────────────────────────────────────────

interface ActivityBarButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  isActive: boolean;
  isPanelVisible: boolean;
  onClick: () => void;
}

function ActivityBarButton({
  icon: Icon,
  label,
  shortcut,
  isActive,
  isPanelVisible,
  onClick,
}: ActivityBarButtonProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    tooltipTimerRef.current = setTimeout(() => setTooltipVisible(true), 300);
  };

  const handleMouseLeave = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltipVisible(false);
  };

  // Active = item is selected AND panel is open
  const highlighted = isActive && isPanelVisible;
  // Dimmed = item is selected but panel is hidden (collapsed)
  const dimmed = isActive && !isPanelVisible;

  return (
    <div
      ref={anchorRef}
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left border indicator */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 2,
          height: highlighted ? 20 : 0,
          background: "var(--accent)",
          borderRadius: "0 2px 2px 0",
          transition: "height 0.15s ease",
          flexShrink: 0,
        }}
      />

      <button
        onClick={() => {
          setTooltipVisible(false);
          onClick();
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        title="" // suppress native tooltip
        style={{
          width: "100%",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          borderRadius: 0,
          padding: 0,
          transition: "all 0.1s ease",
          transform: pressed ? "scale(0.88)" : "scale(1)",
        }}
      >
        {/* Icon background pill on hover/active */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s ease, opacity 0.15s ease",
            background: highlighted
              ? "var(--bg-sidebar-active)"
              : "transparent",
          }}
          className="activity-btn-inner"
        >
          <Icon
            size={ICON_SIZE}
            strokeWidth={1.6}
            style={{
              color: highlighted
                ? "var(--ctp-lavender)"
                : dimmed
                  ? "var(--text-muted)"
                  : "var(--text-subtle)",
              transition: "color 0.15s ease",
              flexShrink: 0,
            }}
          />
        </div>
      </button>

      <Tooltip
        label={label}
        shortcut={shortcut}
        visible={tooltipVisible}
        anchorRef={anchorRef}
      />
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        width: 28,
        height: 1,
        background: "var(--border-subtle)",
        margin: "4px 0",
        flexShrink: 0,
      }}
    />
  );
}

// ─── SecondaryButton ─────────────────────────────────────────────────────────

interface SecondaryButtonProps {
  item: ActivitySecondaryItem;
}

function SecondaryButton({ item }: SecondaryButtonProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Icon = item.icon;

  return (
    <div
      ref={anchorRef}
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={() => {
        setHovered(true);
        tooltipTimerRef.current = setTimeout(
          () => setTooltipVisible(true),
          300,
        );
      }}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
        setTooltipVisible(false);
      }}
    >
      <button
        onClick={item.onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        title=""
        style={{
          width: "100%",
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderRadius: 0,
          padding: 0,
          transform: pressed ? "scale(0.88)" : "scale(1)",
          transition: "transform 0.1s ease",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hovered ? "var(--bg-sidebar-hover)" : "transparent",
            transition: "background 0.15s ease",
          }}
        >
          <Icon
            size={18}
            strokeWidth={1.6}
            style={{
              color: hovered ? "var(--text-secondary)" : "var(--text-faint)",
              transition: "color 0.15s ease",
            }}
          />
        </div>
      </button>

      <Tooltip
        label={item.label}
        visible={tooltipVisible}
        anchorRef={anchorRef}
      />
    </div>
  );
}

// ─── ActivityBar ──────────────────────────────────────────────────────────────

/**
 * Drop this into your layout anywhere before the dock panels.
 * It handles all state internally — no props required.
 */
export function ActivityBar() {
  const { activeView, panelVisible, activateView, setPanelVisible } =
    useActivityBarStore();

  const openTab = useIDEStore((s) => s.openTab);
  const setAreaVisible = useIDEStore((s) => s.setAreaVisible);
  const areas = useIDEStore((s) => s.areas);

  // ── Handle item click ──────────────────────────────────────────────────────
  const handleItemClick = useCallback(
    (item: ActivityItem) => {
      const wasActive = activeView === item.id;

      // Update bar state
      activateView(item.id);

      if (wasActive) {
        // Toggle the corresponding dock area
        const area = areas.find((a) => a.slot === item.slot);
        setAreaVisible(item.slot, !area?.visible);
      } else {
        // Open panel if not already open
        openTab(item.tab as any, item.slot);
        setAreaVisible(item.slot, true);
      }
    },
    [activeView, panelVisible, activateView, openTab, setAreaVisible, areas],
  );

  // ── Sync panelVisible from dock area state ─────────────────────────────────
  useEffect(() => {
    if (!activeView) return;
    const item = ACTIVITY_ITEMS.find((i) => i.id === activeView);
    if (!item) return;
    const area = areas.find((a) => a.slot === item.slot);
    if (area) {
      setPanelVisible(area.visible);
    }
  }, [areas, activeView, setPanelVisible]);

  // ── Keyboard shortcuts: Ctrl/Meta + 1…5 ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < ACTIVITY_ITEMS.length) {
        e.preventDefault();
        handleItemClick(ACTIVITY_ITEMS[idx]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleItemClick]);

  // ── Hover style injection (once) ───────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
    .activity-btn-inner:hover {
      background: var(--bg-sidebar-hover) !important;
    }
    .activity-btn-inner:hover svg {
      color: var(--text-secondary) !important;
    }
  `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={barStyle} aria-label="Activity Bar" role="navigation">
      {/* ── Primary items (top) ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {ACTIVITY_ITEMS.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            shortcut={item.shortcut}
            isActive={activeView === item.id}
            isPanelVisible={activeView === item.id ? panelVisible : false}
            onClick={() => handleItemClick(item)}
          />
        ))}
      </div>

      {/* ── Secondary items (bottom) ───────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          paddingBottom: 4,
        }}
      >
        <Divider />
        {ACTIVITY_SECONDARY.map((item) => (
          <SecondaryButton key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
