# Deep dive: build your own mini ingestion framework

By the end of this deep dive you'll have built a small, config-driven ingestion framework of the kind platform teams run in production: pipelines declared in config instead of copy-pasted scripts, pluggable sources and sinks, saved watermarks, schema checks, structured logs, run metrics and alerts, all covered by tests. It's the project that makes an interviewer say "so you've worked on a platform team".

## Why teams build frameworks

The first ten pipelines get written as scripts. By pipeline thirty, every script has its own retry logic, its own logging format, its own way of storing the last-loaded timestamp, and a bug fixed in one is still live in the other twenty-nine.

A framework flips it around. Engineers write a few lines of **config** for each new feed, and the shared, tested **engine** does the rest:

```python
PIPELINES = {
    "orders": {
        "source": {"type": "fake_api", "endpoint": "orders", "page_size": 50},
        "incremental": {"column": "updated_at"},
        "schema": {"order_id": "int", "customer_id": "str", "amount": "float", "updated_at": "str"},
        "primary_key": "order_id",
        "sink": {"type": "sqlite", "table": "raw_orders"},
        "alerts": {"min_rows": 1, "max_reject_ratio": 0.05},
    },
    "customers": {
        "source": {"type": "csv_text", "name": "customers"},
        "schema": {"customer_id": "str", "name": "str", "city": "str"},
        "primary_key": "customer_id",
        "sink": {"type": "sqlite", "table": "raw_customers"},
        "alerts": {"min_rows": 1, "max_reject_ratio": 0.2},
    },
}
for name, cfg in PIPELINES.items():
    print(f"{name:<10} {cfg['source']['type']:>9} -> {cfg['sink']['type']}.{cfg['sink']['table']}")
```

Adding feed number thirty-one becomes a reviewed config change, not a new script. In real life this lives in YAML files in the repo, one per pipeline.

The design has five parts, and the rest of this deep dive builds each one:

| Part | Job |
|---|---|
| **Registry** | Maps `"type": "fake_api"` to the class that implements it |
| **Sources** | Yield batches of records, given a watermark |
| **Sinks** | Write batches idempotently |
| **State store** | Remembers each pipeline's watermark between runs |
| **Engine** | Runs a pipeline: extract, validate, load, checkpoint, log, alert |

```locked
Part 1: the plugin registry
Part 2: the interfaces
Part 3: two sources and a sink
Part 4: schema validation with reasons
Part 5: state store and metrics
Part 6: logging and alerts
Part 7: the engine
Part 8: incremental runs, re-runs and failures
Part 9: tests for the framework
Part 10: from mini to production
Interview questions, with model answers
```
