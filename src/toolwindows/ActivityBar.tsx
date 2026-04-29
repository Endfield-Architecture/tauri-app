/**
 * ActivityBar.tsx  (v2 — JetBrains style)
 */

import { useEffect, useRef, useState } from "react";
import { Settings, Bell, type LucideIcon } from "lucide-react";
import { useToolWindowStore } from "./toolWindowStore";
import { TOOL_WINDOW_REGISTRY, getToolsForAnchor } from "./toolWindowRegistry";
import { type ToolWindowDef } from "./toolWindowTypes";

const BAR_WIDTH = 44;
const ICON_SIZE = 18;

function Tooltip({
  label,
  shortcut,
  visible,
  anchorEl,
}: {
  label: string;
  shortcut?: string;
  visible: boolean;
  anchorEl: React.RefObject<HTMLDivElement | null>;
}) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (visible && anchorEl.current) {
      const r = anchorEl.current.getBoundingClientRect();
      setTop(r.top + r.height / 2);
    }
  }, [visible, anchorEl]);

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
        padding: "3px 8px",
        zIndex: 9999,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        whiteSpace: "nowrap",
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

function ToolButton({ tool }: { tool: ToolWindowDef }) {
  const activateTool = useToolWindowStore((s) => s.activateTool);
  const isActive = useToolWindowStore((s) => s.isToolActive(tool.id));

  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const Icon = tool.icon;

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%", flexShrink: 0 }}
      onMouseEnter={() => {
        setHovered(true);
        timerRef.current = setTimeout(() => setTooltipVisible(true), 300);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltipVisible(false);
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 2,
          height: isActive ? 18 : 0,
          background: "var(--accent)",
          borderRadius: "0 2px 2px 0",
          transition: "height 0.12s ease",
        }}
      />
      <button
        onClick={() => {
          setTooltipVisible(false);
          activateTool(tool.id);
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        title=""
        style={{
          width: "100%",
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          transform: pressed ? "scale(0.86)" : "scale(1)",
          transition: "transform 0.08s ease",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? "var(--bg-sidebar-active)"
              : hovered
                ? "var(--bg-sidebar-hover)"
                : "transparent",
            transition: "background 0.12s ease",
          }}
        >
          <Icon
            size={ICON_SIZE}
            strokeWidth={1.6}
            style={{
              color: isActive
                ? "var(--ctp-lavender)"
                : hovered
                  ? "var(--text-secondary)"
                  : "var(--text-subtle)",
              transition: "color 0.12s ease",
            }}
          />
        </div>
      </button>
      <Tooltip
        label={tool.label}
        shortcut={tool.shortcut}
        visible={tooltipVisible}
        anchorEl={ref}
      />
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 24,
        height: 1,
        background: "var(--border-subtle)",
        margin: "3px auto",
        flexShrink: 0,
      }}
    />
  );
}

function SecondaryButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%", flexShrink: 0 }}
      onMouseEnter={() => {
        setHovered(true);
        timerRef.current = setTimeout(() => setTooltipVisible(true), 300);
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltipVisible(false);
      }}
    >
      <button
        onClick={onClick}
        title=""
        style={{
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hovered ? "var(--bg-sidebar-hover)" : "transparent",
            transition: "background 0.12s ease",
          }}
        >
          <Icon
            size={16}
            strokeWidth={1.6}
            style={{
              color: hovered ? "var(--text-secondary)" : "var(--text-faint)",
              transition: "color 0.12s ease",
            }}
          />
        </div>
      </button>
      <Tooltip label={label} visible={tooltipVisible} anchorEl={ref} />
    </div>
  );
}

export function ActivityBar() {
  const activateTool = useToolWindowStore((s) => s.activateTool);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < TOOL_WINDOW_REGISTRY.length) {
        e.preventDefault();
        activateTool(TOOL_WINDOW_REGISTRY[idx].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activateTool]);

  const leftTools = getToolsForAnchor("left");
  const rightTools = getToolsForAnchor("right");
  const bottomTools = getToolsForAnchor("bottom");

  return (
    <div
      style={{
        width: BAR_WIDTH,
        height: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-subtle)",
        paddingTop: 4,
        paddingBottom: 6,
        overflow: "visible",
        position: "relative",
        zIndex: 10,
        userSelect: "none",
      }}
      aria-label="Tool Windows"
      role="navigation"
    >
      {leftTools.map((t) => (
        <ToolButton key={t.id} tool={t} />
      ))}
      {rightTools.length > 0 && <Divider />}
      {rightTools.map((t) => (
        <ToolButton key={t.id} tool={t} />
      ))}
      {bottomTools.length > 0 && <Divider />}
      {bottomTools.map((t) => (
        <ToolButton key={t.id} tool={t} />
      ))}
      <div style={{ flex: 1 }} />
      <Divider />
      <SecondaryButton icon={Bell} label="Alerts" />
      <SecondaryButton icon={Settings} label="Settings" />
    </div>
  );
}
