# Deep dive: the Python pipeline system design interview

By the end of this deep dive you have a repeatable way to answer any "design a pipeline" question, and ten fully worked model answers to the questions that come up most in data engineering interviews, each with the trade-offs interviewers listen for.

## How these rounds are scored

A design round is not graded on whether you name the "right" tool. Interviewers score four things:

1. **Requirements**: did you ask about volume, latency, sources, consumers and failure tolerance before designing?
2. **Structure**: is there a clear flow from source to consumer with each stage's job explained?
3. **Reliability**: idempotency, retries, late and duplicate data, backfills, monitoring.
4. **Trade-offs**: can you say what you'd give up, and when you'd choose differently?

## The 6-step answer framework

Use the same skeleton every time. Say the step names out loud so the interviewer can follow.

| Step | Time | What you say |
|---|---|---|
| 1. Clarify | 3–5 min | Volume now and in a year, freshness needed, sources and formats, who consumes it, what happens if data is late or wrong |
| 2. Sketch the flow | 3 min | Source → ingest → land raw → clean → model → serve, one sentence per box |
| 3. Deep dive the hard part | 10–15 min | The part with the real risk: scale, latency, correctness, or cost |
| 4. Data model | 3–5 min | Key tables, grain, partitioning, keys |
| 5. Reliability and operations | 5 min | Idempotency, retries, late data, backfill, data checks, alerts, SLAs |
| 6. Trade-offs and evolution | 2–3 min | What you'd change at 10x, what you chose not to build |

A useful size table to have in your head when you clarify:

| Scale | Fits on | Typical tools |
|---|---|---|
| Under ~10 GB a day | One machine | Python, pandas, DuckDB, Polars, Postgres |
| 10 GB to a few TB a day | A cluster or a warehouse | Spark, Databricks, Snowflake, BigQuery |
| Continuous events, seconds of latency | A stream | Kafka, Kinesis, Event Hubs, Spark Structured Streaming, Flink |

## Model answer 1: daily ingestion from a REST API into the warehouse

**Question.** *"Design a pipeline that loads orders from a partner's REST API into our warehouse every day."*

**Clarify.** About 500k orders a day, cursor-paginated, 100 per page, a limit of 10 requests per second, orders can be updated for 30 days, analysts need yesterday's data by 7 a.m.

**Flow.**
1. An orchestrator (Airflow) runs a daily task with the run date as a parameter.
2. A Python extractor walks the cursor with an `updated_since` filter equal to the last watermark minus a one-hour overlap, using a token bucket at 9 rps, retries with backoff for 429 and 5xx, and timeouts.
3. Raw JSON lands unchanged in object storage under `raw/orders/ingest_date=.../` in files of about 100 MB.
4. A transform step flattens, casts types, validates rules, quarantines bad rows with reasons, and dedupes on `order_id` keeping the latest `updated_at`.
5. A `MERGE` into `fact_orders` on `order_id`, guarded by `src.updated_at > tgt.updated_at`.
6. The watermark is saved only after the merge commits.

**Hard part: correctness of updates.** Because orders change for 30 days, an append-only load would duplicate rows; the merge on key with a recency guard makes every run idempotent and safe to retry. The overlap window catches rows whose timestamps tie the watermark.

**Operations.** Row counts per step in structured logs; checks for zero rows, duplicates and reject ratio; a freshness alert if `max(updated_at)` is more than 26 hours old; backfill by re-running past dates because nothing reads the clock.

**Trade-offs.** 5,000 pages at 9 rps is under 10 minutes, so a synchronous client is fine today; at 50x volume I'd switch to async workers and ask the partner for a bulk export or webhooks.

```locked
Model answer 2: process a 200 GB CSV every night on a budget
Model answer 3: deduplicate events that arrive more than once
Model answer 4: change data capture from Postgres into the lake
Model answer 5: near-real-time dashboard of orders per minute
Model answer 6: a pipeline that must never double-charge or double-count
Model answer 7: backfill two years of history without breaking production
Model answer 8: data quality framework for 200 tables
Model answer 9: an ingestion platform for 50 SaaS sources
Model answer 10: make a slow Python job ten times faster
Practice drill
```
