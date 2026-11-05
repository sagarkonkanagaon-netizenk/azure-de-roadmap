# Dates, times and time zones

By the end of this chapter you parse timestamps from messy sources, store everything in UTC, convert to IST only for display, and avoid the off-by-one-day bugs that break daily reports.

## The golden rule

**Store and compute in UTC. Convert to local time only at the edges**, when you read a local value in or show a value to a person. Mixing time zones inside a pipeline is the most common cause of "yesterday's numbers changed".

## naive versus aware

A *naive* datetime has no time zone; it is just a wall-clock reading. An *aware* datetime knows its offset from UTC. Only aware values can be compared safely across sources.

```python
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

naive = datetime(2025, 12, 3, 23, 30)
aware_ist = datetime(2025, 12, 3, 23, 30, tzinfo=IST)
aware_utc = aware_ist.astimezone(timezone.utc)

print(naive, naive.tzinfo)
print(aware_ist)
print(aware_utc)
```

11:30 pm in Pune on 3 December is 6:00 pm UTC the same day. Now take 2:00 am IST on 4 December: in UTC it is still 3 December. A report that groups by UTC date puts that order on the 3rd, while the business thinks it happened on the 4th. Decide which "day" the report means, write it down, and convert before grouping.

```python
late_night = datetime(2025, 12, 4, 2, 0, tzinfo=IST)
print("IST day:", late_night.date(), "| UTC day:", late_night.astimezone(timezone.utc).date())
```

## Parsing what sources send

ISO 8601 strings parse directly:

```python
print(datetime.fromisoformat("2025-12-03T10:15:00+05:30"))
print(datetime.fromisoformat("2025-12-03T04:45:00Z"))      # Z means UTC, accepted since Python 3.11
print(datetime.fromisoformat("2025-12-03"))
```

Other formats need a pattern. `%d/%m/%Y` is the Indian style; `%m/%d/%Y` is American. "03/12/2025" means 3 December in one and 12 March in the other, so never guess: agree the format with the source.

```python
print(datetime.strptime("03/12/2025 18:05", "%d/%m/%Y %H:%M"))
print(datetime.strptime("03-Dec-2025", "%d-%b-%Y").date())
print(datetime.strptime("20251203", "%Y%m%d").date())
```

Unix epoch timestamps are seconds (or milliseconds) since 1 January 1970 UTC:

```python
epoch_ms = 1764756000000
print(datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc))
```

Always pass `tz=timezone.utc`. Without it you get local time of whatever server runs the job.

### A tolerant parser that never guesses silently

```python
FORMATS = ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d"]

def parse_ts(s, assume_tz=IST):
    s = (s or "").strip().replace("Z", "+00:00")
    for fmt in FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=assume_tz)      # a documented assumption, not a guess
        return dt.astimezone(timezone.utc)
    raise ValueError(f"unrecognised timestamp {s!r}")

for s in ["2025-12-03T10:15:00+0530", "2025-12-03 10:15:00", "03/12/2025 10:15", "2025-12-03", "yesterday"]:
    try:
        print(f"{s!r:30} -> {parse_ts(s)}")
    except ValueError as e:
        print(e)
```

## Arithmetic with timedelta

```python
now = datetime(2025, 12, 3, 10, 0, tzinfo=timezone.utc)
print(now + timedelta(days=7))
print(now - timedelta(hours=36))
print((datetime(2025, 12, 31, tzinfo=timezone.utc) - now).days, "days to year end")
```

## Windows for incremental loads

Daily jobs process a half-open window `[start, end)`: start included, end excluded. Then consecutive windows never overlap and never miss a row.

```python
from datetime import date

def day_window(d: date, tz=IST):
    start = datetime(d.year, d.month, d.day, tzinfo=tz)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)

s, e = day_window(date(2025, 12, 3))
print(f"WHERE order_ts >= '{s.isoformat()}' AND order_ts < '{e.isoformat()}'")
```

Using `BETWEEN '2025-12-03 00:00' AND '2025-12-03 23:59:59'` loses anything in the last second and double-counts rows at midnight across two days. The half-open window is always right.

## Formatting for people

```python
ts = datetime(2025, 12, 3, 18, 5, tzinfo=timezone.utc).astimezone(IST)
print(ts.strftime("%d %b %Y, %I:%M %p IST"))
print(ts.isoformat(timespec="seconds"))
```

Use ISO 8601 (`isoformat()`) for anything a machine reads: logs, files, APIs.

## Common mistakes

- `datetime.now()` without a time zone. Use `datetime.now(timezone.utc)`.
- Grouping by UTC date when the business means the IST day.
- `BETWEEN` with `23:59:59` for daily windows. Use `>= start AND < end`.
- Guessing between dd/mm and mm/dd.
- Comparing naive and aware datetimes, which raises `TypeError`, or worse, comparing two naive values from different zones, which silently gives the wrong answer.

## In the interview

- *"How do you handle time zones in a pipeline?"* Convert to UTC on ingestion, store UTC, compute in UTC, and convert to the business time zone only for day boundaries and display. Document which time zone defines a reporting day.
- *"An order at 1 am IST shows on the wrong day. Why?"* The report groups by UTC date; 1 am IST is the previous day in UTC. Convert to IST before taking the date.
- *"How do you define a daily incremental window?"* Half-open: `ts >= day_start AND ts < next_day_start`, with both bounds computed in the business time zone and converted to UTC.

```quiz
An order is placed at 02:00 IST on 4 December. What is its UTC date?
* 3 December
- 4 December
- 5 December
> IST is UTC+5:30, so 02:00 IST is 20:30 UTC on the previous day.
---
Which filter correctly selects one day of orders?
- order_ts BETWEEN '2025-12-03 00:00:00' AND '2025-12-03 23:59:59'
* order_ts >= '2025-12-03 00:00:00' AND order_ts < '2025-12-04 00:00:00'
- DATE(order_ts) = '2025-12-03' using the server's local time
> A half-open window never misses the last fraction of a second and never overlaps the next day.
---
What should you pass to datetime.fromtimestamp for epoch values from an API?
- Nothing
* tz=timezone.utc
- tz=ZoneInfo("Asia/Kolkata") always
> Without tz you get the server's local time, which changes from machine to machine.
```

```practice
py 10
py 26
```
