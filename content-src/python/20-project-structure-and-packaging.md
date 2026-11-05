# Project structure, packaging and tooling

By the end of this chapter you can lay out a pipeline repo the way teams expect, manage dependencies reproducibly, add a command-line entry point, and wire up linting, type checks and tests in CI. This is what turns a notebook into something a team can run at 3 a.m.

## A layout that scales

```text
orders-pipeline/
├── pyproject.toml          # name, version, dependencies, tool settings
├── README.md               # what it does, how to run it
├── .env.example            # the env vars it needs, no real values
├── src/
│   └── orders_pipeline/
│       ├── __init__.py
│       ├── __main__.py     # lets you run: python -m orders_pipeline
│       ├── config.py       # settings from env + file (chapter 13)
│       ├── extract.py      # API / files / DB readers
│       ├── transform.py    # pure functions, easy to test
│       ├── load.py         # writers, upserts
│       └── cli.py          # argument parsing, wires the steps together
├── tests/
│   ├── test_transform.py
│   └── fixtures/orders_small.csv
└── .github/workflows/ci.yml
```

Why `src/`? It forces your tests to import the *installed* package rather than whatever file happens to be in the current folder, which catches packaging mistakes early.

Keep `extract` and `load` thin and push logic into `transform`. That's where tests are cheap.

## pyproject.toml

One file replaces `setup.py`, `setup.cfg` and most tool config files.

```toml
[project]
name = "orders-pipeline"
version = "0.3.1"
requires-python = ">=3.11"
dependencies = [
    "pandas>=2.2,<3",
    "pyarrow>=15",
    "requests>=2.31",
]

[project.optional-dependencies]
dev = ["pytest>=8", "ruff>=0.6", "mypy>=1.10"]

[project.scripts]
orders-pipeline = "orders_pipeline.cli:main"     # installs a command

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Virtual environments and pinned dependencies

Each project gets its own environment so versions never clash between projects.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # editable install: code changes apply immediately
```

Ranges in `pyproject.toml` say what *works*. A lock file says exactly what *ran*, so the job behaves the same in CI and production:

```bash
# with uv (fast, increasingly the default)
uv lock && uv sync
# or with pip-tools
pip-compile pyproject.toml -o requirements.lock
```

## A real command-line entry point

Schedulers like Airflow, cron, ADF or Databricks Jobs call your code from the command line. `argparse` is in the standard library. This one runs in your browser by passing arguments in a list:

```python
import argparse, sys
from datetime import date

def build_parser():
    p = argparse.ArgumentParser(prog="orders-pipeline", description="Load orders for one day.")
    p.add_argument("--run-date", type=date.fromisoformat, required=True, help="YYYY-MM-DD")
    p.add_argument("--env", choices=["dev", "prod"], default="dev")
    p.add_argument("--dry-run", action="store_true", help="transform but don't write")
    p.add_argument("--limit", type=int, default=None)
    return p

def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"run_date={args.run_date} env={args.env} dry_run={args.dry_run} limit={args.limit}")
    # extract -> transform -> load would go here
    return 0

main(["--run-date", "2025-12-03", "--dry-run"])
try:
    main(["--run-date", "03-12-2025"])
except SystemExit:
    print("argparse rejected the bad date and printed the usage and the error above")
```

Three habits that make jobs safe to schedule:

- **A run date argument**, never "today" inside the code, so you can backfill any day.
- **`--dry-run`**, so you can test against prod data without writing.
- **Exit codes**: return 0 on success and non-zero on failure, so the scheduler marks the task red.

```python norun
# src/orders_pipeline/__main__.py
import sys
from .cli import main
sys.exit(main())
```

## Lint, format and type-check

```bash
ruff check . --fix      # lint: unused imports, bugs, style
ruff format .           # format: no more style debates in reviews
mypy src                # type check the hints you wrote
pytest -q               # tests
```

Type hints pay off most at function boundaries:

```python
from typing import Iterable, Iterator

def batched(rows: Iterable[dict], size: int) -> Iterator[list[dict]]:
    batch: list[dict] = []
    for r in rows:
        batch.append(r)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch

print([len(b) for b in batched(({"i": i} for i in range(23)), 10)])
```

Python ignores hints at run time, but `mypy` and your editor use them to catch `None` passed where a `str` was expected before it reaches production.

## CI in one file

```yaml
# .github/workflows/ci.yml
name: ci
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -e ".[dev]"
      - run: ruff check . && ruff format --check .
      - run: mypy src
      - run: pytest -q
```

Every pull request now proves the code is linted, typed and tested before anyone reviews it.

## Shipping it

- **Wheel**: `python -m build` creates a `.whl` you can install on a Databricks cluster or a server.
- **Docker image**: for Kubernetes, ECS or Cloud Run. Copy the lock file first so dependency layers are cached.
- **Pre-commit hooks**: run ruff before every commit, so CI rarely fails on style.

## Common mistakes

- One giant `pipeline.py` with I/O and logic mixed together.
- `pip install pandas` with no versions recorded anywhere.
- Using "today" inside the job instead of a run-date argument.
- Catching every exception in `main` and exiting 0, so failures look green.
- Committing `.env` with real secrets. Commit `.env.example` instead.

## In the interview

- *"How do you structure a Python data project?"* `src/` package split into extract, transform, load and config; pure transforms with unit tests; `pyproject.toml` with a lock file; a CLI with a run date and dry run; ruff, mypy and pytest in CI.
- *"How do you make a job backfillable?"* Take the run date as a parameter, make every write idempotent for that date, and never read the clock inside the logic.

```quiz
Why should a scheduled job take --run-date instead of using today's date?
* So you can re-run or backfill any past day
- Because dates are faster as arguments
- Because cron requires it
> A job that only knows "today" can't fix last Tuesday.
---
What does a lock file add on top of pyproject.toml ranges?
- Faster installs only
* The exact versions that ran, so every environment matches
- Security scanning
> Ranges say what should work; the lock says exactly what did.
---
Your main() catches all exceptions and returns 0. What's the problem?
- None
* The scheduler thinks failed runs succeeded
- It's slower
> Return non-zero on failure so the task goes red and alerts fire.
```

```practice
py 25
```
