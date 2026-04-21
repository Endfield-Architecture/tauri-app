/**
 * ClusterSelector.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Step shown after folder selection during project open.
 * Lets the user pick a kubeconfig context to use as the cluster target.
 *
 * Flow:
 *   1. Auto-load contexts from default kubeconfig
 *   2. Show list of contexts with current one pre-selected
 *   3. Optional: test connection before proceeding
 *   4. User confirms → ClusterTarget returned to parent
 */

import { useState, useEffect, useCallback } from "react";
import { AppIcon } from "../ui/AppIcon";
import {
  ClusterTarget,
  KubeconfigContext,
  listKubeconfigContexts,
  getCurrentKubeconfigContext,
  testClusterConnection,
  getDefaultKubeconfigPath,
} from "../store/tauriStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string }
  | { status: "warning"; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function displayContextName(name: string): string {
  // Strip common prefixes to keep names readable
  return name
    .replace(/^gke_[^_]+_[^_]+_/, "")
    .replace(/^arn:aws:[^/]+\//, "")
    .replace(/^do-[^-]+-/, "");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state.status === "idle") return null;

  const configs: Record<
    Exclude<ConnectionState["status"], "idle">,
    { color: string; bg: string; border: string; icon: string }
  > = {
    testing: {
      color: "var(--text-subtle)",
      bg: "rgba(148,163,184,0.08)",
      border: "rgba(148,163,184,0.2)",
      icon: "monitoring",
    },
    ok: {
      color: "var(--accent-green, #a6e3a1)",
      bg: "rgba(166,227,161,0.08)",
      border: "rgba(166,227,161,0.2)",
      icon: "check",
    },
    error: {
      color: "var(--accent-red, #f38ba8)",
      bg: "rgba(243,139,168,0.08)",
      border: "rgba(243,139,168,0.2)",
      icon: "warning",
    },
    warning: {
      color: "var(--accent-yellow, #f9e2af)",
      bg: "rgba(249,226,175,0.08)",
      border: "rgba(249,226,175,0.2)",
      icon: "warning",
    },
  };

  const c = configs[state.status];
  const msg = "message" in state ? state.message : "Testing…";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "9px 12px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius-md)",
        marginTop: 10,
      }}
    >
      <AppIcon
        name={c.icon as any}
        size={13}
        strokeWidth={2}
        style={{ color: c.color, flexShrink: 0, marginTop: 1 }}
      />
      <span
        style={{
          color: c.color,
          fontSize: "var(--font-size-sm)",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {state.status === "testing" ? "Testing connection…" : msg}
      </span>
    </div>
  );
}

function ContextRow({
  ctx,
  selected,
  onSelect,
  isCurrent,
}: {
  ctx: KubeconfigContext;
  selected: boolean;
  onSelect: () => void;
  isCurrent: boolean;
}) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: selected
          ? "rgba(203,166,247,0.1)"
          : hov
            ? "var(--bg-elevated)"
            : "transparent",
        border: `1px solid ${
          selected
            ? "var(--border-accent)"
            : hov
              ? "var(--border-default)"
              : "transparent"
        }`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "var(--ease-fast)",
      }}
    >
      {/* Radio indicator */}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: `2px solid ${selected ? "var(--accent)" : "var(--border-default)"}`,
          background: selected ? "var(--accent)" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "var(--ease-fast)",
        }}
      >
        {selected && (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--bg-app)",
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: selected ? "var(--accent-alt)" : "var(--text-primary)",
              fontSize: "var(--font-size-md)",
              fontWeight: selected ? 500 : 400,
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayContextName(ctx.name)}
          </span>
          {isCurrent && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 99,
                background: "rgba(203,166,247,0.15)",
                color: "var(--accent)",
                border: "1px solid rgba(203,166,247,0.25)",
                fontWeight: 500,
                letterSpacing: "0.05em",
                flexShrink: 0,
              }}
            >
              CURRENT
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 2,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "var(--text-faint)",
              fontSize: "var(--font-size-xs)",
              fontFamily: "var(--font-mono)",
            }}
          >
            cluster: {ctx.cluster}
          </span>
          {ctx.namespace && (
            <span
              style={{
                color: "var(--text-faint)",
                fontSize: "var(--font-size-xs)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ns: {ctx.namespace}
            </span>
          )}
        </div>
      </div>

      <AppIcon
        name="arrowRight"
        size={12}
        strokeWidth={2}
        style={{
          color: selected ? "var(--accent)" : "var(--text-faint)",
          flexShrink: 0,
          opacity: selected || hov ? 1 : 0,
          transition: "var(--ease-fast)",
        }}
      />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ClusterSelectorProps {
  projectPath: string;
  onConfirm: (target: ClusterTarget | null) => void;
  onBack: () => void;
}

export function ClusterSelector({
  projectPath,
  onConfirm,
  onBack,
}: ClusterSelectorProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [contexts, setContexts] = useState<KubeconfigContext[]>([]);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [kubeconfigPath, setKubeconfigPath] = useState<string>("");
  const [defaultKubeconfigPath, setDefaultKubeconfigPath] =
    useState<string>("");

  const [customNamespace, setCustomNamespace] = useState<string>("");
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "idle",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load contexts on mount
  useEffect(() => {
    (async () => {
      try {
        const [defPath, ctxList, curCtx] = await Promise.all([
          getDefaultKubeconfigPath(),
          listKubeconfigContexts(null),
          getCurrentKubeconfigContext(null).catch(() => null),
        ]);
        setDefaultKubeconfigPath(defPath);
        setKubeconfigPath(defPath);
        setContexts(ctxList);
        setCurrentContext(curCtx ?? null);
        setSelectedContext(curCtx ?? ctxList[0]?.name ?? null);
        setLoadState("ready");
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoadState("error");
      }
    })();
  }, []);

  // Reload contexts when kubeconfig path changes (debounced via blur)
  const reloadContexts = useCallback(async (path: string) => {
    if (!path) return;
    setLoadState("loading");
    setConnectionState({ status: "idle" });
    try {
      const [ctxList, curCtx] = await Promise.all([
        listKubeconfigContexts(path),
        getCurrentKubeconfigContext(path).catch(() => null),
      ]);
      setContexts(ctxList);
      setCurrentContext(curCtx ?? null);
      setSelectedContext(curCtx ?? ctxList[0]?.name ?? null);
      setLoadState("ready");
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setLoadState("error");
      setContexts([]);
    }
  }, []);

  const testConnection = async () => {
    if (!selectedContext) return;
    setConnectionState({ status: "testing" });
    try {
      const msg = await testClusterConnection(
        selectedContext,
        kubeconfigPath !== defaultKubeconfigPath ? kubeconfigPath : null,
      );
      setConnectionState({
        status: "ok",
        message: msg || "Cluster is reachable",
      });
    } catch (e) {
      setConnectionState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleConfirm = () => {
    if (!selectedContext) {
      onConfirm(null);
      return;
    }

    const ctx = contexts.find((c) => c.name === selectedContext);
    const target: ClusterTarget = {
      id: genId(),
      name: displayContextName(selectedContext),
      type: "kubernetes",
      kubeconfigPath:
        kubeconfigPath !== defaultKubeconfigPath ? kubeconfigPath : null,
      contextName: selectedContext,
      namespace: customNamespace || ctx?.namespace || null,
      isDefault: true,
      lastConnectionStatus:
        connectionState.status === "ok" ? "connected" : null,
      lastUsedAt: new Date().toISOString(),
    };
    onConfirm(target);
  };

  const handleSkip = () => {
    onConfirm(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const projectName =
    projectPath.split("/").filter(Boolean).pop() ?? projectPath;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "40px 48px",
        overflowY: "auto",
        background: "var(--bg-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-faint)",
            fontSize: "var(--font-size-sm)",
            padding: "4px 0",
            marginBottom: 20,
            transition: "var(--ease-fast)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "var(--text-subtle)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = "var(--text-faint)")
          }
        >
          <AppIcon name="arrowLeft" size={12} strokeWidth={2} />
          <span>Back</span>
        </button>

        <div
          style={{
            color: "var(--text-primary)",
            fontSize: "var(--font-size-2xl)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Select Cluster
        </div>
        <div
          style={{
            color: "var(--text-subtle)",
            fontSize: "var(--font-size-md)",
          }}
        >
          Choose a Kubernetes context for{" "}
          <span
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {projectName}
          </span>
        </div>
      </div>

      {/* Body */}
      {loadState === "loading" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-faint)",
            fontSize: "var(--font-size-sm)",
            padding: "20px 0",
          }}
        >
          <AppIcon name="monitoring" size={14} strokeWidth={1.75} />
          <span>Loading kubeconfig…</span>
        </div>
      )}

      {loadState === "error" && (
        <div style={{ maxWidth: 480 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "12px 14px",
              background: "rgba(243,139,168,0.08)",
              border: "1px solid rgba(243,139,168,0.2)",
              borderRadius: "var(--radius-md)",
              marginBottom: 20,
            }}
          >
            <AppIcon
              name="warning"
              size={13}
              strokeWidth={2}
              style={{
                color: "var(--accent-red)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div>
              <div
                style={{
                  color: "var(--accent-red)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Could not load kubeconfig
              </div>
              <div
                style={{
                  color: "var(--text-faint)",
                  fontSize: "var(--font-size-xs)",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.6,
                  wordBreak: "break-word",
                }}
              >
                {loadError}
              </div>
            </div>
          </div>

          {/* Still allow skipping */}
          <div
            style={{
              color: "var(--text-subtle)",
              fontSize: "var(--font-size-sm)",
              lineHeight: 1.7,
              marginBottom: 20,
            }}
          >
            You can open the project without a cluster target and configure it
            later in project settings.
          </div>

          {/* Try custom path */}
          <KubeconfigPathInput
            value={kubeconfigPath}
            onChange={setKubeconfigPath}
            onBlur={() => reloadContexts(kubeconfigPath)}
          />
        </div>
      )}

      {loadState === "ready" && (
        <div style={{ maxWidth: 520 }}>
          {/* Context list */}
          <div
            style={{
              color: "var(--text-subtle)",
              fontSize: "var(--font-size-xs)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 10,
            }}
          >
            Available Contexts
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              marginBottom: 16,
            }}
          >
            {contexts.map((ctx) => (
              <ContextRow
                key={ctx.name}
                ctx={ctx}
                selected={selectedContext === ctx.name}
                onSelect={() => {
                  setSelectedContext(ctx.name);
                  setConnectionState({ status: "idle" });
                }}
                isCurrent={ctx.name === currentContext}
              />
            ))}
          </div>

          {/* Test connection */}
          {selectedContext && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={testConnection}
                disabled={connectionState.status === "testing"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  cursor:
                    connectionState.status === "testing" ? "wait" : "pointer",
                  color: "var(--text-subtle)",
                  fontSize: "var(--font-size-sm)",
                  transition: "var(--ease-fast)",
                }}
                onMouseEnter={(e) => {
                  if (connectionState.status !== "testing")
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-subtle)";
                }}
              >
                <AppIcon name="monitoring" size={13} strokeWidth={1.75} />
                <span>Test Connection</span>
              </button>
              <ConnectionBadge state={connectionState} />
            </div>
          )}

          {/* Advanced section */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-faint)",
              fontSize: "var(--font-size-xs)",
              padding: "4px 0",
              marginBottom: showAdvanced ? 14 : 0,
              transition: "var(--ease-fast)",
            }}
          >
            <AppIcon
              name={showAdvanced ? "chevronDown" : "chevronRight"}
              size={11}
              strokeWidth={2}
            />
            <span>Advanced</span>
          </button>

          {showAdvanced && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "14px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                marginBottom: 16,
              }}
            >
              <KubeconfigPathInput
                value={kubeconfigPath}
                onChange={setKubeconfigPath}
                onBlur={() => reloadContexts(kubeconfigPath)}
              />
              <div>
                <label
                  style={{
                    display: "block",
                    color: "var(--text-subtle)",
                    fontSize: "var(--font-size-xs)",
                    marginBottom: 6,
                    fontWeight: 500,
                  }}
                >
                  Default Namespace (optional)
                </label>
                <input
                  type="text"
                  value={customNamespace}
                  onChange={(e) => setCustomNamespace(e.target.value)}
                  placeholder={
                    contexts.find((c) => c.name === selectedContext)
                      ?.namespace ?? "default"
                  }
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: "auto",
          paddingTop: 28,
        }}
      >
        <button
          onClick={handleConfirm}
          disabled={
            loadState === "loading" ||
            (loadState === "ready" && !selectedContext)
          }
          style={{
            padding: "9px 20px",
            background:
              connectionState.status === "ok"
                ? "rgba(166,227,161,0.12)"
                : "rgba(203,166,247,0.12)",
            border: `1px solid ${
              connectionState.status === "ok"
                ? "rgba(166,227,161,0.3)"
                : "var(--border-accent)"
            }`,
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            color:
              connectionState.status === "ok"
                ? "var(--accent-green, #a6e3a1)"
                : "var(--accent-alt)",
            fontSize: "var(--font-size-md)",
            fontWeight: 500,
            transition: "var(--ease-fast)",
            opacity:
              loadState === "loading" ||
              (loadState === "ready" && !selectedContext)
                ? 0.5
                : 1,
          }}
        >
          {connectionState.status === "ok"
            ? "Open Project →"
            : "Open Project →"}
        </button>

        <button
          onClick={handleSkip}
          style={{
            padding: "9px 16px",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            color: "var(--text-faint)",
            fontSize: "var(--font-size-sm)",
            transition: "var(--ease-fast)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-subtle)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-faint)";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
        >
          Skip for now
        </button>

        {connectionState.status === "error" && (
          <span
            style={{
              color: "var(--text-faint)",
              fontSize: "var(--font-size-xs)",
              marginLeft: 4,
            }}
          >
            Cluster unreachable — you can still open the project
          </span>
        )}
      </div>
    </div>
  );
}

// ─── KubeconfigPathInput ──────────────────────────────────────────────────────

function KubeconfigPathInput({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          color: "var(--text-subtle)",
          fontSize: "var(--font-size-xs)",
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        Kubeconfig Path
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="~/.kube/config"
        spellCheck={false}
        style={{
          width: "100%",
          padding: "7px 10px",
          background: "var(--bg-app)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          fontSize: "var(--font-size-sm)",
          fontFamily: "var(--font-mono)",
          outline: "none",
        }}
      />
      <div
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          marginTop: 4,
        }}
      >
        Press Tab or click away to reload contexts
      </div>
    </div>
  );
}
