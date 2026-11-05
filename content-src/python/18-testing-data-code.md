# Testing data code

By the end of this chapter you can write unit tests for transformations, test edge cases that break pipelines, check data quality on every run, and explain the difference between the two, which is one of the clearest signals of a senior data engineer.

## Two kinds of checks

| | Unit tests | Data quality checks |
|---|---|---|
| What they test | Your **code** | The **data** that arrives |
| When they run | In CI, before the code ships | In the pipeline, on every run |
| Input | Tiny, hand-made examples | Real production data |
| Example | "dedupe keeps the newest row" | "today's orders have no null ids" |

You need both. Perfect code still breaks when the source sends garbage.

## Write code that is easy to test

Pure functions (data in, data out, no reading files or calling APIs inside) are trivial to test. Keep I/O at the edges.

```python
from datetime import datetime

def normalise_phone(raw: str | None) -> str | None:
    if raw is None:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if len(digits) == 10 else None

def dedupe_latest(rows: list[dict], key: str, ts: str) -> list[dict]:
    latest = {}
    for r in rows:
        k = r[key]
        if k not in latest or r[ts] > latest[k][ts]:
            latest[k] = r
    return sorted(latest.values(), key=lambda r: r[key])
```

## Tests are just functions with assert

This is exactly what you'd put in `tests/test_transform.py` for pytest. Here a five-line runner plays pytest's part so you can run it in the browser.

```python
def test_phone_strips_formatting():
    assert normalise_phone("+91 98765-43210") == "9876543210"

def test_phone_rejects_short_numbers():
    assert normalise_phone("12345") is None

def test_phone_handles_none():
    assert normalise_phone(None) is None

def test_dedupe_keeps_newest():
    rows = [{"id": 1, "v": "old", "ts": "2025-12-01"},
            {"id": 1, "v": "new", "ts": "2025-12-03"},
            {"id": 2, "v": "only", "ts": "2025-12-02"}]
    assert [r["v"] for r in dedupe_latest(rows, "id", "ts")] == ["new", "only"]

def test_dedupe_empty_input():
    assert dedupe_latest([], "id", "ts") == []

def run_tests(ns):
    tests = [(n, f) for n, f in ns.items() if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn(); print("PASS", name)
        except AssertionError as e:
            failed += 1; print("FAIL", name, e)
    print(f"{len(tests) - failed} passed, {failed} failed")

run_tests(dict(globals()))
```

### Make failures easy to read

A bare `assert` tells you only that something was false. Compare whole values, and add a message:

```python
def test_dedupe_tie_keeps_first():
    rows = [{"id": 1, "v": "a", "ts": "2025-12-01"}, {"id": 1, "v": "b", "ts": "2025-12-01"}]
    got = dedupe_latest(rows, "id", "ts")
    assert got == [{"id": 1, "v": "a", "ts": "2025-12-01"}], f"got {got}"

run_tests({"test_dedupe_tie_keeps_first": test_dedupe_tie_keeps_first})
```

Ties are exactly the kind of edge case that causes a "random" difference between two runs. Writing the test forces you to decide what *should* happen.

## The edge cases that break pipelines

Every transformation deserves tests for:

- empty input, and a single row
- nulls in every nullable column
- duplicates, and ties on the sort key
- the first and last day of a month, a leap day, time-zone boundaries
- unicode names, leading and trailing spaces, mixed case
- very large and negative numbers, zero
- a column missing entirely, or an extra column added upstream

## pytest in a real repo

```python norun
# tests/test_transform.py
import pytest
from mypipeline.transform import normalise_phone

@pytest.mark.parametrize("raw, expected", [
    ("+91 98765-43210", "9876543210"),
    ("09876543210", None),
    ("", None),
    (None, None),
])
def test_normalise_phone(raw, expected):
    assert normalise_phone(raw) == expected

@pytest.fixture
def sample_orders(tmp_path):
    p = tmp_path / "orders.csv"
    p.write_text("id,amount\n1,10\n2,20\n")
    return p
```

`parametrize` turns one test into many cases. Fixtures like `tmp_path` give each test a clean temporary folder. Run with `pytest -q`, and in CI on every pull request.

## Testing pandas transformations

```python
import pandas as pd
from pandas.testing import assert_frame_equal

def add_revenue(df):
    return df.assign(revenue=df["qty"] * df["price"])

def test_add_revenue():
    given = pd.DataFrame({"qty": [2, 0], "price": [10.0, 5.0]})
    expected = pd.DataFrame({"qty": [2, 0], "price": [10.0, 5.0], "revenue": [20.0, 0.0]})
    assert_frame_equal(add_revenue(given), expected)

run_tests({"test_add_revenue": test_add_revenue})
```

`assert_frame_equal` checks values, column order and dtypes, and prints a clear diff when they differ.

## Data quality checks inside the pipeline

These run on real data every time and stop the load before bad data reaches dashboards.

```python
class DataQualityError(Exception):
    pass

def check_orders(df: pd.DataFrame, expected_min_rows=1):
    problems = []
    if len(df) < expected_min_rows:
        problems.append(f"only {len(df)} rows, expected at least {expected_min_rows}")
    if df["order_id"].isna().any():
        problems.append(f"{df['order_id'].isna().sum()} null order_id")
    if df["order_id"].duplicated().any():
        problems.append(f"{df['order_id'].duplicated().sum()} duplicate order_id")
    if (df["amount"] < 0).any():
        problems.append(f"{(df['amount'] < 0).sum()} negative amount")
    if not df["currency"].isin(["INR", "USD"]).all():
        problems.append("unexpected currency " + str(sorted(set(df["currency"]) - {"INR", "USD"})))
    if problems:
        raise DataQualityError("; ".join(problems))
    return df

today = pd.DataFrame({"order_id": [1, 2, 2, None], "amount": [10, -5, 7, 3],
                      "currency": ["INR", "INR", "GBP", "USD"]})
try:
    check_orders(today, expected_min_rows=100)
except DataQualityError as e:
    print("blocked load:", e)
```

Tools like Great Expectations, Soda, dbt tests and Delta Live Tables expectations package exactly these checks with reporting on top. Knowing how to write them by hand means you understand what those tools do.

## Common mistakes

- Tests that need a real database or API, so nobody runs them.
- Only testing the happy path.
- Comparing floats with `==` (use `pytest.approx` or `round`).
- Treating unit tests as a substitute for data checks, or the other way round.
- Data checks that log a warning and carry on loading anyway.

## In the interview

- *"How do you test a data pipeline?"* Unit tests on pure transformation functions with small fixtures and edge cases, run in CI; integration tests on a small sample end to end; data quality checks (row counts, nulls, uniqueness, ranges, freshness) on every production run that block the load and alert.
- *"What would you test in a dedupe function?"* Empty input, no duplicates, duplicates with different timestamps, ties, and null keys.

```quiz
What's the difference between a unit test and a data quality check?
* Unit tests check code with hand-made inputs in CI; data checks check real data on every run
- They are the same thing
- Data checks only run in CI
> Good code still breaks on bad input, so you need both.
---
Which function is easiest to unit test?
- One that reads from S3 and writes to Postgres
* One that takes rows and returns transformed rows
- One that prints its result
> Pure functions need no setup: give input, compare output.
---
A data check finds duplicate order ids. What should the pipeline do?
- Log a warning and load anyway
* Stop the load and alert, or quarantine the bad rows
- Delete the table
> Checks that don't block are just decoration.
```

```practice
py 34
py 35
```
