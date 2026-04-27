// ═══════════════════════════════════════════════════════════════════════════
// GraphConnections.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useIDEStore } from "../store/ideStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NodeConnection {
  id: string;
  from_id: string;
  to_id: string;
  label?: string;
  color?: string;
  line_style?: "solid" | "dashed" | "dotted";
  connection_type?: "http" | "grpc" | "db" | "queue" | "custom";
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Design constants — Catppuccin Mocha palette ──────────────────────────────

const CONNECTION_COLORS = [
  { label: "Blue", value: "#89b4fa" },
  { label: "Green", value: "#a6e3a1" },
  { label: "Mauve", value: "#cba6f7" },
  { label: "Peach", value: "#fab387" },
  { label: "Red", value: "#f38ba8" },
  { label: "Teal", value: "#94e2d5" },
  { label: "Yellow", value: "#f9e2af" },
  { label: "Overlay", value: "#9399b2" },
];

const CONNECTION_TYPES: {
  label: string;
  value: NonNullable<NodeConnection["connection_type"]>;
}[] = [
  { label: "HTTP", value: "http" },
  { label: "gRPC", value: "grpc" },
  { label: "DB", value: "db" },
  { label: "Queue", value: "queue" },
  { label: "—", value: "custom" },
];

const LINE_STYLES: {
  label: string;
  value: NonNullable<NodeConnection["line_style"]>;
}[] = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
];

// ─── Geometry — exact same algorithm as GraphPanel's getEdgeGeometry ──────────
//
// nodePositions are already in SCREEN COORDS (pan + pos * zoom), so handle
// lengths must also be in screen pixels, hence we pass zoom in.

type RectSide = "left" | "right" | "top" | "bottom";
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Point {
  x: number;
  y: number;
}
interface Anchor extends Point {
  side: RectSide;
}

function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function getRectAnchor(rect: Rect, target: Point): Anchor {
  const c = rectCenter(rect);
  const dx = target.x - c.x;
  const dy = target.y - c.y;

  if (dx === 0 && dy === 0)
    return { x: rect.x + rect.width, y: c.y, side: "right" };

  const scale = Math.max(
    Math.abs(dx) / (rect.width / 2),
    Math.abs(dy) / (rect.height / 2),
    1,
  );
  const x = c.x + dx / scale;
  const y = c.y + dy / scale;

  const distances: [RectSide, number][] = [
    ["left", Math.abs(x - rect.x)],
    ["right", Math.abs(x - (rect.x + rect.width))],
    ["top", Math.abs(y - rect.y)],
    ["bottom", Math.abs(y - (rect.y + rect.height))],
  ];
  distances.sort((a, b) => a[1] - b[1]);

  return { x, y, side: distances[0][0] };
}

function sideNormal(side: RectSide): Point {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function cubicBezierAt(
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * p3.y,
  };
}

// Matches GraphPanel exactly: handle = clamp(dist*0.35, 28*zoom, 90*zoom)
function getEdgeGeometry(
  fromRect: Rect,
  toRect: Rect,
  zoom: number,
): { path: string; mid: Point; start: Anchor; end: Anchor } {
  const toCenter = rectCenter(toRect);
  const fromCenter = rectCenter(fromRect);
  const start = getRectAnchor(fromRect, toCenter);
  const end = getRectAnchor(toRect, fromCenter);
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const handle = Math.min(Math.max(dist * 0.35, 28 * zoom), 90 * zoom);
  const sn = sideNormal(start.side);
  const en = sideNormal(end.side);
  const c1 = { x: start.x + sn.x * handle, y: start.y + sn.y * handle };
  const c2 = { x: end.x + en.x * handle, y: end.y + en.y * handle };
  const mid = cubicBezierAt(start, c1, c2, end, 0.5);

  return {
    path: `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`,
    mid,
    start,
    end,
  };
}

// Preview: from node boundary toward cursor
function getPreviewGeometry(
  fromRect: Rect,
  mouse: Point,
  zoom: number,
): { path: string; anchorX: number; anchorY: number } {
  const anchor = getRectAnchor(fromRect, mouse);
  const dist = Math.hypot(mouse.x - anchor.x, mouse.y - anchor.y);
  const handle = Math.min(Math.max(dist * 0.35, 28 * zoom), 90 * zoom);
  const sn = sideNormal(anchor.side);
  const c1 = { x: anchor.x + sn.x * handle, y: anchor.y + sn.y * handle };
  return {
    path: `M${anchor.x},${anchor.y} C${c1.x},${c1.y} ${mouse.x},${mouse.y} ${mouse.x},${mouse.y}`,
    anchorX: anchor.x,
    anchorY: anchor.y,
  };
}

function getDash(style?: string): string | undefined {
  if (style === "dashed") return "6,4";
  if (style === "dotted") return "2,4";
  return undefined;
}

// ─── useConnections hook ──────────────────────────────────────────────────────

export function useConnections(projectPath: string | null) {
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [drawingFrom, setDrawingFrom] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);

  // Load connections from .endfield on project open
  useEffect(() => {
    if (!projectPath) {
      setConnections([]);
      return;
    }
    invoke<{ connections?: NodeConnection[] }>("load_endfield_layout", {
      projectPath,
    })
      .then((layout) => setConnections(layout.connections ?? []))
      .catch(() => setConnections([]));
  }, [projectPath]);

  // Persist connections into .endfield together with current fields+viewport from store
  const persist = useCallback(
    (conns: NodeConnection[]) => {
      if (!projectPath) return;
      const { nodes, viewport } = useIDEStore.getState();
      const fields = nodes.map((n) => ({
        id: n.id,
        label: n.label,
        x: n.x,
        y: n.y,
      }));
      invoke("save_endfield_layout", {
        projectPath,
        fields,
        connections: conns,
        viewport: viewport ?? null,
      }).catch(console.error);
    },
    [projectPath],
  );

  const startDrawing = useCallback(
    (nodeId: string) => setDrawingFrom(nodeId),
    [],
  );

  const finishDrawing = useCallback(
    (toNodeId: string | null) => {
      setDrawingFrom((prev) => {
        if (!prev || !toNodeId || prev === toNodeId) return null;
        setConnections((cur) => {
          if (cur.some((c) => c.from_id === prev && c.to_id === toNodeId))
            return cur;
          const next: NodeConnection = {
            id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            from_id: prev,
            to_id: toNodeId,
            color: "#89b4fa",
            line_style: "solid",
            connection_type: "http",
          };
          const updated = [...cur, next];
          persist(updated);
          return updated;
        });
        return null;
      });
    },
    [persist],
  );

  const updateConnection = useCallback(
    (id: string, patch: Partial<NodeConnection>) => {
      setConnections((cur) => {
        const updated = cur.map((c) => (c.id === id ? { ...c, ...patch } : c));
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const deleteConnection = useCallback(
    (id: string) => {
      setConnections((cur) => {
        const updated = cur.filter((c) => c.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const deleteNodeConnections = useCallback(
    (nodeId: string) => {
      setConnections((cur) => {
        const updated = cur.filter(
          (c) => c.from_id !== nodeId && c.to_id !== nodeId,
        );
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  return {
    connections,
    drawingFrom,
    isConnectMode,
    setIsConnectMode,
    startDrawing,
    finishDrawing,
    updateConnection,
    deleteConnection,
    deleteNodeConnections,
  };
}

// ─── ConnectionsSVGLayer ──────────────────────────────────────────────────────

interface ConnectionsSVGLayerProps {
  connections: NodeConnection[];
  nodePositions: Record<string, NodePosition>;
  drawingFrom: string | null;
  mousePos: { x: number; y: number } | null;
  selectedConnectionId: string | null;
  onConnectionClick: (id: string) => void;
  scale?: number;
}

export function ConnectionsSVGLayer({
  connections,
  nodePositions,
  drawingFrom,
  mousePos,
  selectedConnectionId,
  onConnectionClick,
  scale = 1,
}: ConnectionsSVGLayerProps) {
  const usedColors = Array.from(
    new Set([...connections.map((c) => c.color ?? "#89b4fa"), "#89b4fa"]),
  );

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 5,
      }}
    >
      <defs>
        {usedColors.map((color) => (
          <marker
            key={color}
            id={`ca-${color.replace("#", "")}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={color} opacity="0.7" />
          </marker>
        ))}
        <marker
          id="ca-selected"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L0,6 L8,3 z"
            fill="var(--text-primary,#cdd6f4)"
            opacity="0.9"
          />
        </marker>
        <marker
          id="ca-preview"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#89b4fa" opacity="0.7" />
        </marker>
      </defs>

      {/* Existing connections */}
      {connections.map((conn) => {
        const from = nodePositions[conn.from_id];
        const to = nodePositions[conn.to_id];
        if (!from || !to) return null;

        const color = conn.color ?? "#89b4fa";
        const isSel = conn.id === selectedConnectionId;
        const { path, mid } = getEdgeGeometry(from, to, scale);
        const markerId = isSel ? "ca-selected" : `ca-${color.replace("#", "")}`;
        const labelText = conn.label
          ? conn.label
          : conn.connection_type && conn.connection_type !== "custom"
            ? conn.connection_type.toUpperCase()
            : null;

        return (
          <g key={conn.id}>
            {/* Wide hit area */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onClick={() => onConnectionClick(conn.id)}
            />
            {/* Selection glow */}
            {isSel && (
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={6}
                strokeOpacity={0.18}
                strokeLinecap="round"
                style={{ pointerEvents: "none" }}
              />
            )}
            {/* Main path — same weight as DB/ingress edges (1.5px) */}
            <path
              d={path}
              fill="none"
              stroke={isSel ? "var(--text-primary,#cdd6f4)" : color}
              strokeWidth={1.5}
              strokeOpacity={isSel ? 0.9 : 0.55}
              strokeDasharray={getDash(conn.line_style)}
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              style={{ pointerEvents: "none" }}
            />
            {/* Label */}
            {labelText && (
              <LabelPill
                x={mid.x}
                y={mid.y}
                text={labelText}
                color={isSel ? "var(--text-primary,#cdd6f4)" : color}
                scale={scale}
              />
            )}
          </g>
        );
      })}

      {/* Drawing preview */}
      {drawingFrom &&
        mousePos &&
        nodePositions[drawingFrom] &&
        (() => {
          const { path, anchorX, anchorY } = getPreviewGeometry(
            nodePositions[drawingFrom],
            mousePos,
            scale,
          );
          return (
            <g style={{ pointerEvents: "none" }}>
              <path
                d={path}
                fill="none"
                stroke="#89b4fa"
                strokeWidth={1.5}
                strokeOpacity={0.55}
                strokeDasharray="6,4"
                strokeLinecap="round"
                markerEnd="url(#ca-preview)"
              />
              <circle
                cx={anchorX}
                cy={anchorY}
                r={3}
                fill="#89b4fa"
                opacity={0.7}
              />
            </g>
          );
        })()}
    </svg>
  );
}

// Label pill positioned at bezier midpoint
// LabelPill — coordinates are in screen space already, so sizes are fixed pixels
function LabelPill({
  x,
  y,
  text,
  color,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
}) {
  const fs = 10;
  const px = 6;
  const py = 3;
  const w = text.length * fs * 0.58 + px * 2;
  const h = fs + py * 2;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill="var(--bg-modal,#1e2030)"
        stroke={color}
        strokeWidth={0.8}
        opacity={0.95}
      />
      <text
        x={x}
        y={y + fs * 0.36}
        textAnchor="middle"
        fill={color}
        fontSize={fs}
        fontFamily="var(--font-mono,monospace)"
        opacity={0.75}
        style={{ userSelect: "none" }}
      >
        {text}
      </text>
    </g>
  );
}

// ─── ConnectionEditor ─────────────────────────────────────────────────────────

interface ConnectionEditorProps {
  connection: NodeConnection | null;
  fromLabel?: string;
  toLabel?: string;
  onUpdate: (id: string, patch: Partial<NodeConnection>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConnectionEditor({
  connection,
  fromLabel,
  toLabel,
  onUpdate,
  onDelete,
  onClose,
}: ConnectionEditorProps) {
  if (!connection) return null;
  const color = connection.color ?? "#89b4fa";

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        width: 252,
        background: "var(--bg-modal)",
        backdropFilter: "var(--blur-md)",
        WebkitBackdropFilter: "var(--blur-md)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 14px 12px",
        zIndex: 100,
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-ui)",
        color: "var(--text-primary)",
        fontSize: "var(--font-size-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 6px ${color}80`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
            Connection
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-faint)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      {/* Route chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 9px",
          background: `${color}0e`,
          border: `1px solid ${color}25`,
          borderRadius: "var(--radius-sm)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 82,
          }}
        >
          {fromLabel ?? connection.from_id}
        </span>
        <span style={{ color, flexShrink: 0 }}>→</span>
        <span
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 82,
          }}
        >
          {toLabel ?? connection.to_id}
        </span>
      </div>

      {/* Label */}
      <div>
        <div
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            marginBottom: 5,
            letterSpacing: "0.05em",
          }}
        >
          LABEL
        </div>
        <input
          type="text"
          value={connection.label ?? ""}
          placeholder="e.g. REST, auth, events…"
          onChange={(e) =>
            onUpdate(connection.id, { label: e.target.value || undefined })
          }
          style={{
            width: "100%",
            padding: "5px 9px",
            boxSizing: "border-box",
            background: "var(--bg-elevated)",
            border: `1px solid ${color}30`,
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>

      {/* Color */}
      <div>
        <div
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            marginBottom: 6,
            letterSpacing: "0.05em",
          }}
        >
          COLOR
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {CONNECTION_COLORS.map(({ value, label }) => (
            <button
              key={value}
              title={label}
              onClick={() => onUpdate(connection.id, { color: value })}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid",
                borderColor: connection.color === value ? value : "transparent",
                background: value,
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                outline:
                  connection.color === value ? `1px solid ${value}` : "none",
                outlineOffset: 1,
                transition: "border-color 0.12s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Type */}
      <div>
        <div
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            marginBottom: 6,
            letterSpacing: "0.05em",
          }}
        >
          TYPE
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CONNECTION_TYPES.map(({ label, value }) => {
            const active = connection.connection_type === value;
            return (
              <button
                key={value}
                onClick={() =>
                  onUpdate(connection.id, { connection_type: value })
                }
                style={{
                  padding: "3px 9px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  background: active ? `${color}1e` : "var(--bg-elevated)",
                  border: `1px solid ${active ? color : "var(--border-subtle)"}`,
                  color: active ? color : "var(--text-faint)",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style */}
      <div>
        <div
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            marginBottom: 6,
            letterSpacing: "0.05em",
          }}
        >
          STYLE
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {LINE_STYLES.map(({ label, value }) => {
            const active = connection.line_style === value;
            return (
              <button
                key={value}
                onClick={() => onUpdate(connection.id, { line_style: value })}
                style={{
                  flex: 1,
                  padding: "3px 0",
                  borderRadius: "var(--radius-xs)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  background: active ? `${color}1e` : "var(--bg-elevated)",
                  border: `1px solid ${active ? color : "var(--border-subtle)"}`,
                  color: active ? color : "var(--text-faint)",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          onDelete(connection.id);
          onClose();
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(243,139,168,0.08)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        style={{
          width: "100%",
          padding: "6px 0",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          border: "1px solid rgba(243,139,168,0.22)",
          color: "var(--ctp-red,#f38ba8)",
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--font-size-xs)",
          transition: "background 0.12s",
        }}
      >
        Remove connection
      </button>
    </div>
  );
}

// ─── ConnectModeButton ────────────────────────────────────────────────────────

export function ConnectModeButton({
  active,
  drawingFrom,
  onToggle,
}: {
  active: boolean;
  drawingFrom: string | null;
  onToggle: () => void;
}) {
  const [hov, setHov] = useState(false);
  const label = active
    ? drawingFrom
      ? "Click target…"
      : "Click source…"
    : "Connect";

  return (
    <button
      onClick={onToggle}
      title={active ? "Exit connect mode (Esc)" : "Draw connections (C)"}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 26,
        padding: "0 10px",
        background: active
          ? "rgba(137,180,250,0.14)"
          : hov
            ? "var(--bg-elevated)"
            : "transparent",
        border: active
          ? "1px solid rgba(137,180,250,0.45)"
          : "1px solid transparent",
        borderRadius: "var(--radius-sm)",
        color: active
          ? "#89b4fa"
          : hov
            ? "var(--text-secondary)"
            : "var(--text-muted)",
        cursor: "pointer",
        fontSize: "var(--font-size-xs)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-ui)",
        fontWeight: active ? 500 : 400,
        transition: "var(--ease-fast)",
        whiteSpace: "nowrap",
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M4.5 7.5L7.5 4.5M3 9C2.17 8.17 2.17 6.83 3 6L4.5 4.5M9 3C9.83 3.83 9.83 5.17 9 6L7.5 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </button>
  );
}

// ─── useConnectionShortcuts ───────────────────────────────────────────────────

export function useConnectionShortcuts(
  isConnectMode: boolean,
  setIsConnectMode: (v: boolean) => void,
  drawingFrom: string | null,
  cancelDrawing: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if ((e.key === "c" || e.key === "C") && !isConnectMode)
        setIsConnectMode(true);
      if (e.key === "Escape") {
        if (drawingFrom) cancelDrawing();
        else if (isConnectMode) setIsConnectMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isConnectMode, setIsConnectMode, drawingFrom, cancelDrawing]);
}
