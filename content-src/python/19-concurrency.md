# Concurrency: threads, processes and asyncio

By the end of this chapter you know which of Python's three concurrency tools fits a job, can pull hundreds of API pages concurrently with a limit, and can explain the GIL without hand-waving.

## The one question that decides everything

Is the job **waiting** (network, disk, database) or **computing** (parsing, hashing, maths)?

| Job is mostly | Use | Why |
|---|---|---|
| Waiting on I/O, tens of tasks | `ThreadPoolExecutor` | Simple, works with normal libraries like `requests` |
| Waiting on I/O, hundreds or thousands | `asyncio` | One thread, tiny overhead per task |
| Computing in pure Python | `ProcessPoolExecutor` | Separate processes, each with its own GIL |
| Computing on big tables | pandas, Polars, DuckDB or Spark | They already run in fast compiled code |

## The GIL in two sentences

CPython's Global Interpreter Lock lets only one thread run Python bytecode at a time, so threads don't speed up pure-Python computation. But a thread waiting on the network releases the GIL, so threads *do* speed up I/O-bound work. (Python 3.13+ also has an optional free-threaded build without the GIL; most production code still runs with it.)

## asyncio: many waits at once

The examples below run in your browser. `await asyncio.sleep(...)` stands in for a network call.

```python
import asyncio, time, random

async def fetch_page(page: int) -> dict:
    await asyncio.sleep(random.uniform(0.05, 0.15))      # pretend network latency
    return {"page": page, "rows": 100}

t0 = time.perf_counter()
results = [await fetch_page(p) for p in range(1, 21)]     # one after another
print(f"sequential: {len(results)} pages in {time.perf_counter() - t0:.2f}s")

t0 = time.perf_counter()
results = await asyncio.gather(*(fetch_page(p) for p in range(1, 21)))   # all at once
print(f"concurrent: {len(results)} pages in {time.perf_counter() - t0:.2f}s")
```

Same work, roughly 10 to 20 times faster, because the waits overlap.

In a script you'd wrap this in `async def main(): ...` and call `asyncio.run(main())`. Here the page already runs an event loop, so `await` works at the top level, the same as in Jupyter.

## Limit concurrency, or get banned

Firing 1,000 requests at once will trip the API's rate limit. A `Semaphore` caps how many run at the same time.

```python
async def fetch_limited(page, sem, stats):
    async with sem:                                   # at most N inside at once
        stats["in_flight"] += 1
        stats["peak"] = max(stats["peak"], stats["in_flight"])
        try:
            return await fetch_page(page)
        finally:
            stats["in_flight"] -= 1

stats = {"in_flight": 0, "peak": 0}
sem = asyncio.Semaphore(8)
t0 = time.perf_counter()
pages = await asyncio.gather(*(fetch_limited(p, sem, stats) for p in range(1, 101)))
print(f"{len(pages)} pages in {time.perf_counter() - t0:.2f}s, peak concurrency {stats['peak']}")
```

## Errors and retries without losing the batch

By default one failed task makes `gather` raise. `return_exceptions=True` collects failures so you can retry just those.

```python
async def flaky(page):
    await asyncio.sleep(0.02)
    if random.random() < 0.2:
        raise ConnectionError(f"page {page} reset")
    return page

async def with_retry(page, attempts=4):
    for attempt in range(1, attempts + 1):
        try:
            return await flaky(page)
        except ConnectionError:
            if attempt == attempts:
                raise
            await asyncio.sleep(0.01 * 2 ** attempt)

results = await asyncio.gather(*(with_retry(p) for p in range(1, 51)), return_exceptions=True)
failed = [r for r in results if isinstance(r, Exception)]
print(f"ok={len(results) - len(failed)} failed={len(failed)}")
```

### Timeouts

```python
async def slow():
    await asyncio.sleep(2)

try:
    await asyncio.wait_for(slow(), timeout=0.1)
except TimeoutError:
    print("gave up after 0.1s")
```

## Never block the event loop

`time.sleep()`, `requests.get()` and heavy CPU work inside an `async def` freeze every other task, because asyncio is one thread. Use async libraries (`aiohttp`, `httpx.AsyncClient`, `asyncpg`), or push blocking calls to a thread:

```python norun
data = await asyncio.to_thread(requests.get, url, timeout=30)
```

## Threads for a handful of blocking calls

Threads and processes aren't available inside a browser tab, so these two examples are for reading. They run as-is on your machine.

```python norun
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

urls = [f"https://api.example.com/orders?page={p}" for p in range(1, 51)]

def get(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()

with ThreadPoolExecutor(max_workers=8) as pool:
    futures = {pool.submit(get, u): u for u in urls}
    for fut in as_completed(futures):
        try:
            data = fut.result()
        except Exception as e:
            print("failed", futures[fut], e)
```

## Processes for CPU-heavy Python

```python norun
from concurrent.futures import ProcessPoolExecutor
import hashlib

def hash_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return path, h.hexdigest()

if __name__ == "__main__":                    # required on Windows and macOS
    with ProcessPoolExecutor() as pool:        # one worker per CPU core
        for path, digest in pool.map(hash_file, paths, chunksize=16):
            print(path, digest)
```

Processes pay a start-up cost and must pickle arguments and results, so send them chunky work, not millions of tiny tasks.

## Common mistakes

- Threads for CPU-bound Python, then wondering why it isn't faster.
- `time.sleep` or `requests` inside `async def`.
- Unbounded `gather` over thousands of requests.
- Shared lists or dicts changed from many threads without a lock.
- Forgetting `if __name__ == "__main__":` with process pools.

## In the interview

- *"Explain the GIL."* Only one thread executes Python bytecode at a time, so threads help I/O-bound work (waits release the lock) but not CPU-bound Python. Use processes or compiled libraries for CPU work.
- *"You need to pull 5,000 API pages. How?"* asyncio with an async HTTP client and a semaphore sized to the API's rate limit, retries with backoff, timeouts, and results written in batches; or a thread pool if the client library is synchronous.
- *"Threads vs processes vs asyncio?"* Threads: few blocking I/O calls. asyncio: many concurrent I/O tasks. Processes: CPU-heavy pure Python.

```quiz
You need to parse 2,000 big JSON files with pure-Python code. Which helps most?
- ThreadPoolExecutor
* ProcessPoolExecutor
- asyncio.gather
> Parsing is CPU work, and the GIL stops threads from running Python in parallel.
---
What does an asyncio.Semaphore(8) do?
* Lets at most 8 tasks run the protected block at once
- Runs 8 event loops
- Retries 8 times
> It's how you respect an API's rate limit while still overlapping waits.
---
What's wrong with calling time.sleep(1) inside an async function?
- Nothing
* It blocks the whole event loop, so every task waits
- It raises an error
> Use await asyncio.sleep(1), which lets other tasks run meanwhile.
```

```practice
py 21
py 25
```
