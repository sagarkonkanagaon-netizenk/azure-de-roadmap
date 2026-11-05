# JSON and nested data

By the end of this chapter you parse API payloads safely, flatten nested JSON into table rows, explode arrays, and stream JSON Lines files that are too big to load at once.

## JSON in, Python out

```python
import json

payload = '{"order_id": 7, "paid": true, "coupon": null, "items": [{"sku": "A1", "qty": 2}]}'
order = json.loads(payload)
print(order)
print(type(order["paid"]), order["coupon"])
print(json.dumps(order, indent=2))
```

JSON maps to Python like this: object → `dict`, array → `list`, `true`/`false` → `True`/`False`, `null` → `None`. Numbers become `int` or `float`.

`json.dumps(..., ensure_ascii=False)` keeps text like "₹" or "मुंबई" readable instead of escaping it.

## Read nested values safely

APIs leave fields out. Chained `[]` access fails on the first missing key. Write a small helper:

```python
event = {"user": {"id": 42, "address": {"city": "Pune"}}, "device": None}

def dig(obj, *path, default=None):
    for key in path:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        elif isinstance(obj, list) and isinstance(key, int) and -len(obj) <= key < len(obj):
            obj = obj[key]
        else:
            return default
    return obj

print(dig(event, "user", "address", "city"))
print(dig(event, "user", "address", "pin", default="UNKNOWN"))
print(dig(event, "device", "os"))
```

## Flatten nested objects into columns

Warehouses want flat rows. Join nested keys with dots or underscores:

```python
def flatten(obj, parent="", sep="."):
    out = {}
    for k, v in obj.items():
        key = f"{parent}{sep}{k}" if parent else k
        if isinstance(v, dict):
            out.update(flatten(v, key, sep))
        else:
            out[key] = v
    return out

flatten({"id": 1, "user": {"id": 42, "address": {"city": "Pune", "pin": "411001"}}, "tags": ["new"]})
```

Lists are left alone on purpose. A list of child records is a separate table, not extra columns.

## Explode arrays into child rows

One order with three items becomes three rows in an `order_items` table, each carrying the parent key:

```python
orders = [
    {"order_id": 1, "city": "Pune", "items": [{"sku": "A1", "qty": 2, "price": 120}, {"sku": "B7", "qty": 1, "price": 999}]},
    {"order_id": 2, "city": "Goa", "items": []},
    {"order_id": 3, "city": "Delhi"},
]

order_rows, item_rows = [], []
for o in orders:
    order_rows.append({"order_id": o["order_id"], "city": o["city"], "item_count": len(o.get("items") or [])})
    for line_no, item in enumerate(o.get("items") or [], start=1):
        item_rows.append({"order_id": o["order_id"], "line_no": line_no, **item})

print(order_rows)
print(item_rows)
```

Orders 2 and 3 have no items, but they still appear in `order_rows`. Exploding without keeping the parent row is how orders silently disappear from reports. Spark calls these two behaviours `explode` and `explode_outer`.

## JSON Lines: one record per line

Event exports and log files usually use JSON Lines (`.jsonl`): one JSON object per line. You can stream them line by line and skip a broken line instead of failing the whole file.

```python
from pathlib import Path

Path("data").mkdir(exist_ok=True)
Path("data/events.jsonl").write_text(
    '{"event": "view", "user": 1}\n'
    '{"event": "cart", "user": 1}\n'
    '{"event": "view", "user": 2\n'          # broken line
    '\n'
    '{"event": "buy", "user": 1}\n',
    encoding="utf-8",
)

good, bad = [], []
with open("data/events.jsonl", encoding="utf-8") as fh:
    for n, line in enumerate(fh, start=1):
        if not line.strip():
            continue
        try:
            good.append(json.loads(line))
        except json.JSONDecodeError as e:
            bad.append((n, str(e)))

print(len(good), "events;", "bad lines:", bad)
```

Writing JSON Lines is just `fh.write(json.dumps(rec) + "\n")` per record.

## Dates and decimals don't serialise by default

```python
from datetime import datetime, date
from decimal import Decimal

rec = {"ts": datetime(2025, 12, 3, 10, 15), "day": date(2025, 12, 3), "amount": Decimal("12.50")}

def to_json(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)               # keep exact value as text
    raise TypeError(f"can't serialise {type(o).__name__}")

json.dumps(rec, default=to_json)
```

## Schema drift

Sources add, rename and drop fields without telling you. Compare each record's keys against what you expect:

```python
EXPECTED = {"order_id", "city", "amount"}

def drift(record):
    keys = set(record)
    return {"missing": sorted(EXPECTED - keys), "new": sorted(keys - EXPECTED)}

print(drift({"order_id": 1, "city": "Pune", "amount": 10}))
print(drift({"order_id": 2, "city_name": "Goa", "amount": 5, "channel": "app"}))
```

New fields are usually safe to keep in a raw JSON column. Missing required fields should stop the load or go to rejects.

## Common mistakes

- `data["a"]["b"]["c"]` on API data. Fields go missing.
- Exploding child arrays and dropping parents that have none.
- Loading a huge `.json` array whole. Ask for JSON Lines, or stream.
- Storing money as float after parsing. Use `json.loads(s, parse_float=Decimal)` when exactness matters.

## In the interview

- *"How would you load nested JSON into a warehouse?"* Land it raw first. Then flatten scalar fields into columns, explode arrays into child tables keyed by the parent id, keep the full payload in a JSON column for fields you don't model yet, and track schema drift.
- *"Why JSON Lines over one big JSON array?"* It streams line by line, appends cheaply, splits for parallel processing, and one bad line doesn't break the whole file.

```quiz
An order has an empty items list. When you explode items into order_items, what must you make sure of?
- Skip the order entirely
* The order still appears in the orders table
- Insert a fake item
> Dropping parents with no children is how orders vanish from reports. Keep the parent row.
---
What does json.loads turn `null` into?
- "null"
- 0
* None
> JSON null maps to Python None.
---
Why is JSON Lines easier to process than one large JSON array?
* Each line is a complete record, so you can stream and skip bad lines
- It is always smaller
- It supports more data types
> You never need the whole file in memory, and one broken line doesn't stop the load.
```

```practice
py 15
py 35
py 37
```
