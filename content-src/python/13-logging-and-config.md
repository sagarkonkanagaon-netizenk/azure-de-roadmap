# Logging and configuration

By the end of this chapter your pipeline tells you what it did, when, and why it failed, and its settings live outside the code so the same script runs in dev and prod.

## Why print() is not enough

`print` has no level, no timestamp, no idea which module spoke, and you can't turn it down in production. The `logging` module gives you all of that from the standard library.

```python
import logging, sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,                    # replace any earlier setup (handy in notebooks)
)
log = logging.getLogger("orders_etl")

log.debug("not shown: below INFO")
log.info("extract started, source=%s", "s3://raw/orders/2025-12-03")
log.warning("3 rows had a null customer_id, sent to quarantine")
log.error("load failed: %s", "warehouse timeout")
```

Use one logger per module with `logging.getLogger(__name__)`. Pass values as arguments (`"%s", value`) rather than f-strings, so the string is only built when the message is actually emitted.

## Levels, and what goes where

| Level | Use it for |
|---|---|
| DEBUG | Row-level detail you only want while fixing something |
| INFO | Step started or finished, row counts, file names |
| WARNING | Something odd but handled: quarantined rows, a retry |
| ERROR | A step failed |
| CRITICAL | The whole job can't continue |

A good pipeline log reads like a story: what came in, what was dropped and why, what went out.

## Logging exceptions with the traceback

Inside an `except`, `log.exception` logs at ERROR and attaches the traceback for you.

```python
def parse_amount(raw):
    return float(raw)

for raw in ["12.5", "abc", "7"]:
    try:
        parse_amount(raw)
    except ValueError:
        log.exception("bad amount %r", raw)
```

## Structured (JSON) logs

Log platforms such as Datadog, CloudWatch or Azure Monitor search JSON far better than free text. A small formatter turns every record into one JSON line:

```python
import json, time

class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update(getattr(record, "ctx", {}))      # extra fields
        return json.dumps(payload)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
jlog = logging.getLogger("orders_etl.json")
jlog.handlers = [handler]
jlog.propagate = False                                  # don't print twice
jlog.setLevel(logging.INFO)

jlog.info("load finished", extra={"ctx": {"run_id": "r-481", "rows": 12_408, "table": "silver.orders"}})
```

Now you can search "every run where rows was 0" instead of grepping text.

## Configuration: keep settings out of the code

Hard-coded paths and passwords are the classic beginner smell. Settings usually come from three places, in this order of priority:

1. Environment variables (secrets, and anything that differs per environment)
2. A config file in the repo (defaults that rarely change)
3. Defaults in the code

```python
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    env: str
    source_path: str
    batch_size: int
    db_password: str | None

def load_settings(file_cfg: dict) -> Settings:
    env = os.environ.get("APP_ENV", "dev")
    cfg = {**file_cfg.get("default", {}), **file_cfg.get(env, {})}
    return Settings(
        env=env,
        source_path=os.environ.get("SOURCE_PATH", cfg["source_path"]),
        batch_size=int(os.environ.get("BATCH_SIZE", cfg.get("batch_size", 1000))),
        db_password=os.environ.get("DB_PASSWORD"),          # never in the file
    )

file_cfg = {                                   # what you'd read from config.toml
    "default": {"source_path": "data/raw", "batch_size": 500},
    "prod":    {"source_path": "s3://raw/orders"},
}

print(load_settings(file_cfg))
os.environ["APP_ENV"] = "prod"
os.environ["BATCH_SIZE"] = "5000"
print(load_settings(file_cfg))
```

Note `int(...)`: environment variables are always strings. Forgetting to convert them is a common bug.

### Reading a TOML file

Python 3.11+ ships `tomllib`, so a config file needs no extra package.

```python
import tomllib

text = """
[default]
source_path = "data/raw"
batch_size = 500

[prod]
source_path = "s3://raw/orders"
"""
with open("config.toml", "w") as f:
    f.write(text)

with open("config.toml", "rb") as f:          # tomllib wants bytes
    file_cfg = tomllib.load(f)
print(file_cfg["prod"])
```

### Fail fast on bad config

Check settings once at start-up, not halfway through a three-hour job.

```python
def validate(s: Settings):
    problems = []
    if s.batch_size <= 0:
        problems.append("batch_size must be positive")
    if s.env == "prod" and not s.db_password:
        problems.append("DB_PASSWORD is required in prod")
    if problems:
        raise SystemExit("config error: " + "; ".join(problems))

try:
    validate(load_settings(file_cfg))
except SystemExit as e:
    print(e)
```

## Common mistakes

- `print` in production code, so nothing has a level or timestamp.
- Building log messages with f-strings at DEBUG level in a hot loop.
- Logging secrets, full rows with personal data, or tokens.
- Treating `os.environ["X"]` as an int without converting it.
- Passwords in a committed config file. Use environment variables or a secrets manager.
- Calling `basicConfig` in a library module. Only the entry-point script configures logging.

## In the interview

- *"How do you make a pipeline observable?"* Structured logs with a run id, row counts in and out per step, warnings for quarantined data, errors with tracebacks, and metrics or alerts on top of those logs.
- *"How do you handle config across dev, test and prod?"* One code base, settings from environment variables layered over a config file, secrets from a secrets manager, validated at start-up.

```quiz
Inside an except block, which call logs the error together with its traceback?
- log.info(e)
* log.exception("message")
- print(traceback)
> log.exception logs at ERROR level and attaches the current traceback.
---
os.environ.get("BATCH_SIZE") returns "5000". What type is that?
- int
* str
- float
> Environment variables are always strings, so convert them.
---
Where should a database password live?
- In config.toml committed to git
- Hard-coded as a default
* In an environment variable or secrets manager
> Anything in git is effectively public to everyone with repo access, forever.
```

```practice
py 21
py 36
```
