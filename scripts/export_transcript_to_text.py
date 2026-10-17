#!/usr/bin/env python3
"""Convert a Claude Code session export (zip or transcript.jsonl) into a plain-text transcript.

Usage:
    python scripts/export_transcript_to_text.py <session-export.zip | transcript.jsonl> [-o output.txt] [--truncate N]

Accepts either the zip produced by the app's "Export" action (looks for the
transcript.jsonl inside it) or a transcript.jsonl file directly. Writes a
readable text file with every user message, assistant response, tool call
and tool result in order. By default nothing is truncated; pass --truncate
to cap long tool inputs/results at N characters.
"""

import argparse
import json
import sys
import zipfile
from pathlib import Path

TRUNCATE_LIMIT: int | None = None  # set from --truncate; None means include everything


def load_lines(path: Path) -> list[str]:
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as zf:
            candidates = [n for n in zf.namelist() if n.endswith("transcript.jsonl")]
            if not candidates:
                sys.exit(f"No transcript.jsonl found inside {path}")
            with zf.open(candidates[0]) as f:
                return f.read().decode("utf-8").splitlines()
    return path.read_text(encoding="utf-8").splitlines()


def truncate(text: str, limit: int | None = None) -> str:
    text = text.strip()
    limit = limit if limit is not None else TRUNCATE_LIMIT
    if limit is not None and len(text) > limit:
        return text[:limit] + f"\n... [truncated, {len(text) - limit} more characters]"
    return text


def stringify_tool_result_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            else:
                parts.append(json.dumps(block))
        return "\n".join(parts)
    return json.dumps(content)


def format_tool_input(tool_input: dict) -> str:
    try:
        rendered = json.dumps(tool_input, ensure_ascii=False)
    except TypeError:
        rendered = str(tool_input)
    return truncate(rendered)


def render_assistant_message(message: dict, out: list[str]) -> None:
    for block in message.get("content", []):
        btype = block.get("type")
        if btype == "text":
            text = block.get("text", "").strip()
            if text:
                out.append(text)
        elif btype == "tool_use":
            name = block.get("name", "unknown_tool")
            out.append(f"  [tool call] {name}({format_tool_input(block.get('input', {}))})")
        # "thinking" blocks are internal reasoning and intentionally skipped


def render_user_message(message: dict, out: list[str]) -> None:
    content = message.get("content")
    if isinstance(content, str):
        text = content.strip()
        if text:
            out.append(text)
        return
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "tool_result":
                rendered = truncate(stringify_tool_result_content(block.get("content")))
                out.append(f"  [tool result] {rendered}")
            elif btype == "text":
                text = block.get("text", "").strip()
                if text:
                    out.append(text)


def convert(lines: list[str]) -> str:
    out_lines: list[str] = []
    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue

        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant"):
            continue  # skip queue-operations, attachments, metadata, etc.

        message = entry.get("message")
        if not isinstance(message, dict):
            continue

        timestamp = entry.get("timestamp", "")
        role = "User" if entry_type == "user" else "Claude"

        body: list[str] = []
        if entry_type == "user":
            render_user_message(message, body)
        else:
            render_assistant_message(message, body)

        if not body:
            continue

        header = f"### {role}" + (f"  ({timestamp})" if timestamp else "")
        out_lines.append(header)
        out_lines.extend(body)
        out_lines.append("")

    return "\n".join(out_lines)


def main() -> None:
    global TRUNCATE_LIMIT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Path to session-export.zip or transcript.jsonl")
    parser.add_argument("-o", "--output", type=Path, help="Output .txt path (default: alongside input)")
    parser.add_argument(
        "--truncate",
        type=int,
        default=None,
        help="Cap each tool input/result at N characters (default: include everything)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"Input not found: {args.input}")

    TRUNCATE_LIMIT = args.truncate
    output = args.output or args.input.with_suffix(".txt")
    lines = load_lines(args.input)
    text = convert(lines)
    output.write_text(text, encoding="utf-8")
    print(f"Wrote {output} ({len(text):,} characters)")


if __name__ == "__main__":
    main()
