# Deep dive: async ingestion at scale

By the end of this deep dive you can design and build an ingestion job that pulls thousands of API pages concurrently while respecting rate limits, retrying safely, applying backpressure, writing in batches, and resuming exactly where it stopped after a crash. This is the job behind "we ingest 40 SaaS APIs every hour", and the design interviewers probe hardest.

## The mental model: one waiter, many tables

asyncio runs on **one thread** with an **event loop**. Think of a single waiter in a restaurant: they take an order, and instead of standing at the kitchen until the food is ready, they move to the next table. Every `await` is the waiter saying "I'll come back when this is ready".

That gives you three rules that explain every asyncio bug:

1. **Work only overlaps at `await` points.** Code between awaits runs without interruption.
2. **Anything that blocks without `await` blocks everyone.** `time.sleep`, `requests.get`, a heavy CPU loop: the waiter is stuck in the kitchen.
3. **A coroutine does nothing until it's awaited or scheduled.** Calling `fetch()` just creates a coroutine object.

```python
import asyncio, time

async def fetch(page):
    await asyncio.sleep(0.1)          # stand-in for a 100 ms API call
    return page

coro = fetch(1)
print("calling fetch() gives:", type(coro).__name__, "- nothing has run yet")
print("awaiting it gives:", await coro)

t0 = time.perf_counter()
pages = await asyncio.gather(*(fetch(p) for p in range(50)))
print(f"50 calls of 100 ms each finished in {time.perf_counter() - t0:.2f}s")

def blocking_cpu(n):                  # pure Python work, no await inside
    return sum(i * i for i in range(n))

async def bad_neighbour():
    blocking_cpu(3_000_000)           # holds the loop the whole time

t0 = time.perf_counter()
await asyncio.gather(bad_neighbour(), *(fetch(p) for p in range(50)))
print(f"same 50 calls next to one blocking task: {time.perf_counter() - t0:.2f}s")
```

Fifty 100 ms waits overlap into roughly 0.1 s. Put one blocking task next to them and everyone waits for it. The rest of this deep dive builds a production ingester on top of these rules.

```locked
A realistic fake API
Step 1: naive gather, and why it fails
Step 2: a token bucket that respects the limit
Step 3: retries that classify errors
Step 4: producer, workers and a bounded queue (backpressure)
Step 5: batch the writes, and checkpoint after each batch
Step 6: the full ingester, with resume
Real code: aiohttp
Cursor pagination: when you can't fan out
Choosing the numbers
Interview questions, with model answers
```
