# Functions that a team can reuse

By the end of this chapter you write small, testable functions with clear inputs and outputs, avoid the mutable-default trap, and use `*args`, `**kwargs`, type hints and `key=` functions the way production code does.

## Why functions matter in pipelines

A transform you can call with sample data is a transform you can test. The goal is functions that take data in, return data out, and don't secretly change anything else. These are called *pure* functions, and they make pipelines easy to debug.

```python
def add_gst(amount: float, rate: float = 0.18) -> float:
    """Return the amount including GST, rounded to 2 decimals."""
    return round(amount * (1 + rate), 2)

print(add_gst(1000))
print(add_gst(1000, rate=0.05))
```

The `: float` and `-> float` parts are **type hints**. Python doesn't enforce them at runtime, but your editor and tools like `mypy` use them to catch mistakes, and they document the function for the next person.

## Arguments: positional, keyword, defaults

```python
def load(table, rows, *, mode="append", batch_size=500):
    return f"{mode} {len(rows)} rows into {table} in batches of {batch_size}"

print(load("orders", [1, 2, 3]))
print(load("orders", [1, 2, 3], mode="overwrite"))
```

The bare `*` means everything after it must be passed by name. Use it for flags like `mode`: `load("orders", rows, "overwrite")` would be unclear, so the function forbids it.

## The mutable default trap

This is the most famous Python bug, and it is asked in interviews constantly.

```python
def add_tag(tag, tags=[]):        # the list is created ONCE, when the function is defined
    tags.append(tag)
    return tags

print(add_tag("a"))
print(add_tag("b"))               # surprise: the same list again
```

The fix is to default to `None` and create the list inside:

```python
def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags

print(add_tag("a"), add_tag("b"))
```

## `*args` and `**kwargs`

`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra named ones into a dict. You'll see them in wrappers and decorators.

```python
def log_event(event, *args, **kwargs):
    print(event, args, kwargs)

log_event("load_done", "orders", 1200, duration_s=3.2, ok=True)

params = {"duration_s": 1.1, "ok": False}
log_event("load_failed", **params)        # unpack a dict into keyword arguments
```

## Returning several values

A function can return a tuple, and the caller unpacks it:

```python
def split_valid(rows):
    good = [r for r in rows if r.get("amount", 0) > 0]
    bad = [r for r in rows if r.get("amount", 0) <= 0]
    return good, bad

good, bad = split_valid([{"amount": 5}, {"amount": -1}, {}])
print(len(good), "good,", len(bad), "bad")
```

## Functions are values: `key=` and lambdas

You can pass a function to another function. Sorting and grouping use this all the time.

```python
orders = [
    {"id": 1, "city": "Pune", "amount": 300},
    {"id": 2, "city": "Goa", "amount": 1200},
    {"id": 3, "city": "Pune", "amount": 800},
]
by_amount = sorted(orders, key=lambda o: o["amount"], reverse=True)
print([o["id"] for o in by_amount])

# sort by city, then by amount descending
print([o["id"] for o in sorted(orders, key=lambda o: (o["city"], -o["amount"]))])
print(max(orders, key=lambda o: o["amount"])["id"])
```

A `lambda` is a one-line unnamed function. If it needs more than one expression, write a normal `def`.

## Scope: where names live

A name assigned inside a function is local to it. Reading an outer name works; assigning to it creates a new local. Pass values in and return them out rather than relying on globals.

```python
RATE = 0.18                # a constant, fine to read anywhere

def total(amount):
    return amount * (1 + RATE)

counter = 0
def bump():
    global counter         # possible, but a smell in pipeline code
    counter += 1

bump(); bump()
print(total(100), counter)
```

## Small functions compose

Here is a cleaning step built from three tiny, testable functions:

```python
def strip_all(row):
    return {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}

def normalise_city(row):
    return {**row, "city": row["city"].title() if row.get("city") else "Unknown"}

def to_paise(row):
    return {**row, "amount_paise": round(float(row["amount"]) * 100)}

def clean(row):
    for step in (strip_all, normalise_city, to_paise):
        row = step(row)
    return row

clean({"city": "  navi mumbai ", "amount": " 12.5 "})
```

Each step returns a new dict with `{**row, ...}` instead of changing the input. If a step fails, the original row is still intact for the error report.

## Common mistakes

- Mutable defaults like `def f(x=[])` or `def f(cfg={})`.
- Functions that both change their input and return it. Pick one, preferably return a new value.
- Long functions that read files, transform and write. Split I/O from logic so the logic can be tested.
- Using `global` to pass data around.

## In the interview

- *"What's wrong with `def f(items=[])`?"* The default list is created once and shared between calls. Use `None` and create it inside.
- *"What are `*args` and `**kwargs`?"* Extra positional arguments as a tuple and extra keyword arguments as a dict. Used for wrappers and flexible APIs.
- *"What is a pure function and why do data engineers care?"* Same input, same output, no side effects. It can be unit tested with sample data and re-run safely.

```quiz
What does `add_tag("b")` return after `add_tag("a")` if the function is `def add_tag(t, tags=[]): tags.append(t); return tags`?
- ['b']
* ['a', 'b']
- An error
> The default list is created once when the function is defined and is shared across calls.
---
In `def load(table, rows, *, mode="append")`, what does the bare `*` do?
* Forces `mode` to be passed by name
- Collects extra positional arguments
- Makes `mode` required
> Everything after a bare `*` is keyword-only.
---
How do you sort a list of dicts by amount, largest first?
- sorted(orders, reverse=True)
* sorted(orders, key=lambda o: o["amount"], reverse=True)
- orders.sort("amount")
> `key=` tells sort what to compare. Dicts themselves can't be compared.
```

```practice
py 21
py 30
py 35
```
