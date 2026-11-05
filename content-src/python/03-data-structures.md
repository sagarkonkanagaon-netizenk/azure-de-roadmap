# Lists, dicts, sets and tuples

By the end of this chapter you pick the right container without thinking, know what each operation costs, and write comprehensions that replace most loops.

## The four containers

| Type | Looks like | Ordered | Changeable | Duplicates | Use it for |
| --- | --- | --- | --- | --- | --- |
| list | `[1, 2, 2]` | yes | yes | yes | rows, a sequence of things |
| tuple | `(1, "Pune")` | yes | no | yes | a fixed record, dict keys |
| dict | `{"id": 1}` | insertion order | yes | keys unique | lookups by key, one row |
| set | `{1, 2}` | no | yes | no | membership, de-duplication |

## Lists

```python
orders = [120, 450, 3100]
orders.append(75)            # add to the end
orders.extend([10, 20])      # add many
orders.insert(0, 999)        # add at a position (slow on big lists)
print(orders)
print(orders[0], orders[-1]) # first, last
print(orders[1:3])           # slice: index 1 up to, not including, 3
print(sorted(orders, reverse=True)[:3])  # top 3
```

`sorted()` returns a new list; `list.sort()` sorts in place and returns `None`. Writing `orders = orders.sort()` is a classic bug that leaves you with `None`.

## Dicts: the workhorse

A dict is one row, a lookup table, a counter, a config. Learn it well.

```python
row = {"order_id": 7, "city": "Pune", "amount": 450}
print(row["city"])
print(row.get("coupon"))           # None instead of KeyError
print(row.get("coupon", "NONE"))   # with a default
row["amount"] += 50
row["status"] = "paid"             # add a key
for key, value in row.items():
    print(key, "=", value)
```

Counting and grouping come up in every pipeline. `collections` has the right tools:

```python
from collections import Counter, defaultdict

cities = ["Pune", "Goa", "Pune", "Delhi", "Pune", "Goa"]
print(Counter(cities).most_common(2))

orders = [("Pune", 300), ("Goa", 120), ("Pune", 500)]
by_city = defaultdict(list)
for city, amount in orders:
    by_city[city].append(amount)
print(dict(by_city))
print({c: sum(a) for c, a in by_city.items()})
```

Merging dicts, newest value wins:

```python
defaults = {"retries": 3, "timeout": 30}
overrides = {"timeout": 60}
config = defaults | overrides      # Python 3.9+, same as {**defaults, **overrides}
config
```

## Sets

```python
yesterday = {101, 102, 103, 104}
today = {103, 104, 105}
print("new:", today - yesterday)
print("gone:", yesterday - today)
print("still there:", today & yesterday)
print("all:", today | yesterday)
```

That is a full change-detection between two snapshots in four lines. Sets also de-duplicate: `set(ids)`. If you need to keep the original order while de-duplicating, use `list(dict.fromkeys(ids))`.

## Tuples

A tuple is a fixed record. Because it can't change, it can be a dict key or a set member, which a list can't.

```python
point = ("Pune", "2025-12-01")
daily = {point: 4200}
city, day = point          # unpacking
print(city, day, daily[("Pune", "2025-12-01")])
```

## What things cost

This is what interviewers mean by "time complexity" for everyday code:

| Operation | list | dict / set |
| --- | --- | --- |
| `x in container` | O(n), scans everything | O(1) on average |
| get by index / key | O(1) | O(1) |
| append / add | O(1) | O(1) |
| insert or delete at front | O(n) | O(1) |

The single biggest speed-up in beginner pipeline code is turning a list you search repeatedly into a set or dict:

```python
import time

valid_ids = list(range(200_000))
incoming = list(range(0, 400_000, 7))

t = time.perf_counter()
hits = sum(1 for x in incoming[:2000] if x in valid_ids)        # list: scans each time
slow = time.perf_counter() - t

valid_set = set(valid_ids)
t = time.perf_counter()
hits2 = sum(1 for x in incoming if x in valid_set)               # set: hash lookup
fast = time.perf_counter() - t
print(f"list, 2,000 lookups: {slow:.3f}s   set, {len(incoming):,} lookups: {fast:.3f}s")
```

## Comprehensions

A comprehension builds a list, dict or set in one expression. Read it as "give me *this* for each item *where* condition".

```python
amounts = [120, 0, 3400, -50, 980]
print([a for a in amounts if a > 0])
print([a * 1.18 for a in amounts])                 # add 18% GST
print({a: a > 1000 for a in amounts})              # dict comprehension
print({c.lower() for c in ["Pune", "PUNE", "Goa"]})  # set comprehension
```

Nested data flattens with two `for` clauses, written in the same order as the loops:

```python
baskets = [["milk", "bread"], ["eggs"], ["milk", "rice"]]
[item for basket in baskets for item in basket]
```

If a comprehension needs more than one `if` or gets hard to read, write the loop. Clarity wins.

## Copying: the mutable trap

```python
a = [1, 2, 3]
b = a            # same list, two names
b.append(4)
print(a)

import copy
rows = [{"id": 1, "tags": ["x"]}]
shallow = list(rows)
deep = copy.deepcopy(rows)
rows[0]["tags"].append("y")
print(shallow[0]["tags"], deep[0]["tags"])
```

Assignment never copies. `list(x)` or `x.copy()` copies one level; nested lists and dicts are still shared. Use `copy.deepcopy` when you need a fully separate copy.

## Common mistakes

- Searching a list inside a loop. Build a set or dict once.
- `x = x.sort()`. Sort returns `None`.
- `row["key"]` on data you don't control. Use `.get()` with a default.
- Expecting `b = a` to copy.
- Using a list as a dict key. Use a tuple.

## In the interview

- *"List vs tuple?"* Lists change, tuples don't; tuples can be dict keys and signal "fixed record".
- *"How is a dict lookup O(1)?"* Keys are hashed to find their slot directly. That's also why keys must be immutable.
- *"Remove duplicates but keep order?"* `list(dict.fromkeys(items))`.

```quiz
You check 1 million incoming IDs against 200,000 valid IDs. What structure should hold the valid IDs?
- A list
* A set
- A tuple
> Membership in a set is a hash lookup, O(1) on average. A list scans every element.
---
What does `orders.sort()` return?
- The sorted list
* None
- A copy of the list
> It sorts in place. Use `sorted(orders)` when you want a new list.
---
Why can a tuple be a dict key but a list can't?
* Tuples are immutable, so their hash can't change
- Tuples are faster
- Lists are not ordered
> A key's hash must stay the same for its whole life. A list could change after you insert it.
```

```practice
py 1
py 5
py 17
py 19
py 30
```
