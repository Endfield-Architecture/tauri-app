/**
 * TerminalPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fully interactive embedded terminal panel powered by xterm.js + Tauri PTY.
 *
 * Architecture:
 *   1. React mounts an xterm.js Terminal instance into a div ref
 *   2. FitAddon resizes the terminal to fill its container
 *   3. User keystrokes are sent to Rust via `invoke("pty_write", { sessionId, data })`
 *   4. Rust streams PTY output back via `emit("pty-output-{sessionId}", data)`
 *   5. xterm.js writes received bytes to the screen (ANSI, colors, cursor — all handled)
 *   6. ResizeObserver triggers `pty_resize` when the container dimensions change
 *
 * Multiple terminal instances are supported via the `sessionId` prop (tabs).
 */

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TerminalPanelProps {
  /** Unique session identifier — one PTY process per sessionId */
  sessionId: string;
  /** Whether this panel is currently visible (avoids fitting hidden terminals) */
  isActive?: boolean;
  /** Called when the shell process exits */
  onExit?: (sessionId: string, code: number) => void;
}

export interface TerminalPanelHandle {
  /** Force re-fit to container (call after panel resize) */
  fit: () => void;
  /** Send raw data to the PTY (e.g. for paste) */
  write: (data: string) => void;
  /** Focus the terminal input */
  focus: () => void;
}

// ─── Xterm theme matching Catppuccin Mocha (matches the app's CSS tokens) ────

const MOCHA_THEME = {
  background: "#1e1e2e", // --ctp-base
  foreground: "#cdd6f4", // --ctp-text
  cursor: "#f5e0dc", // --ctp-rosewater
  cursorAccent: "#1e1e2e",
  selectionBackground: "rgba(180, 190, 254, 0.25)", // --ctp-lavender 25%
  selectionForeground: "#cdd6f4",

  // Standard ANSI colors mapped to Catppuccin Mocha
  black: "#45475a", // surface1
  brightBlack: "#585b70", // surface2
  red: "#f38ba8", // red
  brightRed: "#f38ba8",
  green: "#a6e3a1", // green
  brightGreen: "#a6e3a1",
  yellow: "#f9e2af", // yellow
  brightYellow: "#f9e2af",
  blue: "#89b4fa", // blue
  brightBlue: "#89b4fa",
  magenta: "#cba6f7", // mauve
  brightMagenta: "#cba6f7",
  cyan: "#94e2d5", // teal
  brightCyan: "#89dceb", // sky
  white: "#bac2de", // subtext1
  brightWhite: "#a6adc8", // subtext0
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TerminalPanel = forwardRef<
  TerminalPanelHandle,
  TerminalPanelProps
>(function TerminalPanel({ sessionId, isActive = true, onExit }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sessionStarted = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // ── Fit helper ────────────────────────────────────────────────────────────
  const fitTerminal = useCallback(() => {
    const fit = fitAddonRef.current;
    const term = termRef.current;
    if (!fit || !term || !isActive) return;

    try {
      fit.fit();
      const { cols, rows } = term;

      // Notify Rust so it resizes the PTY's window size (SIGWINCH)
      invoke("pty_resize", { sessionId, cols, rows }).catch((err) =>
        console.warn("[terminal] pty_resize failed:", err),
      );
    } catch (e) {
      // FitAddon throws if container has 0-size; ignore
    }
  }, [sessionId, isActive]);

  // ── Expose imperative handle ──────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    fit: fitTerminal,
    write: (data: string) => {
      invoke("pty_write", { sessionId, data }).catch(console.error);
    },
    focus: () => termRef.current?.focus(),
  }));

  // ── Bootstrap xterm + PTY session ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 1. Create xterm instance ───────────────────────────────────────────
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
      fontSize: 15,
      lineHeight: 1.5,
      letterSpacing: 0.3,
      theme: MOCHA_THEME,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 1000, // 1000-line scrollback buffer
      allowProposedApi: true,
      // Allow xterm to handle ANSI sequences, bracketed paste, etc.
      allowTransparency: false,
      // macOS: don't map option key to meta, so alt-key combos work
      macOptionIsMeta: false,
      // Ctrl+C, Ctrl+V handled by xterm internally; we also handle in onData
      windowsMode: navigator.platform.startsWith("Win"),
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(container);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => fitTerminal());

    // ── 2. Forward user input → PTY ────────────────────────────────────────
    const onData = term.onData((data: string) => {
      invoke("pty_write", { sessionId, data }).catch((err) => {
        console.error("[terminal] pty_write error:", err);
      });
    });

    // ── 3. Listen for PTY output events from Rust ──────────────────────────
    // Rust emits: emit("pty-output-{sessionId}", outputBytes)
    const eventName = `pty-output-${sessionId}`;
    listen<string>(eventName, (event) => {
      // event.payload is a base64-encoded string of raw bytes from the PTY.
      // Decode → Uint8Array → write to xterm (handles all ANSI sequences).
      try {
        const bytes = Uint8Array.from(atob(event.payload), (c) =>
          c.charCodeAt(0),
        );
        term.write(bytes);
      } catch {
        // Fallback: treat as plain UTF-8 string
        term.write(event.payload);
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    // ── 4. Listen for shell exit ────────────────────────────────────────────
    const exitEventName = `pty-exit-${sessionId}`;
    listen<number>(exitEventName, (event) => {
      term.write(
        "\r\n\x1b[31m[Process exited with code " +
          event.payload +
          "]\x1b[0m\r\n",
      );
      onExit?.(sessionId, event.payload);
    });

    // ── 5. Start the PTY session on the Rust side ──────────────────────────
    if (!sessionStarted.current) {
      sessionStarted.current = true;

      // Get initial dimensions after first fit
      requestAnimationFrame(async () => {
        fitTerminal();
        const cols = term.cols || 80;
        const rows = term.rows || 24;

        try {
          await invoke("pty_start", { sessionId, cols, rows });
          setIsReady(true);
          setError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to start terminal: ${msg}`);
          term.write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`);
        }
      });
    }

    // ── 6. ResizeObserver keeps the terminal fitted to its container ────────
    const ro = new ResizeObserver(() => fitTerminal());
    ro.observe(container);
    resizeObserverRef.current = ro;

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      onData.dispose();
      ro.disconnect();
      unlistenRef.current?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;

      // Tell Rust to kill the PTY process
      invoke("pty_kill", { sessionId }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Only re-run if sessionId changes

  // ── Re-fit when isActive changes (panel becomes visible) ─────────────────
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(fitTerminal);
    }
  }, [isActive, fitTerminal]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e2e",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(243, 139, 168, 0.15)",
            borderBottom: "1px solid rgba(243, 139, 168, 0.3)",
            color: "#f38ba8",
            fontSize: "12px",
            fontFamily: "var(--font-ui)",
            flexShrink: 0,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* xterm.js render target — must be a plain div, no padding */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: "4px 6px",
          minHeight: 0, // critical: allows flexbox child to shrink
        }}
        // Click focuses the terminal input
        onClick={() => termRef.current?.focus()}
      />

      {/* Loading overlay before PTY is ready */}
      {!isReady && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(30, 30, 46, 0.6)",
            color: "var(--ctp-subtext0, #a6adc8)",
            fontSize: "12px",
            fontFamily: "var(--font-ui)",
            pointerEvents: "none",
          }}
        >
          Starting shell…
        </div>
      )}
    </div>
  );
});
