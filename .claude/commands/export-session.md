---
description: Export this conversation to a full plain-text file (like CLI /export, but readable)
---

Export the current session to a complete, human-readable text file:

1. Call `mcp__ccd_session_mgmt__export_transcript` with `session_id: "self"` to produce the session zip (contains `transcript.jsonl`). If that tool isn't loaded yet, load it first via ToolSearch with query `select:mcp__ccd_session_mgmt__export_transcript`.
2. Run `python scripts/export_transcript_to_text.py <path-to-the-zip-from-step-1>` (no `--truncate` flag, so every user message, assistant response, tool call and tool result is included in full) to produce a `.txt` file next to the zip.
3. Tell the user the final `.txt` path and its size. Do not summarize or trim the content yourself — the script already wrote everything.
