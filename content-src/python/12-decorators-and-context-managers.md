# Decorators and context managers

By the end of this chapter you can read and write decorators for timing, retries and logging, and write context managers that always clean up, which covers two of the most asked Python interview questions for data engineers.

## Functions that wrap functions

A decorator is a function that takes a function and returns a new one that adds behaviour around it. `@timed` above a function is shorthand for `fn = timed(fn)`.

```python
import functools, time

def timed(fn):
    @functools.wraps(fn)                  # keep the original name and docstring
    def wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__} took {time.perf_counter() - t0:.4f}s")
    return wrapper

@timed
def transform(rows):
    """Square every value."""
    return [r * r for r in rows]

print(transform(list(range(100_000)))[-1])
print(transform.__name__, "-", transform.__doc__)
```

Without `functools.wraps`, every decorated function would be called `wrapper`, which makes logs and tracebacks useless.

## A retry decorator with arguments

To pass settings, add one more layer: a function that takes the settings and returns the decorator.

```python
import random

def retry(attempts=3, base_delay=0.05, on=(Exception,)):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except on as e:
                    if attempt == attempts:
                        raise
                    delay = base_delay * 2 ** (attempt - 1) + random.uniform(0, base_delay)
                    print(f"{fn.__name__}: attempt {attempt} failed with {e!r}, sleeping {delay:.2f}s")
                    time.sleep(delay)
        return wrapper
    return decorator

state = {"calls": 0}

@retry(attempts=4, on=(ConnectionError, TimeoutError))
def fetch_page(page):
    state["calls"] += 1
    if state["calls"] < 3:
        raise ConnectionError("connection reset")
    return {"page": page, "rows": 100}

print(fetch_page(1))
```

Note `on=`: the decorator retries only the errors you list. A `KeyError` from a bug passes straight through instead of being retried four times.

## Caching

`functools.lru_cache` remembers results for arguments it has seen. Great for slow, repeatable lookups such as fetching a currency rate for a day:

```python
@functools.lru_cache(maxsize=1024)
def fx_rate(day: str, currency: str) -> float:
    time.sleep(0.05)                    # pretend this calls an API
    return {"USD": 83.2, "EUR": 90.1}[currency]

t0 = time.perf_counter()
for _ in range(50):
    fx_rate("2025-12-03", "USD")
print(f"50 calls in {time.perf_counter() - t0:.2f}s;", fx_rate.cache_info())
```

Only cache pure functions whose answer can't change for the same inputs.

## Context managers: setup and guaranteed cleanup

You already use one: `with open(...)`. A context manager runs setup when the block starts and cleanup when it ends, even if the block raises.

The quickest way to write one is `contextlib.contextmanager`. Code before `yield` is setup, code after is cleanup:

```python
from contextlib import contextmanager

@contextmanager
def step(name):
    t0 = time.perf_counter()
    print(f"▶ {name}")
    try:
        yield
    except Exception as e:
        print(f"✖ {name} failed: {e}")
        raise
    finally:
        print(f"■ {name} finished in {time.perf_counter() - t0:.3f}s")

with step("extract"):
    data = list(range(10))

try:
    with step("load"):
        raise RuntimeError("warehouse unavailable")
except RuntimeError:
    pass
```

### A transaction-style context manager

Commit on success, roll back on any error. This is how database libraries implement `with conn:`.

```python
class FakeTable:
    def __init__(self):
        self.rows, self._pending = [], []

    @contextmanager
    def transaction(self):
        self._pending = []
        try:
            yield self._pending
            self.rows.extend(self._pending)      # commit
            print("committed", len(self._pending))
        except Exception as e:
            print("rolled back:", e)
            raise
        finally:
            self._pending = []

t = FakeTable()
with t.transaction() as tx:
    tx.extend([1, 2, 3])
try:
    with t.transaction() as tx:
        tx.append(4)
        raise ValueError("bad row")
except ValueError:
    pass
print("table:", t.rows)
```

The failed batch leaves no trace in the table. That is exactly the behaviour you want from a load step.

### The class form

A class with `__enter__` and `__exit__` does the same. Returning `True` from `__exit__` would swallow the exception, which you almost never want.

```python
class Timer:
    def __enter__(self):
        self.t0 = time.perf_counter()
        return self
    def __exit__(self, exc_type, exc, tb):
        self.seconds = time.perf_counter() - self.t0
        return False                       # don't hide errors

with Timer() as t:
    sum(range(1_000_000))
print(f"{t.seconds:.4f}s")
```

## Common mistakes

- Forgetting `functools.wraps`.
- A retry decorator that retries every exception, including your own bugs.
- `lru_cache` on a function whose result changes over time, such as "latest orders".
- Cleanup code after `yield` without `try/finally`, so it is skipped on error.
- Returning `True` from `__exit__` by accident and hiding exceptions.

## In the interview

- *"Write a retry decorator with exponential backoff."* Outer function takes settings, middle takes the function, inner wrapper loops over attempts, catches only listed exceptions, sleeps `base * 2 ** attempt` plus jitter, re-raises on the last attempt, and uses `functools.wraps`.
- *"Write a context manager that times a block."* Either `@contextmanager` with `try/yield/finally`, or a class with `__enter__` and `__exit__`.
- *"Where would you use a context manager in a pipeline?"* Files, DB connections and transactions, locks, temporary directories, and timing or logging around a step.

```quiz
What does functools.wraps do in a decorator?
* Copies the wrapped function's name and docstring onto the wrapper
- Makes the function run faster
- Adds retry behaviour
> Without it every decorated function shows up as "wrapper" in logs and tracebacks.
---
In a @contextmanager function, where does cleanup code go so it runs even if the block fails?
- Before yield
* In a finally after yield
- In a separate function
> Wrap yield in try/finally, or an exception skips the cleanup.
---
Which errors should a retry decorator retry?
- All exceptions
* Only the transient ones you list, like ConnectionError or TimeoutError
- Only KeyError
> Retrying your own bugs or bad data just fails slower.
```

```practice
py 21
py 29
py 36
```
