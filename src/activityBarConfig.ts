/**
 * activityBarConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Config-driven item definitions for the Activity Bar.
 * Add new items here — no changes needed in ActivityBar.tsx.
 */

import {
  Folder,
  SquareTerminal,
  Network,
  GitCompare,
  ScrollText,
  MoreHorizontal,
  Settings,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { ActivityViewId } from "./store/activityBarStore.ts";
import { DockSlot, Tab } from "./layout/types.ts"; // adjust import path to your project

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: ActivityViewId;
  icon: LucideIcon;
  label: string;
  /** Keyboard shortcut label shown in tooltip */
  shortcut?: string;
  /** Which dock slot this panel opens into */
  slot: DockSlot;
  /** Tab descriptor to open when activated */
  tab: Omit<Tab, "id"> & { id: string };
}

export interface ActivitySecondaryItem {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

// ─── Primary items (top section) ─────────────────────────────────────────────

export const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: "explorer",
    icon: Folder,
    label: "Explorer",
    shortcut: "Ctrl+1",
    slot: "left",
    tab: {
      id: "tab-explorer",
      title: "Explorer",
      contentType: "explorer",
      icon: "󰉋",
    },
  },
  {
    id: "terminal",
    icon: SquareTerminal,
    label: "Terminal",
    shortcut: "Ctrl+2",
    slot: "bottom",
    tab: {
      id: "tab-terminal",
      title: "Terminal",
      contentType: "terminal",
      icon: ">_",
    },
  },
  {
    id: "cluster",
    icon: Network,
    label: "Cluster",
    shortcut: "Ctrl+3",
    slot: "center",
    tab: {
      id: "tab-graph",
      title: "Cluster",
      contentType: "graph",
      icon: "⬡",
    },
  },
  {
    id: "diff",
    icon: GitCompare,
    label: "Diff",
    shortcut: "Ctrl+4",
    slot: "bottom",
    tab: {
      id: "tab-clusterdiff",
      title: "Cluster Diff",
      contentType: "clusterDiff",
      icon: "⊞",
    },
  },
  {
    id: "logs",
    icon: ScrollText,
    label: "Logs",
    shortcut: "Ctrl+5",
    slot: "bottom",
    tab: {
      id: "tab-clusterlogs",
      title: "Logs",
      contentType: "clusterLogs",
      icon: "≡",
    },
  },
];

// ─── Secondary items (bottom section) ────────────────────────────────────────

export const ACTIVITY_SECONDARY: ActivitySecondaryItem[] = [
  {
    id: "alerts",
    icon: Bell,
    label: "Alerts",
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
  },
  {
    id: "more",
    icon: MoreHorizontal,
    label: "More",
  },
];
