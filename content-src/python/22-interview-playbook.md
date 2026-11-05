# The Python interview playbook for data engineers

By the end of this chapter you know what data engineering Python rounds actually test, how to talk while you code, and you'll have worked through the patterns and trick questions that come up again and again.

## What the round is really testing

Data engineering Python rounds are rarely about clever algorithms. They check whether you can:

1. **Manipulate data structures fluently**: dicts, sets, sorting, grouping, counting.
2. **Handle messy input**: nulls, bad types, duplicates, empty files.
3. **Think about scale**: what happens at 100 GB, what's O(n) vs O(n²), what stays in memory.
4. **Write code a team could maintain**: clear names, small functions, tests.

## The five-step routine, out loud

1. **Restate and ask.** "So the input is a list of dicts, could a key be missing? Can amounts be negative? How big is it?"
2. **Give a simple example.** Write 3 to 5 input rows and the expected output.
3. **Say the plan before coding.** "One pass, a dict keyed by customer, then sort by total."
4. **Code it cleanly**, narrating decisions ("I'll use `defaultdict` so I don't check for missing keys").
5. **Test and talk about scale.** Run your example, then an edge case, then say how it changes for 1 TB.

Silence is the most common reason good candidates fail. Interviewers grade the thinking they can hear.

## Pattern 1: count and group with a dict

Most questions are a group-by in disguise.

```python
from collections import Counter, defaultdict

events = [
    {"user": "u1", "type": "click", "ms": 120},
    {"user": "u2", "type": "view", "ms": 40},
    {"user": "u1", "type": "view", "ms": 35},
    {"user": "u3", "type": "click", "ms": None},
    {"user": "u1", "type": "click", "ms": 90},
]

print(Counter(e["type"] for e in events).most_common())

by_user = defaultdict(list)
for e in events:
    if e["ms"] is not None:
        by_user[e["user"]].append(e["ms"])
print({u: round(sum(v) / len(v), 1) for u, v in by_user.items()})
```

## Pattern 2: sets for "in one but not the other"

```python
yesterday = {"o1", "o2", "o3", "o4"}
today = {"o2", "o3", "o5"}
print("new:", sorted(today - yesterday), "| gone:", sorted(yesterday - today),
      "| both:", sorted(today & yesterday))
```

This is how you'd explain a reconciliation between a source and a target: set difference on the keys. Membership in a set is O(1), in a list it's O(n).

## Pattern 3: sort with a key, keep the latest per id

```python
records = [("c1", "2025-12-01", "Pune"), ("c2", "2025-12-02", "Goa"),
           ("c1", "2025-12-04", "Mumbai"), ("c2", "2025-11-30", "Delhi")]

latest = {}
for cid, ts, city in sorted(records, key=lambda r: r[1]):
    latest[cid] = (ts, city)                # later rows overwrite earlier ones
print(latest)
```

This is SQL's `ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC) = 1` in plain Python. Say that out loud; interviewers love the connection.

## Pattern 4: stream instead of load

When they say "the file is 50 GB", the answer is a generator and constant memory.

```python
def read_lines(n):                         # stands in for open("huge.log")
    for i in range(n):
        status = 500 if i % 97 == 0 else 200
        yield f"10.0.0.{i % 13} GET /api/orders {status}"

errors = Counter()
for line in read_lines(1_000_000):
    ip, _, _, status = line.split()
    if status.startswith("5"):
        errors[ip] += 1
print(errors.most_common(3))
```

Memory stays flat whatever the file size, because only the counter grows, and it grows with the number of IPs, not lines. If even the keys don't fit, hash-partition into files by key and process each file separately, which is exactly what Spark does.

## Pattern 5: sliding windows and running state

```python
from collections import deque

def rolling_avg(values, k):
    window, total = deque(), 0
    for v in values:
        window.append(v); total += v
        if len(window) > k:
            total -= window.popleft()
        yield round(total / len(window), 2)

print(list(rolling_avg([10, 20, 30, 40, 50, 60], 3)))
```

O(1) per item instead of re-summing the window each time.

## The trick questions

Predict each output before you run it.

```python
def add_item(item, bucket=[]):            # 1. mutable default
    bucket.append(item)
    return bucket
print(add_item("a"), add_item("b"))
```

The default list is created once, when the function is defined, so both calls share it. Fix: `bucket=None`, then `bucket = [] if bucket is None else bucket`.

```python
grid = [[0] * 3] * 3                       # 2. the same list three times
grid[0][0] = 1
print(grid)

funcs = [lambda: i for i in range(3)]      # 3. late binding
print([f() for f in funcs])

a = [1, 2, 3]; b = a; b += [4]             # 4. aliasing
print(a)

print(0.1 + 0.2 == 0.3, round(0.1 + 0.2, 10) == 0.3)   # 5. floats
x = None
print(x is None, [1] == [1], [1] is [1])                # 6. is vs ==
```

- **2**: `[[0] * 3] * 3` copies the *reference*. Use `[[0] * 3 for _ in range(3)]`.
- **3**: the lambdas look up `i` when called, after the loop ended. Fix with `lambda i=i: i`.
- **4**: `b = a` doesn't copy. Use `a.copy()` or `list(a)`.
- **5**: never compare floats with `==`; money goes in `Decimal` or integer paise.
- **6**: `is` checks identity, `==` checks value. Use `is` only for `None`.

## Complexity you should be able to state

| Operation | list | dict / set |
|---|---|---|
| `x in` | O(n) | O(1) |
| append / add | O(1) | O(1) |
| insert at front | O(n) | n/a |
| sort | O(n log n) | n/a |

A nested loop comparing two lists is O(n × m). Turning one into a set makes it O(n + m). This single change is the most common "can you make it faster?" answer.

## Scale questions and good answers

- *"It works on 1 MB. What about 500 GB?"* Stream with generators, keep only aggregates in memory, or move to DuckDB, Polars or Spark. Mention partitioning by key.
- *"The job is slow. How do you find out why?"* Measure first: `time.perf_counter` around steps, `cProfile` for hot functions, then fix the biggest one (usually I/O, row-by-row loops, or a quadratic lookup).
- *"How do you make it reliable?"* Retries with backoff for transient errors, idempotent writes, data checks, logging with row counts, alerts.

## Your 7-day revision plan

| Day | Do |
|---|---|
| 1 | Re-run chapters 2 to 4 examples from memory; practice questions 1 to 10 |
| 2 | Strings, JSON, dates; questions 11 to 20 |
| 3 | Generators, decorators, context managers; questions 21 to 30 |
| 4 | pandas chapters, then question 40 and a groupby from scratch |
| 5 | Rebuild the mini project from chapter 21 without looking |
| 6 | Trick questions above, plus explaining the GIL, idempotency and watermarks aloud |
| 7 | Two timed mock problems, speaking the whole time |

```quiz
An interviewer says the log file is 50 GB. What's the key change to your solution?
- Use a bigger machine
* Read it line by line with a generator and keep only aggregates in memory
- Load it into a list first
> Constant memory regardless of file size is the point they're checking.
---
What does add_item("a"), add_item("b") print with def add_item(item, bucket=[])?
- ['a'] ['b']
* ['a', 'b'] ['a', 'b']
- An error
> The default list is created once and shared by every call.
---
You check "x in big_list" inside a loop over another list. How do you speed it up?
* Turn big_list into a set first
- Sort both lists
- Use a while loop
> Set membership is O(1), so O(n × m) becomes O(n + m).
```

```practice
py 1
py 13
py 22
py 24
py 38
page /interview/playbook The full interview playbook
```
