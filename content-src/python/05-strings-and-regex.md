# Strings and cleaning text

By the end of this chapter you can clean messy text fields the way real source systems deliver them: stray spaces, mixed case, odd separators, phone numbers in five formats, and values hidden inside free text.

## The everyday methods

```python
raw = "  Navi MUMBAI , MH  "
print(repr(raw.strip()))             # trim both ends
print(raw.strip().lower())
print(raw.strip().title())
print(raw.split(","))                # split on a separator
print([p.strip() for p in raw.split(",")])
print(" | ".join(["Pune", "Goa", "Delhi"]))
print("ORD-1042".startswith("ORD-"), "report.csv".endswith((".csv", ".tsv")))
print("ORD-1042".removeprefix("ORD-"))  # Python 3.9+
print("a,b,,c".replace(",,", ","))
```

Strings never change in place. Every method returns a new string, so remember to assign the result: `name = name.strip()`.

## Checking what a string contains

```python
for s in ["1042", "12.5", "-3", "abc", "", "٣"]:
    print(repr(s), s.isdigit(), s.isdecimal())
```

`isdigit()` says nothing about decimals or negatives, and it accepts digits from other scripts. To check "is this a number", try to convert it:

```python
def to_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None

[to_float(x) for x in ["12.5", "-3", "1e3", "abc", None, " 7 "]]
```

## Slicing

```python
code = "IN-MH-PUNE-411001"
print(code[:2], code[-6:], code[3:5])
print(code[::-1])          # reversed
print(code.split("-")[2])
```

## Regular expressions

When the pattern is more complex than a fixed separator, use `re`. Learn five pieces and you can read most patterns: `\d` digit, `\w` letter or digit, `\s` whitespace, `+` one or more, `( )` capture.

```python
import re

text = "Order #1042 paid ₹1,299.50 on 2025-12-03; order #1043 failed"
print(re.findall(r"#(\d+)", text))                  # all order numbers
print(re.search(r"(\d{4})-(\d{2})-(\d{2})", text).groups())
print(re.sub(r"[₹,]", "", "₹1,299.50"))             # drop currency and commas
```

Always write patterns as raw strings, `r"..."`, so backslashes reach `re` untouched.

### Normalise phone numbers

Real data mixes formats. Strip everything that isn't a digit, then apply rules:

```python
def clean_phone(raw):
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)          # \D = anything that isn't a digit
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if len(digits) == 10 and digits[0] in "6789" else None

for p in ["+91 98765-43210", "098765 43210", "9876543210", "12345", None, "(022) 2345 6789"]:
    print(repr(p), "->", clean_phone(p))
```

Notice the last one: a landline with an area code doesn't pass the mobile rule, so it becomes `None` rather than a wrong number. In a real pipeline you'd send it to a reject table with the reason.

### Named groups for readable parsing

```python
line = '10.0.0.7 - - [03/Dec/2025:10:15:32 +0530] "GET /api/orders HTTP/1.1" 503 512'
pattern = re.compile(r'(?P<ip>\S+) .*?\[(?P<ts>[^\]]+)\] "(?P<method>\w+) (?P<path>\S+)[^"]*" (?P<status>\d{3})')
m = pattern.match(line)
m.groupdict()
```

`re.compile` once and reuse the pattern inside loops. It saves re-parsing the pattern on every line.

## Unicode and invisible characters

Data from spreadsheets and web forms carries characters you can't see: non-breaking spaces, zero-width spaces, curly quotes. They make `"Pune" != "Pune"`.

```python
import unicodedata

a = "Pune "          # non-breaking space at the end
b = "Pune"
print(a == b, a.strip() == b)          # strip() does handle  

c = "Pu​ne"          # zero-width space in the middle
print(c == b, len(c))

def normalise(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[​-‍﻿]", "", s)    # zero-width characters and BOM
    return " ".join(s.split())                      # collapse all runs of whitespace

print(normalise(c) == b, repr(normalise("  “Navi  Mumbai”  ")))
```

`" ".join(s.split())` is a neat idiom: `split()` with no argument splits on any whitespace and drops empties, so joining back collapses every run to a single space.

## Common mistakes

- Forgetting to assign: `name.strip()` alone does nothing.
- Using `isdigit()` to validate numbers. Try the conversion instead.
- Regex without `r"..."`.
- Treating a failed clean as a valid value. Return `None` and record why.
- Comparing text without normalising case, spaces and Unicode first.

## In the interview

- *"How do you clean a column of phone numbers?"* Remove non-digits, strip known country or trunk prefixes, validate length and leading digit, send failures to a reject table with a reason.
- *"Why are two strings that look equal not equal?"* Hidden characters: non-breaking or zero-width spaces, different Unicode forms, trailing whitespace. Normalise with `unicodedata.normalize` and collapse whitespace.

```quiz
What does `"  a  b ".split()` return?
- ['', 'a', 'b', '']
* ['a', 'b']
- ['  a  b ']
> With no argument, split() splits on any run of whitespace and drops empty pieces.
---
Why write regex patterns as r"\d+" instead of "\d+"?
* So Python passes backslashes to the regex engine unchanged
- It makes the regex faster
- Raw strings ignore case
> In a normal string, sequences like \b or \n would be turned into special characters first.
---
"12.5".isdigit() returns?
- True
* False
- 12.5
> The dot isn't a digit. To check for a number, try float() and catch ValueError.
```

```practice
py 3
py 11
py 13
py 16
py 33
```
