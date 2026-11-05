# Python essentials, fast

By the end of this chapter you can read and write everyday Python: values and types, f-strings, truthiness, `if`, loops and the few syntax rules that trip people coming from SQL or Java.

## Values and types

Python figures out the type from the value. You don't declare it.

```python
order_id = 1042          # int
amount = 1299.50         # float
city = "Pune"            # str
is_paid = True           # bool
coupon = None            # "no value", like SQL NULL

for v in [order_id, amount, city, is_paid, coupon]:
    print(repr(v), type(v).__name__)
```

`None` is Python's missing value. Test for it with `is None`, never `== None`. It reads better, and a class can redefine `==` but not `is`.

## Numbers: two traps every DE hits

```python
print(7 / 2)     # true division always gives a float
print(7 // 2)    # floor division
print(7 % 2)     # remainder
print(0.1 + 0.2) # floats are binary fractions
```

`0.1 + 0.2` is not exactly `0.3`. For money, use `Decimal` (or store paise as integers). Never compare floats with `==`; check that they are close.

```python
from decimal import Decimal
import math

print(Decimal("0.10") + Decimal("0.20"))
print(math.isclose(0.1 + 0.2, 0.3))
```

Build a `Decimal` from a **string**, not a float. `Decimal(0.1)` copies the float's error.

## Strings and f-strings

f-strings are the modern way to build text. They can format numbers too:

```python
customer, total, share = "Ravi", 1234567.891, 0.4567
print(f"{customer} spent ₹{total:,.2f}")    # thousands separator, 2 decimals
print(f"share: {share:.1%}")                # as a percentage
print(f"{'id':<6}|{'city':>8}|")            # pad left / right in a column
print(f"{total=}")                          # name and value, handy for debugging
```

## Truthiness

In an `if`, empty things count as false: `0`, `0.0`, `""`, `[]`, `{}`, `set()` and `None`. Everything else is true.

```python
rows = []
if not rows:
    print("nothing to load, skipping")

batch_size = 0
if batch_size:                    # careful: 0 is falsy
    print("never printed")
if batch_size is not None:        # what you usually meant
    print("batch size was set to", batch_size)
```

The second case is a real bug pattern. When `0` is a valid value, test `is not None`.

## Conditions and loops

Indentation is the syntax. Four spaces per level.

```python
amounts = [120, 0, 3400, -50, 980]
for a in amounts:
    if a < 0:
        print(a, "refund")
    elif a == 0:
        print(a, "free item")
    elif a >= 1000:
        print(a, "high value")
    else:
        print(a, "normal")
```

`enumerate` gives you the index, `zip` walks lists side by side, and `range` counts:

```python
cities = ["Pune", "Delhi", "Goa"]
sales = [300, 500, 120]
for i, (c, s) in enumerate(zip(cities, sales), start=1):
    print(i, c, s)

total = 0
for n in range(1, 6):
    total += n
print("1+2+3+4+5 =", total)
```

`while` loops run until a condition changes. Use `break` to leave early and `continue` to skip to the next round:

```python
pages, page = [], 1
while True:
    if page == 3:
        page += 1
        continue          # pretend page 3 was empty
    pages.append(page)
    if page >= 5:
        break
    page += 1
print(pages)
```

## Comparisons chain

```python
age = 27
print(18 <= age < 60)          # same as 18 <= age and age < 60
print("Pune" in cities)
print(3 not in [1, 2])
```

`and` and `or` short-circuit. `x or default` returns the first truthy value, which is a common way to fill a blank:

```python
raw_city = ""
city = raw_city or "Unknown"
city
```

That trick replaces `0` too, so use it only when `0` is not a real value.

## Common mistakes

- Using `== None` instead of `is None`.
- `if count:` when `0` is a valid count.
- Mixing tabs and spaces. Let your editor insert four spaces.
- Building money with floats. Use `Decimal("12.34")` or integer paise.
- Forgetting that `/` always returns a float, even `4 / 2`.

## In the interview

- *"What's the difference between `is` and `==`?"* `==` compares values; `is` checks that two names point to the same object. Use `is` only for `None`, `True` and `False`.
- *"Why is `0.1 + 0.2 != 0.3`?"* Floats are stored in binary and can't represent 0.1 exactly. Use `Decimal` for money and `math.isclose` for comparisons.
- *"What is truthiness?"* Empty containers, zero and `None` are false in a condition; everything else is true.

```quiz
What does `7 // 2` return?
- 3.5
* 3
- 4
> `//` is floor division. `/` always returns a float.
---
A function returns 0 for a valid empty batch and None when the batch failed. How do you test for failure?
- if not result:
* if result is None:
- if result == False:
> `not result` is also true for 0, so it would treat a valid empty batch as a failure.
---
How should you create a Decimal for ₹19.99?
* Decimal("19.99")
- Decimal(19.99)
- float("19.99")
> Passing a float copies its binary rounding error into the Decimal.
```

```practice
py 3
py 4
py 6
```
