#!/usr/bin/env python3
"""Extract latest advanced draft/tactics engines from agent transcript."""
import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\Admin\.cursor\projects\c-Users-Admin-Projects-lol-coach"
    r"\agent-transcripts\86c85ed2-ae96-4c46-8cb8-084cc7c170b9"
    r"\86c85ed2-ae96-4c46-8cb8-084cc7c170b9.jsonl"
)
OUT = Path(__file__).resolve().parents[1] / "public"


def iter_events():
    with TRANSCRIPT.open(encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            yield i, json.loads(line)


def extract_write(line_no: int, path_part: str) -> str | None:
    for i, obj in iter_events():
        if i != line_no:
            continue
        for part in obj.get("message", {}).get("content", []):
            if part.get("name") != "Write":
                continue
            p = part.get("input", {}).get("path", "")
            if path_part in p.replace("/", "\\"):
                return part["input"]["contents"]
    return None


def find_last_write(path_part: str, header_hint: str = "") -> tuple[int, str] | None:
    best = None
    for i, obj in iter_events():
        for part in obj.get("message", {}).get("content", []):
            if part.get("name") != "Write":
                continue
            inp = part.get("input", {})
            p = inp.get("path", "")
            if path_part not in p.replace("/", "\\"):
                continue
            content = inp.get("contents", "")
            if header_hint and header_hint not in content:
                continue
            best = (i, content)
    return best


def main():
    tactics = extract_write(3285, "tactics-engine.js")
    if tactics:
        (OUT / "tactics-engine.js").write_text(tactics, encoding="utf-8")
        print(f"tactics-engine.js from line 3285 ({len(tactics)} bytes)")
    else:
        print("tactics v7 not found")

    # v9 match-core delegation base; v14 was built via StrReplace on v13 LoL file.
    # Last full tfm2 draft Write before revert at 3404 was v9 at 3105 — not most advanced.
    # Try largest draft-engine Write for tfm2-coach path.
    draft_candidates = []
    for i, obj in iter_events():
        for part in obj.get("message", {}).get("content", []):
            if part.get("name") != "Write":
                continue
            p = part.get("input", {}).get("path", "")
            if "tfm2-coach" not in p.replace("/", "\\"):
                continue
            if not p.endswith("draft-engine.js"):
                continue
            c = part["input"].get("contents", "")
            draft_candidates.append((len(c), i, c[:80]))

    draft_candidates.sort(reverse=True)
    print("Top draft Write candidates:")
    for size, line, head in draft_candidates[:8]:
        print(f"  line {line}: {size} bytes — {head!r}")

    # Prefer v9 at 3105 if no larger match-core version exists as full write
    for size, line, _ in draft_candidates:
        content = extract_write(line, "draft-engine.js")
        if content and "TFM2MatchCore" in content and "scorePickCandidate" in content:
            (OUT / "draft-engine.js").write_text(content, encoding="utf-8")
            print(f"draft-engine.js from line {line} ({len(content)} bytes, match-core)")
            return

    if draft_candidates:
        line = draft_candidates[0][1]
        content = extract_write(line, "draft-engine.js")
        if content:
            (OUT / "draft-engine.js").write_text(content, encoding="utf-8")
            print(f"draft-engine.js fallback line {line} ({len(content)} bytes)")


if __name__ == "__main__":
    main()
