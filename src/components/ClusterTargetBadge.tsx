/**
 * ClusterTargetBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Small badge displayed in the titlebar / status bar showing the active
 * cluster target. Clicking opens a context menu to switch contexts.
 */

import { useState } from "react";
import { AppIcon } from "../ui/AppIcon";
import { useIDEStore } from "../store/ideStore";

function displayContextName(name: string): string {
  return name
    .replace(/^gke_[^_]+_[^_]+_/, "")
    .replace(/^arn:aws:[^/]+\//, "")
    .replace(/^do-[^-]+-/, "");
}

export function ClusterTargetBadge() {
  const clusterTarget = useIDEStore((s) => s.clusterTarget);
  const [hov, setHov] = useState(false);

  if (!clusterTarget) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 99,
          background: "rgba(249,226,175,0.06)",
          border: "1px solid rgba(249,226,175,0.15)",
          cursor: "default",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "rgba(249,226,175,0.4)",
          }}
        />
        <span
          style={{
            color: "rgba(249,226,175,0.5)",
            fontSize: "var(--font-size-xs)",
            fontFamily: "var(--font-mono)",
          }}
        >
          no cluster
        </span>
      </div>
    );
  }

  const isConnected = clusterTarget.lastConnectionStatus === "connected";
  const dotColor = isConnected
    ? "var(--accent-green, #a6e3a1)"
    : "rgba(249,226,175,0.6)";
  const borderColor = isConnected
    ? "rgba(166,227,161,0.2)"
    : "rgba(249,226,175,0.15)";
  const bgColor = isConnected
    ? "rgba(166,227,161,0.06)"
    : "rgba(249,226,175,0.06)";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 99,
        background: hov ? "var(--bg-elevated)" : bgColor,
        border: `1px solid ${hov ? "var(--border-default)" : borderColor}`,
        cursor: "default",
        transition: "var(--ease-fast)",
        userSelect: "none",
      }}
      title={`Context: ${clusterTarget.contextName}${clusterTarget.namespace ? ` | ns: ${clusterTarget.namespace}` : ""}`}
    >
      {/* Status dot */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />

      <AppIcon
        name="monitoring"
        size={11}
        strokeWidth={1.75}
        style={{ color: "var(--text-faint)", flexShrink: 0 }}
      />

      <span
        style={{
          color: "var(--text-subtle)",
          fontSize: "var(--font-size-xs)",
          fontFamily: "var(--font-mono)",
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayContextName(clusterTarget.contextName)}
      </span>

      {clusterTarget.namespace && (
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          /{clusterTarget.namespace}
        </span>
      )}
    </div>
  );
}
