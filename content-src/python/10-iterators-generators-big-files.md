# Generators and processing big files

By the end of this chapter you process data that doesn't fit in memory: stream records with generators, batch them for loading, and build lazy pipelines that read, clean and write in one pass using almost no RAM.

## Lists hold everything; generators hold one thing

A list comprehension builds every element at once. A **generator** produces one element at a time, only when asked.

```python
import sys

squares_list = [n * n for n in range(1_000_000)]
squares_gen = (n * n for n in range(1_000_000))      # round brackets: a generator expression

print(f"list: {sys.getsizeof(squares_list):,} bytes")
print(f"generator: {sys.getsizeof(squares_gen):,} bytes")
print(sum(squares_gen))
```

The generator is a couple of hundred bytes, whatever its length. The trade-off: you can loop over it only once.

```python
g = (x for x in [1, 2, 3])
print(list(g), list(g))     # the second list is empty: g is used up
```

## Writing a generator function with yield

Any function with `yield` becomes a generator. It pauses at each `yield` and continues from there next time.

```python
def read_records(path):
    """Yield one cleaned dict per line, skipping blanks and comments."""
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            order_id, city, amount = line.split("|")
            yield {"order_id": int(order_id), "city": city, "amount": float(amount)}

from pathlib import Path
Path("data").mkdir(exist_ok=True)
Path("data/orders.psv").write_text("# id|city|amount\n1|Pune|250\n\n2|Goa|1200\n3|Pune|80\n", encoding="utf-8")

for rec in read_records("data/orders.psv"):
    print(rec)
```

The file stays open only while you are iterating, and the `with` block closes it when the generator finishes.

## Lazy pipelines: chain generators

Each stage takes an iterable and yields results. Nothing runs until the last stage pulls data through.

```python
def only_valid(records):
    for r in records:
        if r["amount"] > 0:
            yield r

def add_gst(records, rate=0.18):
    for r in records:
        yield {**r, "amount_with_gst": round(r["amount"] * (1 + rate), 2)}

pipeline = add_gst(only_valid(read_records("data/orders.psv")))
print(pipeline)          # nothing has run yet
print(list(pipeline))
```

This is exactly how Spark thinks: transformations are lazy, and an action like `count()` or `write` triggers the work.

## Generate a big file, then aggregate it in constant memory

Let's write half a million lines, then total revenue per city while holding only one line at a time.

```python
import random, time
random.seed(7)

cities = ["Pune", "Goa", "Delhi", "Mumbai", "Chennai"]
t = time.perf_counter()
with open("data/big_orders.psv", "w", encoding="utf-8") as fh:
    for i in range(1, 500_001):
        fh.write(f"{i}|{random.choice(cities)}|{random.randint(50, 5000)}\n")
print(f"wrote 500k rows in {time.perf_counter() - t:.1f}s, {Path('data/big_orders.psv').stat().st_size / 1e6:.0f} MB")
```

```python
from collections import Counter

t = time.perf_counter()
revenue = Counter()
for rec in read_records("data/big_orders.psv"):
    revenue[rec["city"]] += rec["amount"]
print({c: f"{v:,.0f}" for c, v in revenue.most_common()})
print(f"aggregated in {time.perf_counter() - t:.1f}s")
```

Memory use stays flat no matter how big the file gets. This is the answer to "count records per key in a 50 GB file on an 8 GB machine".

## Batching for loads

Databases and APIs prefer batches: one insert of 1,000 rows is far faster than 1,000 inserts. `itertools.islice` takes the next *n* items from any iterator:

```python
from itertools import islice

def batched(iterable, size):
    it = iter(iterable)
    while batch := list(islice(it, size)):
        yield batch

for b in batched(range(1, 11), 4):
    print(b)
```

Python 3.12 added `itertools.batched`, which does the same and returns tuples. The version above works everywhere and shows the idea.

```python
loaded = 0
for batch in batched(read_records("data/big_orders.psv"), 50_000):
    loaded += len(batch)        # here you'd call executemany() or a bulk API
print(f"{loaded:,} rows loaded in {loaded // 50_000} batches")
```

## Useful itertools

```python
from itertools import chain, groupby, accumulate

print(list(chain([1, 2], [3], [4, 5])))                    # read several files as one stream
print(list(accumulate([100, 250, 50])))                    # running total

rows = sorted([("Pune", 10), ("Goa", 5), ("Pune", 7)], key=lambda r: r[0])
for city, group in groupby(rows, key=lambda r: r[0]):      # input must be sorted by the key
    print(city, sum(v for _, v in group))
```

`groupby` only groups *consecutive* equal keys, like a sorted-merge. Forgetting to sort first is a classic bug.

## Common mistakes

- `list(huge_generator)` "just to check", which loads everything.
- Looping over a used-up generator a second time and getting nothing.
- `groupby` on unsorted data.
- Opening a file in a generator and never finishing the loop. The file stays open until the generator is garbage collected; call `.close()` on it or loop to the end.

## In the interview

- *"Count records per key in a 50 GB log on an 8 GB machine."* Stream it line by line with a generator and keep a `Counter` of keys. If the number of distinct keys itself is too large, hash-partition into smaller files first, then count each.
- *"Generator vs list?"* A list stores all items and can be reused; a generator yields items lazily, uses constant memory and can be consumed once.
- *"How do you load 10 million rows into a database efficiently from Python?"* Stream and batch, use bulk APIs (`executemany`, `COPY`, or the warehouse's bulk loader), commit per batch, and make it restartable.

```quiz
What is printed by `g = (x for x in [1, 2]); print(list(g), list(g))`?
- [1, 2] [1, 2]
* [1, 2] []
- An error
> A generator can only be consumed once.
---
Why does `itertools.groupby` need sorted input?
* It only groups consecutive items with the same key
- It sorts internally but slowly
- It raises an error otherwise
> Unsorted input gives several separate groups for the same key.
---
Which approach totals revenue per city in a 50 GB file with 8 GB of RAM?
- Read the file with .read() and split lines
* Iterate line by line and add to a Counter
- Load it into a list of dicts first
> Streaming keeps one line in memory at a time.
```

```practice
py 22
py 25
py 27
py 37
```
