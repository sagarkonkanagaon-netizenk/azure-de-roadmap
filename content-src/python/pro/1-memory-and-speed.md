# Deep dive: memory and speed in Python pipelines

By the end of this deep dive you can explain what Python is doing with memory under the hood, measure where a pipeline spends its time, apply the speed-ups that actually matter (with numbers), and take a slow job and make it ten times faster, step by step, the way you'd describe it in a senior interview.

## Everything is an object, and objects are heavy

In C, an integer is 4 or 8 bytes. In Python, every value is a full object with a type pointer and a reference count, and a list holds *pointers* to those objects. That's why a list of a million numbers is far bigger than a million numbers.

```python
import sys, array

print("int object:", sys.getsizeof(7), "bytes")
print("float object:", sys.getsizeof(7.0), "bytes")
print("empty str:", sys.getsizeof(""), "bytes; 'abc':", sys.getsizeof("abc"), "bytes")

n = 1_000_000
as_list = list(range(n))
as_array = array.array("q", range(n))          # packed 8-byte ints, like C
list_total = sys.getsizeof(as_list) + sum(sys.getsizeof(x) for x in as_list)
print(f"list of {n:,} ints: ~{list_total / 1e6:.0f} MB")
print(f"array of {n:,} ints: ~{sys.getsizeof(as_array) / 1e6:.0f} MB")
```

The list costs about four times more: 8 bytes per pointer plus around 28 bytes per int object. NumPy, pandas and Arrow get their speed and size from the same trick as `array`: values packed side by side in one block of memory, processed by compiled loops.

### Dicts of rows are the most expensive shape of all

```python
row = {"order_id": 1, "city": "Pune", "amount": 250.0}
print("one dict row:", sys.getsizeof(row), "bytes before counting its values")

from dataclasses import dataclass

@dataclass(slots=True)
class Order:
    order_id: int
    city: str
    amount: float

print("one slotted object:", sys.getsizeof(Order(1, "Pune", 250.0)), "bytes")
print("one tuple:", sys.getsizeof((1, "Pune", 250.0)), "bytes")
```

A million rows as dicts repeats every key name's slot table a million times. Tuples, slotted classes or, best of all, columns cut that dramatically.

```locked
Measure first: perf_counter, timeit and cProfile
The speed-ups that matter, with numbers
pandas: the three speeds of the same calculation
The GIL, properly
Memory: find it, then shrink it
Case study: a 10x faster daily job
Interview questions, with model answers
```
