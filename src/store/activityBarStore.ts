/**
 * activityBarStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Zustand store for the Activity Bar navigation state.
 *
 * Decoupled from panel logic — the store only tracks *which view is active*
 * and *whether it's visible*. Panel integration happens in ActivityBar via
 * callbacks that forward to the existing IDEStore.
 */

import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityViewId =
  | "explorer"
  | "terminal"
  | "cluster"
  | "diff"
  | "logs";

export interface ActivityBarStore {
  /** Currently highlighted item. null = nothing active */
  activeView: ActivityViewId | null;
  /** Whether the panel associated with activeView is currently shown */
  panelVisible: boolean;

  /**
   * Activate a view.
   * - If it's a new view → activate + set visible
   * - If it's the same view → toggle panelVisible
   */
  activateView: (id: ActivityViewId) => void;

  /** Called externally when a panel is closed via dock/tab system */
  setPanelVisible: (visible: boolean) => void;

  /** Programmatically set the active view (e.g. from keyboard shortcuts) */
  setActiveView: (id: ActivityViewId | null) => void;
}

export const useActivityBarStore = create<ActivityBarStore>((set, get) => ({
  activeView: null,
  panelVisible: false,

  activateView: (id) => {
    const { activeView, panelVisible } = get();

    if (activeView === id) {
      // Same icon clicked → toggle panel visibility
      set({ panelVisible: !panelVisible });
    } else {
      // Different icon → switch view, ensure panel is visible
      set({ activeView: id, panelVisible: true });
    }
  },

  setPanelVisible: (visible) => set({ panelVisible: visible }),

  setActiveView: (id) => set({ activeView: id, panelVisible: id !== null }),
}));
