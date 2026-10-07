"""Fails when a test is skipped without being listed, with a reason, in rules/skipped-tests.json.

The register maps a path to {"count": N, "reason": "..."}. Counts are per file because line
numbers move. Run from a repository root, or pass --root. --update only ever shrinks the register:
adding a file or raising a count is done by hand, with a reason, so it shows up in review.

Every occurrence counts, including several on one line. A focused test (`.only`) counts too,
because it silently disables every other test in the run.

JavaScript and TypeScript: comments, string contents and regex literals (found by the previous
significant character, a heuristic) are blanked before matching; `${}` inside template strings is
not understood. A skip is `test|it|describe|suite|context` `.skip`/`.todo`/`.fixme` (called or
passed as a value, as in `cond ? test : test.skip`), `t.skip`/`t.todo`, `this.skip()`,
`xit`/`xdescribe`/`xtest`/`xcontext`, `pending(`, `.skipIf`/`.runIf`, or a `skip:`/`todo:` key in an
options object passed directly to a test, it, describe or suite call (a `{` after `(` or `,`; a
callback body is not an options object).

Go (`.Skip(`, `.Skipf(`, `.SkipNow(`), Rust (`#[ignore`) and Swift (`XCTSkip`) are scanned with
the same comment and string blanking.

Python: tokenize ignores strings and comments. A skip is unittest.skip/skipIf/skipUnless, a bare
`@skip` decorator, pytest.skip, pytest.mark.skip/skipif/xfail, self.skipTest, SkipTest or
importorskip. A file that does not tokenize fails the check.

Tracked source in a language this gate cannot scan (.rb .java .kt .cs .php) is a coverage gap and
fails the check, as does a repository with no scannable files at all.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import tokenize
from dataclasses import dataclass, field
from pathlib import Path

REGISTER = Path("rules/skipped-tests.json")
JS_EXTENSIONS = {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx"}
C_STYLE_PATTERNS = {
    ".go": re.compile(r"\.\s*(?:Skip|Skipf|SkipNow)\s*\("),
    ".rs": re.compile(r"#\s*\[\s*ignore\b"),
    ".swift": re.compile(r"\bXCTSkip\w*"),
}
UNSCANNED_EXTENSIONS = {".rb", ".java", ".kt", ".cs", ".php"}
IGNORED_PARTS = {"node_modules"}
SELF = Path(__file__).resolve()

SUITES = r"(?:test|it|describe|suite|context)"
JS_SKIP = re.compile(
    r"\b" + SUITES + r"\s*\.\s*(?:skip|todo|fixme)\b"
    r"|\bt\s*\.\s*(?:skip|todo|fixme)\b"
    r"|\bthis\s*\.\s*skip\s*\("
    r"|\b(?:xit|xdescribe|xtest|xcontext)\s*\("
    r"|\bpending\s*\("
    r"|\.\s*(?:skipIf|runIf)\b"
)
JS_ONLY = re.compile(r"\b" + SUITES + r"\s*\.\s*only\b")
JS_TEST_CALL = re.compile(r"\b(?:test|it|describe|suite)\s*\(")
JS_OPTION = re.compile(r"(?:skip|todo)\s*:")
REGEX_PRECEDERS = set("(,=:[!&|?{};+-*%<>~^")
REGEX_KEYWORDS = {"return", "typeof", "case", "do", "else", "in", "of", "void", "yield", "await"}
PYTHON_BARE_NAMES = {
    "skipIf",
    "skipUnless",
    "skipif",
    "skipTest",
    "SkipTest",
    "importorskip",
    "xfail",
}
PYTHON_QUALIFIED = {("unittest", "skip"), ("pytest", "skip"), ("mark", "skip")}

Hit = tuple[int, str]


class ScanError(Exception):
    """A file the gate could not scan."""


def blank(source: str, regexes: bool) -> str:
    """Replace comments, string contents and (for JS) regex literals with spaces."""
    out: list[str] = []
    i, n = 0, len(source)

    def blanked(text: str) -> str:
        return "".join(c if c == "\n" else " " for c in text)

    while i < n:
        char = source[i]
        pair = source[i : i + 2]
        if pair == "//":
            end = source.find("\n", i)
            end = n if end < 0 else end
            out.append(" " * (end - i))
            i = end
        elif pair == "/*":
            end = source.find("*/", i + 2)
            end = n if end < 0 else end + 2
            out.append(blanked(source[i:end]))
            i = end
        elif char in "'\"`":
            j = i + 1
            while j < n and source[j] != char:
                if source[j] == "\\":
                    j += 1
                elif source[j] == "\n" and char != "`":
                    break
                j += 1
            out.append(char + blanked(source[i + 1 : j]))
            if j < n and source[j] == char:
                out.append(char)
                j += 1
            i = j
        elif char == "/" and regexes and starts_regex("".join(out)):
            j = regex_end(source, i + 1)
            out.append("/" + blanked(source[i + 1 : j]))
            i = j
        else:
            out.append(char)
            i += 1
    return "".join(out)


def starts_regex(before: str) -> bool:
    stripped = before.rstrip()
    if not stripped:
        return True
    if stripped[-1] in REGEX_PRECEDERS:
        return True
    word = re.search(r"[A-Za-z_$][\w$]*$", stripped)
    return bool(word and word.group() in REGEX_KEYWORDS)


def regex_end(source: str, start: int) -> int:
    """Offset just after the closing slash of a regex literal, or the end of the line."""
    j, in_class = start, False
    while j < len(source) and source[j] != "\n":
        char = source[j]
        if char == "\\":
            j += 1
        elif char == "[":
            in_class = True
        elif char == "]":
            in_class = False
        elif char == "/" and not in_class:
            return j + 1
        j += 1
    return j


def option_offsets(text: str) -> list[int]:
    """Offsets of skip:/todo: keys in an options object passed directly to a test call."""
    found: list[int] = []
    for call in JS_TEST_CALL.finditer(text):
        stack: list[tuple[str, bool]] = [("(", False)]
        i = call.end()
        while i < len(text) and stack:
            char = text[i]
            previous = text[:i].rstrip()[-1:]
            if char in "([{":
                stack.append((char, char == "{" and len(stack) == 1 and previous in "(,"))
            elif char in ")]}":
                stack.pop()
            elif stack[-1] == ("{", True) and len(stack) == 2 and previous in "{,":
                option = JS_OPTION.match(text, i)
                if option and not (text[i - 1].isalnum() or text[i - 1] in "_$."):
                    found.append(i)
            i += 1
    return found


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def c_style_hits(source: str, suffix: str) -> list[Hit]:
    text = blank(source, regexes=suffix in JS_EXTENSIONS)
    if suffix not in JS_EXTENSIONS:
        return [(line_of(text, m.start()), "skip") for m in C_STYLE_PATTERNS[suffix].finditer(text)]
    offsets = [m.start() for m in JS_SKIP.finditer(text)] + option_offsets(text)
    hits = [(line_of(text, offset), "skip") for offset in offsets]
    return hits + [(line_of(text, m.start()), "only") for m in JS_ONLY.finditer(text)]


def python_hits(source: str, suffix: str) -> list[Hit]:
    try:
        tokens = [
            t
            for t in tokenize.generate_tokens(io.StringIO(source).readline)
            if t.type in (tokenize.NAME, tokenize.OP)
        ]
    except (tokenize.TokenError, SyntaxError) as error:
        raise ScanError(f"could not scan: {error}") from error
    hits: list[Hit] = []
    for index, current in enumerate(tokens):
        if current.type != tokenize.NAME:
            continue
        previous = tokens[index - 1].string if index else ""
        if previous in ("def", "class"):
            continue
        before = tokens[index - 2].string if index > 1 and previous == "." else ""
        if (
            current.string in PYTHON_BARE_NAMES
            or (before, current.string) in PYTHON_QUALIFIED
            or (previous == "@" and current.string == "skip")
        ):
            hits.append((current.start[0], "skip"))
    return hits


@dataclass
class Scan:
    hits: dict[str, list[Hit]] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    scanned: int = 0

    def counts(self) -> dict[str, int]:
        return {path: len(hits) for path, hits in self.hits.items()}


def candidate_files(root: Path) -> list[Path]:
    listing = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
        capture_output=True,
        check=True,
    ).stdout.decode()
    paths = sorted({Path(name) for name in listing.split("\0") if name})
    return [
        p
        for p in paths
        if not IGNORED_PARTS & set(p.parts)
        and (root / p).is_file()
        and (root / p).resolve() != SELF
    ]


def covered_elsewhere(path: str, register: dict[str, dict]) -> bool:
    """A file, or a directory key ending in "/", whose tests another check owns."""
    return any(
        entry.get("covered_elsewhere")
        and (path == key or (key.endswith("/") and path.startswith(key)))
        for key, entry in register.items()
    )


def find_skips(root: Path, register: dict[str, dict]) -> Scan:
    scan = Scan()
    for path in candidate_files(root):
        name = path.as_posix()
        if covered_elsewhere(name, register):
            continue
        if path.suffix in UNSCANNED_EXTENSIONS:
            scan.errors.append(
                f"skipped-tests: {name}: {path.suffix} skips cannot be detected (coverage gap);"
                ' if another check covers it, register it with "covered_elsewhere": true and a reason'
            )
            continue
        if path.suffix != ".py" and path.suffix not in JS_EXTENSIONS | set(C_STYLE_PATTERNS):
            continue
        scan.scanned += 1
        source = (root / path).read_text(encoding="utf-8", errors="replace")
        try:
            hits = (
                python_hits(source, path.suffix)
                if path.suffix == ".py"
                else c_style_hits(source, path.suffix)
            )
        except ScanError as error:
            scan.errors.append(f"skipped-tests: {name}: {error}")
            continue
        if hits:
            scan.hits[name] = sorted(hits)
    return scan


def load_register(root: Path) -> dict[str, dict]:
    path = root / REGISTER
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def describe(hits: list[Hit]) -> str:
    lines = sorted({line for line, _ in hits})
    text = "lines " + ", ".join(str(line) for line in lines)
    if any(kind == "only" for _, kind in hits):
        text += "; includes .only, which silently disables every other test"
    return text


def problems(root: Path, scan: Scan, register: dict[str, dict]) -> list[str]:
    out = list(scan.errors)
    if scan.scanned == 0:
        out.append("skipped-tests: no scannable source files found; is --root right?")
    counts = scan.counts()
    for path, hits in scan.hits.items():
        if any(kind == "only" for _, kind in hits):
            out.append(f"skipped-tests: {path}: remove .only; ordinary skip exceptions do not cover focused tests")
        entry = register.get(path)
        registered = entry.get("count", 0) if entry else 0
        if entry is None:
            out.append(
                f"skipped-tests: {path}: {len(hits)} unregistered skips ({describe(hits)});"
                f" run them, or register them in {REGISTER} with a reason"
            )
        elif len(hits) > registered:
            out.append(
                f"skipped-tests: {path}: {len(hits)} skips but {registered}"
                f" registered ({describe(hits)})"
            )
    for path, entry in sorted(register.items()):
        if not str(entry.get("reason", "")).strip():
            out.append(f"skipped-tests: {path}: registered without a reason")
        if not (root / path).exists():
            out.append(f"skipped-tests: {path}: registered but the file no longer exists")
        elif entry.get("covered_elsewhere"):
            continue
        elif entry.get("count", 0) > counts.get(path, 0):
            out.append(
                f"skipped-tests: {path}: stale: registered {entry.get('count', 0)} but found"
                f" {counts.get(path, 0)}; record the reduction (--update)"
            )
    return out


def update(root: Path, found: dict[str, int], register: dict[str, dict]) -> list[str]:
    notes: list[str] = []
    result: dict[str, dict] = {}
    for path, entry in register.items():
        if not (root / path).exists():
            notes.append(f"skipped-tests: removed {path} (file gone)")
            continue
        if entry.get("covered_elsewhere"):
            result[path] = entry
            continue
        count = found.get(path, 0)
        if count == 0:
            notes.append(f"skipped-tests: removed {path} (no skips left)")
        elif count < entry.get("count", 0):
            notes.append(f"skipped-tests: {path}: {entry['count']} -> {count}")
            result[path] = {**entry, "count": count}
        else:
            result[path] = entry
            if count > entry.get("count", 0):
                notes.append(f"skipped-tests: refused to raise {path} to {count}; edit by hand")
    for path, count in found.items():
        if path not in register:
            notes.append(f"skipped-tests: refused to add {path} ({count} skips); register by hand")
    (root / REGISTER).parent.mkdir(parents=True, exist_ok=True)
    (root / REGISTER).write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--update", action="store_true", help="shrink the register to match")
    args = parser.parse_args(argv)
    root: Path = args.root.resolve()
    register = load_register(root)
    scan = find_skips(root, register)
    if args.update:
        if not (root / REGISTER).exists():
            print("skipped-tests: no register to update", file=sys.stderr)
            return 1
        if scan.errors:
            print("\n".join(scan.errors), file=sys.stderr)
            return 1
        for note in update(root, scan.counts(), register):
            print(note, file=sys.stderr)
        register = load_register(root)
    failures = problems(root, scan, register)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    total = sum(scan.counts().values())
    print(f"skipped-tests: ok ({scan.scanned} files scanned; {total} skips, all registered)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
