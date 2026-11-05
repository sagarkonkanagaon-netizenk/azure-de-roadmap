# Classes and dataclasses

By the end of this chapter you know when a class earns its place in pipeline code, model records with `@dataclass`, and write a small class that holds configuration and state for a job.

## When to write a class

Most transformation code is best as plain functions. A class helps when you have **data and behaviour that belong together and some state that lives across calls**: a database connection with a retry policy, a job that tracks its own metrics, a reader that remembers where it stopped.

## Dataclasses: records with less typing

`@dataclass` writes the boring parts (`__init__`, `__repr__`, `__eq__`) for you.

```python
from dataclasses import dataclass, field, asdict
from datetime import date

@dataclass
class Order:
    order_id: int
    city: str
    amount: float
    tags: list[str] = field(default_factory=list)   # never a bare [] default
    day: date = date(2025, 12, 3)

o = Order(1, "Pune", 250.0)
print(o)
print(o == Order(1, "Pune", 250.0))
print(asdict(o))
```

`field(default_factory=list)` is the dataclass version of the mutable-default fix from chapter 4.

## Validate on creation

`__post_init__` runs after the generated `__init__`. Put checks there, and a bad record can't even be created.

```python
@dataclass(frozen=True)          # frozen: fields can't be changed after creation
class Payment:
    payment_id: str
    amount_paise: int
    currency: str = "INR"

    def __post_init__(self):
        if self.amount_paise < 0:
            raise ValueError(f"{self.payment_id}: negative amount")
        if self.currency not in {"INR", "USD"}:
            raise ValueError(f"{self.payment_id}: unknown currency {self.currency}")

    @property
    def rupees(self) -> float:
        return self.amount_paise / 100

p = Payment("P1", 129950)
print(p.rupees)
try:
    Payment("P2", -5)
except ValueError as e:
    print("rejected:", e)
try:
    p.amount_paise = 1
except Exception as e:
    print(type(e).__name__, "- frozen records can't be edited")
```

Frozen dataclasses are hashable, so they can live in sets and be dict keys, which is handy for de-duplication.

## A small class with state

Here is a job that tracks its own counts, so the final log line and the reconciliation check come for free:

```python
import time

class LoadJob:
    def __init__(self, name: str, reject_limit: float = 0.05):
        self.name = name
        self.reject_limit = reject_limit
        self.read = self.loaded = self.rejected = 0
        self.errors: list[str] = []
        self._t0 = time.perf_counter()

    def process(self, rows, transform):
        for row in rows:
            self.read += 1
            try:
                transform(row)
                self.loaded += 1
            except (ValueError, KeyError) as e:
                self.rejected += 1
                self.errors.append(f"row {self.read}: {e}")
        return self

    def finish(self):
        took = time.perf_counter() - self._t0
        assert self.read == self.loaded + self.rejected, "rows went missing"
        rate = self.rejected / self.read if self.read else 0
        status = "FAILED" if rate > self.reject_limit else "OK"
        return f"[{status}] {self.name}: read={self.read} loaded={self.loaded} rejected={self.rejected} ({rate:.0%}) in {took:.3f}s"

    def __repr__(self):
        return f"LoadJob({self.name!r}, read={self.read})"

job = LoadJob("orders_daily").process(
    [{"amount": "10"}, {"amount": "x"}, {"amount": "30"}, {}],
    lambda r: float(r["amount"]),
)
print(job)
print(job.finish())
print(job.errors)
```

`self` is the object itself. Attributes set on `self` in `__init__` live as long as the object. A leading underscore, as in `_t0`, tells other developers "internal, don't touch".

## Inheritance, briefly

Inheritance lets a class reuse another's behaviour. In data code, the most useful form is a common interface with several implementations:

```python
class Sink:
    def write(self, rows):
        raise NotImplementedError

class PrintSink(Sink):
    def write(self, rows):
        for r in rows:
            print("PRINT", r)

class MemorySink(Sink):
    def __init__(self):
        self.rows = []
    def write(self, rows):
        self.rows.extend(rows)

def run(rows, sink: Sink):
    sink.write([r for r in rows if r["ok"]])

data = [{"id": 1, "ok": True}, {"id": 2, "ok": False}]
run(data, PrintSink())
mem = MemorySink(); run(data, mem); print("memory sink holds", mem.rows)
```

The pipeline doesn't care where data goes. In production, `Sink` might be S3, a warehouse table or Kafka; in tests, it's `MemorySink`. Keep hierarchies shallow; one level is usually enough.

## Common mistakes

- A class for everything. If it has one method and no state, make it a function.
- Mutable defaults in dataclasses. Use `field(default_factory=...)`.
- Validation scattered around the code instead of in `__post_init__`.
- Deep inheritance trees nobody can follow.

## In the interview

- *"Why use a dataclass?"* Less boilerplate for record types, readable `repr`, equality by value, optional immutability with `frozen=True`, and type hints that document the schema.
- *"What's `self`?"* The instance the method was called on. Python passes it automatically.
- *"How would you make a pipeline easy to test?"* Depend on an interface such as `Sink`, inject the real implementation in production and an in-memory one in tests.

```quiz
How do you give a dataclass field an empty list as its default?
- tags: list = []
* tags: list = field(default_factory=list)
- tags: list = None and never fix it
> A bare [] default would be shared by every instance; dataclasses refuse it.
---
What does frozen=True do on a dataclass?
* Prevents changing fields after creation and makes instances hashable
- Makes it faster to create
- Stops it being printed
> Frozen instances can go into sets and be dict keys.
---
When is a class better than a function in pipeline code?
- Always
- Never
* When data and behaviour belong together and state lives across calls
> A job that tracks counts or a client that keeps a connection are good examples.
```

```practice
py 23
py 36
```
