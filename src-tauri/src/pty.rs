// pty.rs
// ─────────────────────────────────────────────────────────────────────────────
// PTY (pseudo-terminal) backend for the embedded terminal panel.
//
// How it works:
//   1. `pty_start` spawns the OS default shell inside a PTY using `portable-pty`.
//      - On macOS/Linux: bash or zsh (reads $SHELL)
//      - On Windows: PowerShell or cmd.exe
//   2. The PTY master fd is split into a reader and a writer.
//      - Writer is stored in PtySession so `pty_write` can forward keystrokes.
//      - Reader runs in a background thread that emits Tauri events with raw bytes.
//   3. `pty_resize` forwards SIGWINCH to the kernel with the new terminal size.
//   4. `pty_kill` sends SIGTERM/SIGKILL to the child process and drops the session.
//
// Dependencies to add to Cargo.toml:
//   portable-pty = "0.8"
//   base64 = "0.21"
//   tokio = { version = "1", features = ["full"] }

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter, Manager, State};

// ─── Session State ────────────────────────────────────────────────────────────

/// Holds everything needed to interact with a live PTY session.
struct PtySession {
    /// The write-half of the PTY master — sends bytes to the shell's stdin.
    writer: Box<dyn Write + Send>,
    /// Handle to the child process — used for resize and kill.
    child: Box<dyn Child + Send + Sync>,
    /// The PTY master handle — must be kept alive or the PTY closes.
    master: Box<dyn MasterPty + Send>,
}

/// Thread-safe map of sessionId → PtySession.
pub struct PtyManager(Mutex<HashMap<String, PtySession>>);

impl PtyManager {
    pub fn new() -> Self {
        PtyManager(Mutex::new(HashMap::new()))
    }
}

// ─── Determine Default Shell ──────────────────────────────────────────────────

/// Returns the user's default shell executable path.
fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        // Prefer PowerShell 7 (pwsh), fall back to Windows PowerShell, then cmd
        if which::which("pwsh").is_ok() {
            return "pwsh".to_string();
        }
        if which::which("powershell").is_ok() {
            return "powershell".to_string();
        }
        return "cmd.exe".to_string();
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Respect $SHELL environment variable (set by login shell)
        if let Ok(shell) = std::env::var("SHELL") {
            if !shell.is_empty() {
                return shell;
            }
        }
        // Fallback order: zsh → bash → sh
        for candidate in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
            if std::path::Path::new(candidate).exists() {
                return candidate.to_string();
            }
        }
        "sh".to_string()
    }
}

// ─── Tauri Commands ────────────────────────────────────────────────────────────

/// Start a new PTY session.
///
/// # Arguments
/// * `session_id` – unique identifier for this terminal (e.g. "term-1")
/// * `cols` / `rows` – initial terminal dimensions
///
/// The command spawns the shell and immediately starts a background reader thread
/// that emits `pty-output-{sessionId}` events with base64-encoded PTY output.
#[tauri::command]
pub fn pty_start(
    app: AppHandle,
    state: State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // Prevent duplicate sessions
    {
        let sessions = state.0.lock().map_err(|e| e.to_string())?;
        if sessions.contains_key(&session_id) {
            return Ok(()); // Already running
        }
    }

    // ── Create PTY ────────────────────────────────────────────────────────────
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width:  0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // ── Build shell command ───────────────────────────────────────────────────
    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);

    // Pass a login shell flag so .zshrc / .bashrc are sourced
    #[cfg(not(target_os = "windows"))]
    cmd.arg("-l");

    // Inherit environment (PATH, HOME, USER, TERM, etc.)
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Set working directory to project root or home
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(&home);
    }

    // ── Spawn child process inside the PTY slave ──────────────────────────────
    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell ({shell}): {e}"))?;

    // slave is consumed by spawn; we only need master from here on
    let master = pty_pair.master;
    let writer = master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;
    let mut reader = master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

    // ── Store the session ─────────────────────────────────────────────────────
    {
        let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
        sessions.insert(
            session_id.clone(),
            PtySession { writer, child, master },
        );
    }

    // ── Background reader thread ──────────────────────────────────────────────
    // Reads raw bytes from the PTY and emits them to the frontend as base64.
    // Using a thread (not async) because portable-pty's reader is blocking.
    let app_clone = app.clone();
    let sid = session_id.clone();

    std::thread::spawn(move || {
        let output_event = format!("pty-output-{sid}");
        let exit_event   = format!("pty-exit-{sid}");
        let mut buf = vec![0u8; 4096];

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF — shell process exited
                    let _ = app_clone.emit(&exit_event, 0i32);
                    break;
                }
                Ok(n) => {
                    // Base64-encode the raw bytes before sending over IPC.
                    // xterm.js will decode and write them, handling all ANSI escapes.
                    let encoded = BASE64.encode(&buf[..n]);
                    if let Err(e) = app_clone.emit(&output_event, encoded) {
                        eprintln!("[pty] emit error for session {sid}: {e}");
                    }
                }
                Err(e) => {
                    // Read error usually means the PTY was closed
                    eprintln!("[pty] reader error for session {sid}: {e}");
                    let _ = app_clone.emit(&exit_event, 1i32);
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Send raw input bytes to the PTY (keyboard input, paste, Ctrl+C, etc.).
///
/// `data` is a UTF-8 string from xterm.js's `onData` callback.
/// Special keys (arrows, Ctrl+C, Ctrl+L, etc.) are already encoded by xterm
/// into their correct escape sequences.
#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Session '{session_id}' not found"))?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write error: {e}"))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Flush error: {e}"))?;
    Ok(())
}

/// Notify the PTY of a terminal size change (triggers SIGWINCH on POSIX).
///
/// Called whenever the React container is resized (via ResizeObserver + FitAddon).
#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.0.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session '{session_id}' not found"))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width:  0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize error: {e}"))?;
    Ok(())
}

/// Kill the shell process and clean up the session.
///
/// Called when the user closes a terminal tab or the app window closes.
#[tauri::command]
pub fn pty_kill(
    state: State<'_, PtyManager>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        // kill() sends SIGKILL on POSIX, TerminateProcess on Windows.
        let _ = session.child.kill();
        // Drop session — closes the master fd, reader/writer get EOF.
    }
    Ok(())
}
