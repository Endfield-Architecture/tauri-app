/**
 * toolWindowTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core types for the JetBrains-style Tool Window system.
 *
 * Philosophy:
 *   - Each anchor (left/right/bottom) holds a list of registered tool windows
 *   - Only ONE tool window can be "active" (shown) per anchor at a time
 *   - Anchors have a fixed pixel size (width or height) that persists
 *   - Tool windows are NOT tabs — they are first-class named windows
 */

import { type LucideIcon } from "lucide-react";
import { type TabContentType } from "../layout/types"; // existing type

// ─── Anchor zones ─────────────────────────────────────────────────────────────

export type ToolWindowAnchor = "left" | "right" | "bottom";

// ─── A single registered tool window ─────────────────────────────────────────

export interface ToolWindowDef {
  /** Unique stable ID, e.g. "explorer", "terminal", "logs" */
  id: string;
  /** Display label shown in the tool window header */
  label: string;
  /** Lucide icon for the activity bar button */
  icon: LucideIcon;
  /** Which anchor this tool window lives in */
  anchor: ToolWindowAnchor;
  /** Maps to existing PanelRenderer content types */
  contentType: TabContentType;
  /** Keyboard shortcut label for tooltip (optional) */
  shortcut?: string;
}

// ─── Per-anchor runtime state ─────────────────────────────────────────────────

export interface AnchorState {
  /** Which tool window is currently open (null = anchor is collapsed) */
  activeToolId: string | null;
  /** Pixel size: width for left/right, height for bottom */
  size: number;
}

// ─── Full layout state ────────────────────────────────────────────────────────

export interface ToolWindowLayout {
  left: AnchorState;
  right: AnchorState;
  bottom: AnchorState;
}

// ─── Persisted shape (localStorage) ──────────────────────────────────────────

export interface PersistedToolWindowLayout {
  version: 2;
  left: AnchorState;
  right: AnchorState;
  bottom: AnchorState;
}
