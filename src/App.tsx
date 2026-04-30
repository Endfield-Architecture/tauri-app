import { useEffect, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { IDELayout } from "./layout/IDELayout";
import { useIDEStore } from "./store/ideStore";
import { ProjectSelector } from "./screens/ProjectSelector";
import {
  watchProject,
  unwatchProject,
  readYamlFile,
  FileChangedPayload,
} from "./store/tauriStore";
const GLOBAL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    width: 100%; height: 100%; overflow: hidden;
    background: var(--bg-app);
    font-family: var(--font-ui);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
  }

  /* Dock layout — disable text selection during drag */
  .dock-layout, .dock-layout * { user-select: none; -webkit-user-select: none; }
  .dock-layout input, .dock-layout textarea { user-select: text; -webkit-user-select: text; }

  /* Window drag regions — must be real CSS, inline styles don't work with WebKit */
  .drag-region { -webkit-app-region: drag; app-region: drag; }
  .no-drag     { -webkit-app-region: no-drag; app-region: no-drag; }
`;

export default function App() {
  const projectPath = useIDEStore((s) => s.projectPath);
  const refreshClusterStatus = useIDEStore((s) => s.refreshClusterStatus);
  const updateNodeFromFile = useIDEStore((s) => s.updateNodeFromFile);

  // Keep a ref to the unlisten fn so we can clean it up
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // ── Cluster status polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!projectPath) return;
    let running = false;

    const poll = async () => {
      if (running) return; // skip if previous call still in flight
      running = true;
      try {
        await refreshClusterStatus();
      } finally {
        running = false;
      }
    };

    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, [projectPath, refreshClusterStatus]);

  // ── File watcher lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!projectPath) {
      // Project closed — stop watching
      unwatchProject().catch(() => {});
      unlistenRef.current?.();
      unlistenRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Subscribe to backend events BEFORE starting the watcher
      //    to avoid a race where an event fires before we listen.
      const unlisten = await listen<FileChangedPayload>(
        "yaml-file-changed",
        (event) => {
          const { path, kind } = event.payload;

          if (kind === "remove") {
            // Find any node whose file_path matches and remove it from the store
            const store = useIDEStore.getState();
            const removed = store.nodes.find((n) => n.file_path === path);
            if (removed) {
              store.closeTab(`file-${path}`);
              store.closeTab(`file-placeholder-${removed.id}`);
              store.removeNode(removed.id);
            }
            return;
          }

          // Read the updated file and sync the store
          readYamlFile(path)
            .then((content) => updateNodeFromFile(path, content))
            .catch(() => {
              // File may have been briefly locked (write in progress) — ignore
            });
        },
      );

      if (cancelled) {
        // Component unmounted before async resolved
        unlisten();
        return;
      }

      unlistenRef.current = unlisten;

      // 2. Start the OS-level watcher
      try {
        await watchProject(projectPath);
      } catch (e) {
        console.warn("[endfield] file watcher unavailable:", e);
      }
    })();

    return () => {
      cancelled = true;
      unwatchProject().catch(() => {});
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [projectPath, updateNodeFromFile]);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {!projectPath ? (
        <ProjectSelector />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100vh",
            animation: "ef-fadein 0.2s ease-out",
          }}
        >
          <IDELayout />
        </div>
      )}
    </>
  );
}
