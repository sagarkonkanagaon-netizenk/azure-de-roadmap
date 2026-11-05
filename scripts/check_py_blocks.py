"""Run every runnable ```python block in a handbook, chapter by chapter.

Blocks in one chapter share a namespace, like the in-browser runner does. Each chapter runs in its
own empty temp folder so file examples can't collide. Exits 1 if any block fails.
Usage: python scripts/check_py_blocks.py content-src/python [chapter-number-regex] [-v]
"""
import ast, asyncio, contextlib, io, os, re, sys, tempfile, traceback, inspect
from pathlib import Path

BLOCK = re.compile(r"```python([^\n]*)\n(.*?)```", re.S)

def run_cell(src, ns):
    code = compile(src, "<block>", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    if code.co_flags & inspect.CO_COROUTINE:
        asyncio.run(eval(code, ns))
    else:
        exec(code, ns)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    verbose = "-v" in sys.argv
    folder = Path(args[0]).resolve()
    only = re.compile(args[1]) if len(args) > 1 else None
    failures = total = 0
    for md in sorted(folder.glob("*.md"), key=lambda p: int(p.name.split("-")[0])):
        num = md.name.split("-")[0]
        if only and not only.fullmatch(num.lstrip("0") or "0"):
            continue
        blocks = [(m.group(2), md.read_text(encoding="utf-8")[:m.start()].count("\n") + 1)
                  for m in BLOCK.finditer(md.read_text(encoding="utf-8")) if "norun" not in m.group(1)]
        ns = {"__name__": "__main__"}
        with tempfile.TemporaryDirectory() as tmp:
            old = os.getcwd(); os.chdir(tmp)
            try:
                for src, line in blocks:
                    total += 1
                    buf = io.StringIO()
                    try:
                        with contextlib.redirect_stdout(buf):
                            run_cell(src, ns)
                        if verbose:
                            print(f"--- {md.name}:{line}\n{buf.getvalue()}")
                    except Exception:
                        failures += 1
                        print(f"FAIL {md.name}:{line}\n{buf.getvalue()}{traceback.format_exc(limit=3)}")
            finally:
                os.chdir(old)
    print(f"{total - failures}/{total} python blocks passed")
    sys.exit(1 if failures else 0)

main()
