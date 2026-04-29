/**
 * toolWindowStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Zustand store — the layout engine for the JetBrains-style tool window system.
 *
 * Rules:
 *   - Each anchor has exactly one active tool window (or none = collapsed)
 *   - Clicking the same active tool window collapses the anchor
 *   - Clicking a different tool in the same anchor switches without collapsing
 *   - Sizes persist to localStorage
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type ToolWindowLayout,
  type ToolWindowAnchor,
  type PersistedToolWindowLayout,
} from "./toolWindowTypes";
import { getToolWindowById } from "./toolWindowRegistry";

// ─── Size constraints ─────────────────────────────────────────────────────────

const CONSTRAINTS = {
  left: { min: 180, max: 560, default: 260 },
  right: { min: 200, max: 520, default: 300 },
  bottom: { min: 120, max: 520, default: 240 },
} as const;

const STORAGE_KEY = "endfield:tool-windows:v2";

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadPersistedLayout(): Partial<ToolWindowLayout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: PersistedToolWindowLayout = JSON.parse(raw);
    if (parsed.version !== 2) return {};
    return { left: parsed.left, right: parsed.right, bottom: parsed.bottom };
  } catch {
    return {};
  }
}

function persistLayout(layout: ToolWindowLayout) {
  try {
    const data: PersistedToolWindowLayout = { version: 2, ...layout };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage not available (e.g. in tests)
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

function buildInitialState(): ToolWindowLayout {
  const saved = loadPersistedLayout();
  return {
    left: saved.left ?? {
      activeToolId: "explorer",
      size: CONSTRAINTS.left.default,
    },
    right: saved.right ?? {
      activeToolId: null,
      size: CONSTRAINTS.right.default,
    },
    bottom: saved.bottom ?? {
      activeToolId: null,
      size: CONSTRAINTS.bottom.default,
    },
  };
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ToolWindowStore extends ToolWindowLayout {
  /**
   * Toggle or switch a tool window.
   * - Same tool active → collapse anchor
   * - Different tool → switch to it (anchor stays open)
   * - Anchor collapsed → open with this tool
   */
  activateTool: (toolId: string) => void;

  /** Collapse a specific anchor (hide its tool window) */
  collapseAnchor: (anchor: ToolWindowAnchor) => void;

  /** Open a specific tool window programmatically */
  openTool: (toolId: string) => void;

  /** Resize an anchor — clamps to min/max */
  resizeAnchor: (anchor: ToolWindowAnchor, size: number) => void;

  /** Whether a given anchor is currently open */
  isAnchorOpen: (anchor: ToolWindowAnchor) => boolean;

  /** Whether a specific tool is the currently active one */
  isToolActive: (toolId: string) => boolean;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useToolWindowStore = create<ToolWindowStore>()(
  subscribeWithSelector((set, get) => ({
    ...buildInitialState(),

    activateTool: (toolId) => {
      const tool = getToolWindowById(toolId);
      if (!tool) return;

      const anchor = tool.anchor;
      const current = get()[anchor];

      let next = { ...current };

      if (current.activeToolId === toolId) {
        // Same tool → collapse
        next.activeToolId = null;
      } else {
        // New tool (or anchor was collapsed) → open
        next.activeToolId = toolId;
      }

      set((state) => {
        const updated = { ...state, [anchor]: next };
        persistLayout({
          left: updated.left,
          right: updated.right,
          bottom: updated.bottom,
        });
        return updated;
      });
    },

    collapseAnchor: (anchor) => {
      set((state) => {
        const updated = {
          ...state,
          [anchor]: { ...state[anchor], activeToolId: null },
        };
        persistLayout({
          left: updated.left,
          right: updated.right,
          bottom: updated.bottom,
        });
        return updated;
      });
    },

    openTool: (toolId) => {
      const tool = getToolWindowById(toolId);
      if (!tool) return;
      const anchor = tool.anchor;
      set((state) => {
        const updated = {
          ...state,
          [anchor]: { ...state[anchor], activeToolId: toolId },
        };
        persistLayout({
          left: updated.left,
          right: updated.right,
          bottom: updated.bottom,
        });
        return updated;
      });
    },

    resizeAnchor: (anchor, size) => {
      const { min, max } = CONSTRAINTS[anchor];
      const clamped = Math.max(min, Math.min(max, size));
      set((state) => {
        const updated = {
          ...state,
          [anchor]: { ...state[anchor], size: clamped },
        };
        persistLayout({
          left: updated.left,
          right: updated.right,
          bottom: updated.bottom,
        });
        return updated;
      });
    },

    isAnchorOpen: (anchor) => get()[anchor].activeToolId !== null,

    isToolActive: (toolId) => {
      const tool = getToolWindowById(toolId);
      if (!tool) return false;
      return get()[tool.anchor].activeToolId === toolId;
    },
  })),
);
