/**
 * toolWindowRegistry.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Config-driven registry of all tool windows in the IDE.
 *
 * To add a new tool window:
 *   1. Add an entry here
 *   2. Ensure contentType is handled in PanelRenderer
 *   Done. No other files need changes.
 */

import {
  Folder,
  SquareTerminal,
  Network,
  GitCompare,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { type ToolWindowDef } from "./toolWindowTypes";

export const TOOL_WINDOW_REGISTRY: ToolWindowDef[] = [
  // ── Left anchor ────────────────────────────────────────────────────────────
  {
    id: "explorer",
    label: "Explorer",
    icon: Folder,
    anchor: "left",
    contentType: "explorer",
    shortcut: "Ctrl+1",
  },
  {
    id: "inspector",
    label: "Properties",
    icon: SlidersHorizontal,
    anchor: "right",
    contentType: "inspector",
    shortcut: "Ctrl+2",
  },

  // ── Bottom anchor ──────────────────────────────────────────────────────────
  {
    id: "terminal",
    label: "Terminal",
    icon: SquareTerminal,
    anchor: "bottom",
    contentType: "terminal",
    shortcut: "Ctrl+3",
  },
  {
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    anchor: "bottom",
    contentType: "clusterLogs",
    shortcut: "Ctrl+4",
  },
  {
    id: "diff",
    label: "Cluster Diff",
    icon: GitCompare,
    anchor: "bottom",
    contentType: "clusterDiff",
    shortcut: "Ctrl+5",
  },
  {
    id: "cluster",
    label: "Cluster",
    icon: Network,
    anchor: "left",
    contentType: "graph",
    shortcut: "Ctrl+6",
  },
];

/** Quick lookup by id */
export function getToolWindowById(id: string): ToolWindowDef | undefined {
  return TOOL_WINDOW_REGISTRY.find((t) => t.id === id);
}

/** All tools for a given anchor */
export function getToolsForAnchor(
  anchor: "left" | "right" | "bottom",
): ToolWindowDef[] {
  return TOOL_WINDOW_REGISTRY.filter((t) => t.anchor === anchor);
}
