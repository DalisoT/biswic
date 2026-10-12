"""Single-pass tokenizer for converting the ZAMBIA_MODULES array literal
from prisma/seed-learning-zambia.ts into valid JSON.

Tracks three string modes: single-quoted ('), double-quoted ("), and
backtick template (`). All other tokens are emitted unchanged. Apostrophes
inside single-quoted strings (e.g. "That's a mistake") are correctly skipped
when followed by a letter (contraction rule).

Order of operations does NOT matter because we walk the source in one pass.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SRC = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\seed-learning-zambia.ts")
DST_JSON = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\zambia-modules.clean.json")


# States
NORMAL = "normal"
IN_SQ = "sq"   # single-quoted string
IN_DQ = "dq"   # double-quoted string
IN_TPL = "tpl"  # backtick template literal
LINE_COMMENT = "lc"
BLOCK_COMMENT = "bc"


def find_array_literal(text: str, header_regex: str) -> tuple[int, int]:
    """Return (start_idx, end_idx_exclusive) of the `const X = [...]` block."""
    m = re.search(header_regex, text)
    if not m:
        raise SystemExit(f"header not found: {header_regex}")
    i = text.index("[", m.start())
    depth = 0
    n = len(text)
    j = i
    state = NORMAL
    while j < n:
        c = text[j]
        if state == NORMAL:
            if c == "'":
                state = IN_SQ
            elif c == '"':
                state = IN_DQ
            elif c == "`":
                state = IN_TPL
            elif c == "/" and j + 1 < n and text[j + 1] == "/":
                state = LINE_COMMENT
                j += 2
                continue
            elif c == "/" and j + 1 < n and text[j + 1] == "*":
                state = BLOCK_COMMENT
                j += 2
                continue
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return (i, j + 1)
        elif state == IN_SQ:
            if c == "\\" and j + 1 < n:
                j += 2
                continue
            if c == "'":
                # contraction heuristic: ' followed by a letter is part of the word, not closer
                if j + 1 < n and text[j + 1].isalpha():
                    j += 1
                    continue
                state = NORMAL
        elif state == IN_DQ:
            if c == "\\" and j + 1 < n:
                j += 2
                continue
            if c == '"':
                state = NORMAL
        elif state == IN_TPL:
            if c == "\\" and j + 1 < n:
                j += 2
                continue
            if c == "`":
                state = NORMAL
        elif state == LINE_COMMENT:
            if c == "\n":
                state = NORMAL
        elif state == BLOCK_COMMENT:
            if c == "*" and j + 1 < n and text[j + 1] == "/":
                state = NORMAL
                j += 2
                continue
        j += 1
    raise SystemExit("matching ] not found")


def tokenize_to_json(src_text: str) -> str:
    """Convert TS source text to JSON-compatible text in ONE pass.

    - Single-quoted strings:  '...'  →  "..."  (with contraction handling)
    - Double-quoted strings:  "..."  →  pass-through (already valid JSON)
    - Backtick templates:     `...`  →  "..."  (escape \n, \r, \t, \\, \")
    - Comments stripped
    - `Role.X` identifiers become "X" strings (post-process pass)
    - Object keys get quoted (handled here in NORMAL state, only outside strings)
    """
    out: list[str] = []
    i = 0
    n = len(src_text)
    state = NORMAL
    while i < n:
        c = src_text[i]

        if state == NORMAL:
            # Bare object key: `,` or `{` (with whitespace) + identifier + `:` → quote it
            if c in "{,":
                # peek ahead for identifier-colon pattern
                j = i + 1
                while j < n and src_text[j] in " \t\r\n":
                    j += 1
                # collect identifier
                k = j
                while k < n and (src_text[k].isalnum() or src_text[k] == "_"):
                    k += 1
                if k > j and k < n:
                    # check whitespace + colon
                    m = k
                    while m < n and src_text[m] in " \t\r\n":
                        m += 1
                    if m < n and src_text[m] == ":":
                        # it's a bare key — emit "{," + ws + '"' + ident + '"' + ws + ':'
                        out.append(c)
                        out.append(src_text[i + 1 : j])  # whitespace after `{` or `,`
                        out.append('"')
                        out.append(src_text[j:k])  # identifier
                        out.append('"')
                        out.append(src_text[k:m])  # whitespace before `:`
                        out.append(":")
                        i = m + 1
                        continue
            if c == "'":
                # opening single-quoted string
                out.append('"')
                state = IN_SQ
                i += 1
                continue
            if c == '"':
                out.append('"')
                state = IN_DQ
                i += 1
                continue
            if c == "`":
                out.append('"')
                state = IN_TPL
                i += 1
                continue
            if c == "/" and i + 1 < n and src_text[i + 1] == "/":
                state = LINE_COMMENT
                i += 2
                continue
            if c == "/" and i + 1 < n and src_text[i + 1] == "*":
                state = BLOCK_COMMENT
                i += 2
                continue
            out.append(c)
            i += 1
            continue

        if state == IN_SQ:
            if c == "\\" and i + 1 < n:
                # backslash-escape: emit the escaped char normalized for JSON
                nxt = src_text[i + 1]
                if nxt == "'":
                    # \' -> ' (JSON doesn't need single-quote escape)
                    out.append("'")
                elif nxt == '"':
                    out.append('\\"')
                elif nxt == "\\":
                    out.append("\\\\")
                elif nxt == "n":
                    out.append("\\n")
                elif nxt == "r":
                    out.append("\\r")
                elif nxt == "t":
                    out.append("\\t")
                else:
                    # other escapes (rare) - pass through
                    out.append(c)
                    out.append(nxt)
                i += 2
                continue
            if c == '"':
                # unescaped double quote inside single-quoted TS string -> escape for JSON
                out.append('\\"')
                i += 1
                continue
            if c == "\n":
                out.append("\\n")
                i += 1
                continue
            if c == "\r":
                i += 1
                continue
            if c == "\t":
                out.append("\\t")
                i += 1
                continue
            if c == "'":
                if i + 1 < n and src_text[i + 1].isalpha():
                    # contraction apostrophe - stay in string
                    out.append("'")
                    i += 1
                    continue
                # close string
                out.append('"')
                state = NORMAL
                i += 1
                continue
            out.append(c)
            i += 1
            continue

        if state == IN_DQ:
            if c == "\\" and i + 1 < n:
                nxt = src_text[i + 1]
                if nxt == "'":
                    # \' -> ' (JSON doesn't need single-quote escape)
                    out.append("'")
                elif nxt == '"':
                    out.append('\\"')
                elif nxt == "\\":
                    out.append("\\\\")
                elif nxt == "n":
                    out.append("\\n")
                elif nxt == "r":
                    out.append("\\r")
                elif nxt == "t":
                    out.append("\\t")
                else:
                    out.append(c)
                    out.append(nxt)
                i += 2
                continue
            if c == "\n":
                out.append("\\n")
                i += 1
                continue
            if c == "\r":
                i += 1
                continue
            if c == "\t":
                out.append("\\t")
                i += 1
                continue
            if c == '"':
                out.append('"')
                state = NORMAL
                i += 1
                continue
            out.append(c)
            i += 1
            continue

        if state == IN_TPL:
            if c == "\\" and i + 1 < n:
                # emit char and escape next (we'll normalize later)
                nxt = src_text[i + 1]
                if nxt == "n":
                    out.append("\\n")
                elif nxt == "r":
                    out.append("\\r")
                elif nxt == "t":
                    out.append("\\t")
                elif nxt == "\\":
                    out.append("\\\\")
                elif nxt == '"':
                    out.append('\\"')
                elif nxt == "`":
                    out.append("`")
                else:
                    out.append(c)
                    out.append(nxt)
                i += 2
                continue
            if c == '"':
                # unescaped double quote in template - escape it
                out.append('\\"')
                i += 1
                continue
            if c == "\n":
                out.append("\\n")
                i += 1
                continue
            if c == "\r":
                i += 1
                continue
            if c == "\t":
                out.append("\\t")
                i += 1
                continue
            if c == "`":
                out.append('"')
                state = NORMAL
                i += 1
                continue
            out.append(c)
            i += 1
            continue

        if state == LINE_COMMENT:
            if c == "\n":
                out.append("\n")
                state = NORMAL
            i += 1
            continue

        if state == BLOCK_COMMENT:
            if c == "*" and i + 1 < n and src_text[i + 1] == "/":
                state = NORMAL
                i += 2
                continue
            i += 1
            continue

    return "".join(out)


def strip_trailing_commas(text: str) -> str:
    """Remove trailing commas in arrays/objects (legal in TS, illegal in JSON).

    Walks the string, tracks string state, replaces `,` immediately before
    `]` or `}` (with optional whitespace between).
    """
    out = []
    i = 0
    n = len(text)
    state = NORMAL
    while i < n:
        c = text[i]
        if state == NORMAL:
            if c == '"':
                out.append(c)
                state = IN_DQ
                i += 1
                continue
            if c == ",":
                # look ahead through whitespace for ] or }
                j = i + 1
                while j < n and text[j] in " \t\r\n":
                    j += 1
                if j < n and text[j] in "]}":
                    # skip the comma
                    i += 1
                    continue
            out.append(c)
            i += 1
            continue
        if state == IN_DQ:
            if c == "\\" and i + 1 < n:
                out.append(c)
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                out.append(c)
                state = NORMAL
                i += 1
                continue
            out.append(c)
            i += 1
            continue
    return "".join(out)


def post_process(text: str) -> str:
    """After tokenization: strip trailing commas, replace Role.X.

    Key-quoting happens in the tokenizer (NORMAL state) so we don't
    accidentally quote inside string contents.
    """
    text = strip_trailing_commas(text)
    text = re.sub(r"\bRole\.([A-Z_]+)\b", r'"\1"', text)
    return text


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    print(f"read {len(text):,} chars from {SRC.name}")

    start, end = find_array_literal(text, r"const ZAMBIA_MODULES\s*=\s*\[")
    arr_text = text[start:end]
    print(f"array literal: {len(arr_text):,} chars")

    converted = tokenize_to_json(arr_text)
    final_text = post_process(converted).rstrip().rstrip(";").rstrip()

    try:
        data = json.loads(final_text)
    except json.JSONDecodeError as e:
        lines = final_text.splitlines()
        line_no = e.lineno - 1
        ctx_start = max(0, line_no - 3)
        ctx_end = min(len(lines), line_no + 4)
        print(f"JSON parse failed at line {e.lineno} col {e.colno}: {e.msg}")
        for k in range(ctx_start, ctx_end):
            mark = " >>> " if k == line_no else "     "
            print(f"{mark}{k+1:5d}: {lines[k][:300]}")
        debug = Path(r"C:\Users\RICHARD_TEMBO\Desktop\Projects\biswic\prisma\_debug_final.txt")
        debug.write_text(final_text, encoding="utf-8")
        print(f"debug dump: {debug}")
        raise

    print(f"parsed {len(data)} modules")
    total_lessons = sum(len(m.get("lessons") or []) for m in data)
    total_questions = sum(len(m["quiz"]["questions"]) for m in data)
    print(f"total lessons: {total_lessons}")
    print(f"total quiz questions: {total_questions}")

    DST_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {DST_JSON}")


if __name__ == "__main__":
    main()
