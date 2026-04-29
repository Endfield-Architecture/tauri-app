// lib.rs (or main.rs) — Tauri app entry point
// ─────────────────────────────────────────────────────────────────────────────
// Add mod pty; to your existing lib.rs / main.rs, then register the commands
// and state as shown below.
//
// NOTE: Only add the `pty` parts — keep your existing commands/plugins intact.

mod pty; // Add this line

// ... your existing use statements ...

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Register PTY state (thread-safe session map) ──────────────────────
        .manage(pty::PtyManager::new())

        // ── Register PTY commands alongside your existing ones ────────────────
        .invoke_handler(tauri::generate_handler![
            // ... your existing commands ...

            // Terminal / PTY commands:
            pty::pty_start,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
