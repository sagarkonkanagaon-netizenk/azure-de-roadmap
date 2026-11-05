# Errors, exceptions and failing well

By the end of this chapter you handle errors on purpose: catch only what you expect, keep bad records with a reason, raise clear errors of your own, and retry the failures that are worth retrying.

## Reading a traceback

When something fails, Python prints a traceback. Read it **from the bottom**: the last line is the error type and message, and the line above it is where it happened.

```python
def parse_amount(s):
    return float(s)

try:
    parse_amount("₹1,200")
except ValueError as e:
    print(type(e).__name__, "->", e)
```

## try, except, else, finally

```python
def safe_divide(a, b):
    try:
        result = a / b
    except ZeroDivisionError:
        print("b was zero, returning None")
        return None
    else:                      # runs only if nothing failed
        print("ok")
        return result
    finally:                   # always runs: close files, release locks, log timing
        print("done", a, b)

safe_divide(10, 2)
safe_divide(1, 0)
```

## Catch narrowly

Catch only the errors you expect and know how to handle. A bare `except:` or `except Exception:` around everything hides real bugs, like a typo in a variable name.

```python
rows = [{"amount": "10"}, {"amount": "x"}, {}]
for r in rows:
    try:
        print(float(r["amount"]))
    except ValueError:
        print("not a number:", r)
    except KeyError:
        print("missing amount:", r)
```

## Keep bad records, don't lose them

The pipeline pattern: every row ends up in exactly one place, good or rejected, and rejected rows carry the reason.

```python
def validate(row):
    if not row.get("order_id"):
        raise ValueError("missing order_id")
    amount = float(row["amount"])          # may raise ValueError itself
    if amount < 0:
        raise ValueError(f"negative amount {amount}")
    return {"order_id": int(row["order_id"]), "amount": amount}

source = [
    {"order_id": "1", "amount": "250"},
    {"order_id": "",  "amount": "99"},
    {"order_id": "3", "amount": "-5"},
    {"order_id": "4", "amount": "abc"},
]
good, rejects = [], []
for i, row in enumerate(source, start=1):
    try:
        good.append(validate(row))
    except ValueError as e:
        rejects.append({"line": i, "row": row, "reason": str(e)})

print(f"{len(good)} good, {len(rejects)} rejected")
for r in rejects:
    print(r)
assert len(good) + len(rejects) == len(source)    # nothing silently lost
```

That last `assert` is a reconciliation check. Put one at the end of every load: rows in must equal rows out plus rows rejected.

## Raising your own errors

Raise early, with a message that tells the reader what to do.

```python
class DataContractError(Exception):
    """The source broke the agreed schema."""

def check_columns(header, required=("order_id", "amount", "order_ts")):
    missing = [c for c in required if c not in header]
    if missing:
        raise DataContractError(f"source file is missing columns {missing}; got {header}")

try:
    check_columns(["order_id", "amt", "order_ts"])
except DataContractError as e:
    print("stop the load:", e)
```

A custom exception lets callers treat "the source broke the contract" differently from "the network blipped".

## Chaining: keep the original cause

```python
def read_config(text):
    import json
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError("config file is not valid JSON") from e

try:
    read_config("{bad json")
except ValueError as e:
    print(e, "| caused by:", repr(e.__cause__))
```

`raise ... from e` keeps the low-level error attached, so the traceback shows both.

## Retry what is worth retrying

Network timeouts and rate limits are *transient*: trying again later usually works. Bad data is not; retrying won't fix it. Retry with exponential backoff and a cap:

```python
import random, time

class TransientError(Exception):
    pass

calls = {"n": 0}
def flaky_api():
    calls["n"] += 1
    if calls["n"] < 3:
        raise TransientError("503 Service Unavailable")
    return {"rows": 42}

def with_retry(fn, attempts=5, base=0.05):
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except TransientError as e:
            if attempt == attempts:
                raise
            wait = base * 2 ** (attempt - 1) * (1 + random.random() * 0.1)
            print(f"attempt {attempt} failed ({e}); retrying in {wait:.2f}s")
            time.sleep(wait)

with_retry(flaky_api)
```

The small random part, called *jitter*, stops many workers retrying at exactly the same moment. Chapter 12 turns this into a reusable decorator.

## Common mistakes

- `except:` or `except Exception:` around a whole job, which swallows real bugs.
- Logging an error and carrying on as if the row loaded.
- Retrying bad data. Only retry transient failures.
- Raising `Exception("error")` with no useful message.
- `return` inside `finally`, which silently cancels an exception.

## In the interview

- *"How do you handle bad records in a pipeline?"* Validate each row, route failures to a reject table or dead-letter queue with the reason and source line, reconcile counts at the end, and alert if the reject rate passes a threshold.
- *"Which errors do you retry?"* Transient ones: timeouts, 429 and 5xx responses, connection resets. Use exponential backoff with jitter and a maximum number of attempts. Never retry 4xx validation errors or bad data.
- *"What does `finally` do?"* Runs whether or not an exception happened. Use it, or a `with` block, to release resources.

```quiz
Where do you start reading a Python traceback?
* At the bottom: the error type and message, then the line above it
- At the top: the first function called
- In the middle
> The last line names the error, and the frame just above it is where it was raised.
---
Which failure should a pipeline retry?
- A row with amount "abc"
* An HTTP 503 from the source API
- A file missing a required column
> 503 is transient. Bad data and contract breaks will fail again on every retry.
---
What does `raise ValueError("...") from e` do?
- Ignores e
* Raises the new error and keeps e attached as its cause
- Re-raises e unchanged
> The traceback shows both errors, so you keep the low-level detail.
```

```practice
py 21
py 34
py 37
```
