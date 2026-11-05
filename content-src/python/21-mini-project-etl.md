# Mini project: an end-to-end ETL you can explain in an interview

By the end of this chapter you'll have built a complete, small but production-shaped pipeline: it pulls paginated orders from an API, lands the raw JSON, cleans and validates it, quarantines bad rows, upserts into a warehouse table, and can be re-run for any day without creating duplicates. Run the blocks in order.

This is the project to describe when an interviewer says *"walk me through a pipeline you built"*.

## The brief

A food delivery app exposes `/orders?date=YYYY-MM-DD` with cursor pagination. Every morning we need yesterday's orders in a `fact_orders` table plus a daily revenue summary per city. The API is flaky, the data is messy, and the job will sometimes be re-run.

## Step 0: the setup and a fake source

```python
import json, logging, random, sqlite3, sys, time
from dataclasses import dataclass
from pathlib import Path
import pandas as pd

logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True,
                    format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("orders")

@dataclass(frozen=True)
class Config:
    landing_dir: Path = Path("landing/orders")
    db_path: str = "warehouse.db"
    page_size: int = 40
    max_retries: int = 4
    max_bad_ratio: float = 0.10          # fail the run if more than 10% of rows are bad

CFG = Config()

# A fake API that behaves like a real one: pages, the odd 503, messy fields.
def _make_day(day: str, n=130, seed=0):
    rnd = random.Random(f"{day}-{seed}")
    cities = ["Pune", "pune ", "Mumbai", "Delhi", "Bengaluru"]
    rows = []
    for i in range(n):
        rows.append({
            "order_id": f"{day.replace('-', '')}-{i:04d}",
            "customer": {"id": f"c{rnd.randint(1, 60)}", "city": rnd.choice(cities)},
            "items": [{"sku": f"s{rnd.randint(1, 9)}", "qty": rnd.randint(1, 3),
                       "price": rnd.choice([99, 149, 249, 399])} for _ in range(rnd.randint(1, 3))],
            "status": rnd.choice(["DELIVERED"] * 8 + ["CANCELLED", "delivered"]),
            "placed_at": f"{day}T{rnd.randint(0, 23):02d}:{rnd.randint(0, 59):02d}:00+05:30",
        })
    rows[5]["customer"]["id"] = None                 # bad: no customer
    rows[9]["items"] = []                            # bad: no items
    rows.append(dict(rows[20]))                      # duplicate delivery
    return rows

def fake_api(date: str, cursor: int | None):
    if random.random() < 0.15:
        return 503, None
    data = _make_day(date)
    start = cursor or 0
    page = data[start:start + CFG.page_size]
    nxt = start + len(page)
    return 200, {"data": page, "next_cursor": nxt if nxt < len(data) else None}

print(json.dumps(_make_day("2025-12-03")[0], indent=2))   # one raw order
```

## Step 1: extract with retries, land the raw data

Land exactly what the API returned before touching it. If the transform has a bug, you can re-run from the raw files without calling the API again.

```python
def call_with_retry(date, cursor):
    for attempt in range(1, CFG.max_retries + 1):
        status, body = fake_api(date, cursor)
        if status == 200:
            return body
        wait = 0.02 * 2 ** attempt
        log.warning("HTTP %s on cursor=%s, retry %d in %.2fs", status, cursor, attempt, wait)
        time.sleep(wait)
    raise RuntimeError(f"API failed after {CFG.max_retries} attempts")

def extract(run_date: str) -> Path:
    rows, cursor, pages = [], None, 0
    while True:
        body = call_with_retry(run_date, cursor)
        rows.extend(body["data"]); pages += 1
        cursor = body["next_cursor"]
        if cursor is None:
            break
    out = CFG.landing_dir / f"date={run_date}" / "orders.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")                  # write then rename: no half files
    with tmp.open("w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    tmp.replace(out)
    log.info("extract: %d rows from %d pages -> %s", len(rows), pages, out)
    return out

raw_path = extract("2025-12-03")
```

## Step 2: transform, flatten and clean

```python
def transform(raw_path: Path, run_date: str):
    records = [json.loads(line) for line in raw_path.open()]
    df = pd.json_normalize(records, sep="_")
    df["order_value"] = df["items"].apply(lambda items: sum(i["qty"] * i["price"] for i in items))
    df["item_count"] = df["items"].apply(len)
    df = df.drop(columns="items").rename(columns={"customer_city": "city"})
    df["city"] = df["city"].str.strip().str.title()
    df["status"] = df["status"].str.upper()
    df["placed_at"] = pd.to_datetime(df["placed_at"], utc=True)
    df["run_date"] = run_date

    reasons = pd.DataFrame({
        "no_customer": df["customer_id"].isna(),
        "no_items": df["item_count"].eq(0),
        "wrong_day": df["placed_at"].dt.tz_convert("Asia/Kolkata").dt.strftime("%Y-%m-%d").ne(run_date),
    })
    df["reject_reason"] = reasons.apply(lambda r: ",".join(r.index[r]), axis=1)
    bad = df[df["reject_reason"] != ""]
    good = (df[df["reject_reason"] == ""]
            .drop(columns="reject_reason")
            .drop_duplicates("order_id", keep="last"))
    log.info("transform: %d good, %d quarantined, %d duplicates removed",
             len(good), len(bad), len(df) - len(bad) - len(good))
    return good, bad

good, bad = transform(raw_path, "2025-12-03")
bad[["order_id", "customer_id", "item_count", "reject_reason"]]
```

## Step 3: quality gate

Stop the run before bad data reaches dashboards.

```python
class QualityError(Exception):
    pass

def quality_gate(good: pd.DataFrame, bad: pd.DataFrame):
    total = len(good) + len(bad)
    ratio = len(bad) / total if total else 1
    checks = {
        "has_rows": len(good) > 0,
        "unique_ids": good["order_id"].is_unique,
        "non_negative": (good["order_value"] >= 0).all(),
        "bad_ratio_ok": ratio <= CFG.max_bad_ratio,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise QualityError(f"failed checks: {failed} (bad ratio {ratio:.1%})")
    log.info("quality: all %d checks passed, bad ratio %.1f%%", len(checks), ratio * 100)

quality_gate(good, bad)
```

## Step 4: load idempotently

Delete-and-insert the day inside one transaction. Re-running the same day replaces it instead of doubling it, and a failure leaves the old data untouched.

```python
DDL = """
CREATE TABLE IF NOT EXISTS fact_orders (
    order_id TEXT PRIMARY KEY, run_date TEXT NOT NULL, customer_id TEXT NOT NULL,
    city TEXT, status TEXT, placed_at TEXT, order_value REAL, item_count INTEGER);
CREATE TABLE IF NOT EXISTS quarantine_orders (
    order_id TEXT, run_date TEXT, reject_reason TEXT, payload TEXT);
CREATE TABLE IF NOT EXISTS daily_city_revenue (
    run_date TEXT, city TEXT, orders INTEGER, revenue REAL, PRIMARY KEY (run_date, city));
"""

def load(good, bad, run_date):
    cols = ["order_id", "run_date", "customer_id", "city", "status", "placed_at", "order_value", "item_count"]
    rows = good.assign(placed_at=good["placed_at"].astype(str))[cols].itertuples(index=False, name=None)
    summary = (good[good["status"] == "DELIVERED"]
               .groupby("city", as_index=False)
               .agg(orders=("order_id", "count"), revenue=("order_value", "sum")))
    with sqlite3.connect(CFG.db_path) as conn:          # commits on success, rolls back on error
        conn.executescript(DDL)
        for table in ("fact_orders", "quarantine_orders", "daily_city_revenue"):
            conn.execute(f"DELETE FROM {table} WHERE run_date = ?", (run_date,))   # fixed names only
        conn.executemany(f"INSERT INTO fact_orders VALUES ({','.join('?' * len(cols))})", rows)
        conn.executemany("INSERT INTO quarantine_orders VALUES (?, ?, ?, ?)",
                         [(r["order_id"], run_date, r["reject_reason"], r.to_json(date_format="iso"))
                          for _, r in bad.iterrows()])
        conn.executemany("INSERT INTO daily_city_revenue VALUES (?, ?, ?, ?)",
                         [(run_date, r.city, r.orders, r.revenue) for r in summary.itertuples()])
    log.info("load: %d facts, %d quarantined, %d summary rows", len(good), len(bad), len(summary))

load(good, bad, "2025-12-03")
```

## Step 5: the orchestrator

One function, one run date, a clear log, a non-zero result on failure.

```python
def run(run_date: str) -> int:
    t0 = time.perf_counter()
    log.info("=== run %s started ===", run_date)
    try:
        raw = extract(run_date)
        good, bad = transform(raw, run_date)
        quality_gate(good, bad)
        load(good, bad, run_date)
    except Exception:
        log.exception("run %s FAILED", run_date)
        return 1
    log.info("=== run %s finished in %.2fs ===", run_date, time.perf_counter() - t0)
    return 0

for day in ["2025-12-03", "2025-12-03", "2025-12-04"]:   # note the re-run of the 3rd
    run(day)
```

## Step 6: prove it's idempotent

```python
with sqlite3.connect(CFG.db_path) as conn:
    print(pd.read_sql_query("SELECT run_date, count(*) AS facts, count(DISTINCT order_id) AS unique_ids "
                            "FROM fact_orders GROUP BY run_date", conn), "\n")
    print(pd.read_sql_query("SELECT * FROM daily_city_revenue ORDER BY run_date, revenue DESC", conn))
```

The 3rd was loaded twice, yet facts equal unique ids and the count matches the single run. That is the property you want from every production pipeline.

## How to talk about it

Use this structure in an interview, in about two minutes:

1. **Problem**: daily orders from a flaky, paginated API into a warehouse fact table and a revenue summary.
2. **Extract**: cursor pagination with retries and backoff, raw JSON landed per date with an atomic write, so transforms can be replayed without hitting the API.
3. **Transform**: flatten nested JSON, normalise city and status, convert time zones, derive order value, dedupe on `order_id`.
4. **Quality**: rule-based quarantine with reasons, and a gate that fails the run if bad rows exceed 10%.
5. **Load**: delete-and-insert per run date in one transaction, so re-runs and backfills are safe.
6. **Operations**: run date parameter, structured logs with counts per step, non-zero exit on failure for the scheduler.
7. **What I'd do at scale**: Parquet or Delta instead of JSON lines, Spark or DuckDB for the transform, Airflow for scheduling and alerting, `MERGE` instead of delete-and-insert, and metrics on row counts and bad ratios.

## Make it yours

Extensions that turn this into a portfolio project:

- Add a `--run-date` CLI from chapter 20 and a backfill loop over a date range.
- Write the clean data to Parquet partitioned by date.
- Add pytest tests for `transform` using a 5-row fixture.
- Track the watermark from chapter 14 instead of a fixed date.
- Swap SQLite for a free Postgres or a Databricks Free Edition table.

```quiz
Why land the raw API response before transforming it?
* So a transform bug can be fixed and replayed without calling the API again
- Because JSON is faster than pandas
- It isn't needed
> Raw landing is your safety net, and the start of every medallion architecture.
---
How does this pipeline stay correct when the same day is run twice?
- It checks if the job already ran and skips
* It deletes that run date and inserts again, in one transaction
- It uses INSERT only
> Delete-and-insert per partition, or MERGE, makes re-runs and backfills safe.
---
What does the quality gate do when more than 10% of rows are bad?
- Drops the bad rows and continues
* Fails the run so nothing bad is loaded and someone gets alerted
- Loads everything
> A pipeline that loads garbage quietly is worse than one that stops loudly.
```

```practice
py 34
py 37
```
