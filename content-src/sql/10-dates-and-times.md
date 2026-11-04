# Dates and times

By the end of this chapter you can bucket timestamps into days, weeks and months, do date arithmetic, fill missing dates, build retention and churn numbers, and avoid the time zone and boundary bugs that make daily numbers disagree.

## Dates are where pipelines break

Most pipelines run on a time window: "load yesterday", "rebuild last month". A wrong boundary double counts or drops a day, and a time zone mix-up shifts revenue across midnight. Get these few patterns right and most date bugs disappear.

## Types

| Type | Holds | Example |
|---|---|---|
| `DATE` | a calendar day | `DATE '2025-03-14'` |
| `TIMESTAMP` | date and time, no zone | `TIMESTAMP '2025-03-14 18:30:00'` |
| `TIMESTAMPTZ` / `TIMESTAMP WITH TIME ZONE` | an instant in time | stored in UTC, shown in the session zone |
| `INTERVAL` | a duration | `INTERVAL 7 DAY` |

Store event times in UTC and convert to a local zone (India is UTC+5:30) only for reporting. When a source sends local time with no zone, write down which zone it is in the pipeline's docs: you can't recover it later.

## Truncate and extract

```sql
SELECT order_ts,
       CAST(order_ts AS DATE)          AS day,
       date_trunc('week', order_ts)    AS week_start,
       date_trunc('month', order_ts)   AS month_start,
       EXTRACT(year FROM order_ts)     AS yr,
       EXTRACT(quarter FROM order_ts)  AS qtr,
       dayname(order_ts)               AS weekday,
       EXTRACT(hour FROM order_ts)     AS hr
FROM shop_orders
LIMIT 5;
```

`date_trunc` keeps a timestamp you can sort and join on; `EXTRACT` gives a number. For monthly reports, group by `date_trunc('month', ...)`, not by `EXTRACT(month ...)`, or January 2024 and January 2025 land in the same bucket.

```sql
SELECT date_trunc('month', order_ts) AS month,
       COUNT(*) AS orders,
       SUM(quantity * unit_price) AS gross
FROM shop_orders
GROUP BY month
ORDER BY month;
```

Weeks start on Monday in DuckDB, Spark and Postgres (ISO weeks), but on Sunday in some BI tools. Agree on one with the business.

## Arithmetic

```sql
SELECT DATE '2025-01-31' + INTERVAL 1 MONTH                   AS plus_month,
       DATE '2025-03-14' - INTERVAL 7 DAY                     AS minus_week,
       DATE '2025-03-14' - DATE '2025-01-01'                  AS days_between,
       DATE_DIFF('day',   DATE '2025-01-01', DATE '2025-03-14') AS diff_days,
       DATE_DIFF('month', DATE '2025-01-31', DATE '2025-02-01') AS diff_months,
       last_day(DATE '2024-02-10')                            AS month_end;
```

Two surprises worth remembering. Adding one month to 31 January gives 28 February, because there is no 31st. And `DATE_DIFF('month', ...)` counts month boundaries crossed, so 31 January to 1 February is one month. Function names differ by engine: `datediff`, `date_add` and `add_months` in Spark (chapter 19 has the full table).

## Windows of time: always half-open

```sql
SELECT COUNT(*) AS orders_last_7_days
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-12-31' - INTERVAL 7 DAY
  AND order_ts <  TIMESTAMP '2025-12-31';
```

Start inclusive, end exclusive, as in chapter 3. In a real job the end comes from the scheduler's run date, not `CURRENT_DATE`, so rerunning last Tuesday's job reloads last Tuesday's window and nothing else. That's what makes a job safe to backfill (handbook 10, Airflow).

## Fill missing dates

A chart of daily sales must show zero on days with no sales, not skip them. Generate every day, then left join:

```sql
WITH days AS (
    SELECT CAST(d AS DATE) AS day
    FROM generate_series(TIMESTAMP '2025-02-01', TIMESTAMP '2025-02-28', INTERVAL 1 DAY) t(d)
),
cod AS (
    SELECT CAST(order_ts AS DATE) AS day, COUNT(*) AS orders
    FROM shop_orders
    WHERE payment_method = 'Cash on delivery' AND channel = 'marketplace' AND quantity = 6
      AND order_ts >= TIMESTAMP '2025-02-01' AND order_ts < TIMESTAMP '2025-03-01'
    GROUP BY day
)
SELECT d.day, COALESCE(c.orders, 0) AS orders
FROM days d
LEFT JOIN cod c ON c.day = d.day
ORDER BY d.day;
```

In Spark use `sequence(start, end, interval 1 day)` with `explode`. Many warehouses keep a permanent calendar table with one row per day plus holiday and fiscal-period columns, which is better than generating one each time (chapter 14).

## Cohorts, retention and churn

Retention asks: of the people active in one period, how many came back in the next? Build one row per user per month, then join each month to the next:

```sql
WITH active AS (
    SELECT DISTINCT customer_id, date_trunc('month', order_ts) AS month
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-01-01'
)
SELECT a.month,
       COUNT(*)                                  AS active_customers,
       COUNT(n.customer_id)                      AS retained_next_month,
       ROUND(100.0 * COUNT(n.customer_id) / COUNT(*), 1) AS retention_pct
FROM active a
LEFT JOIN active n
       ON n.customer_id = a.customer_id
      AND n.month = a.month + INTERVAL 1 MONTH
GROUP BY a.month
ORDER BY a.month;
```

Customers active this month but not next are the churned ones; flip the join to an anti join to list them. Signup cohorts work the same way with the first order month as the starting point. Handbook 13 builds the full growth-accounting picture (new, retained, resurrected, churned) on top of this.

## Durations and overlaps

```sql
SELECT trip_id, pickup_ts, dropoff_ts,
       DATE_DIFF('minute', pickup_ts, dropoff_ts) AS minutes
FROM taxi_trips
WHERE dropoff_ts <= pickup_ts OR DATE_DIFF('minute', pickup_ts, dropoff_ts) > 300
LIMIT 10;
```

A quality check like this catches trips that end before they start or last five hours. Two intervals overlap when `a.start < b.end AND b.start < a.end`, the condition behind practice 48 (overlapping bookings).

## Common mistakes

- **BETWEEN on timestamps.** Drops most of the last day.
- **Grouping by month number** across years.
- **CURRENT_DATE inside a pipeline.** Reruns and backfills load the wrong window. Use the run date.
- **Mixing UTC and local time** in one table. Daily totals shift by five and a half hours.
- **Casting a string date without a format.** Is `03/04/2025` 3 April or 4 March? Use `strptime(s, '%d/%m/%Y')` (Spark: `to_date(s, 'dd/MM/yyyy')`).

## In the interview

**"Month-over-month retention."** One row per user per month, join each month to the next on user, divide. Say how you treat a user who skips a month and returns: that's "resurrected", not retained.

**"How do you make a daily job safe to rerun?"** A half-open window driven by the run date, and an overwrite of exactly that partition. No CURRENT_DATE.

```quiz
You group 2024 and 2025 orders by `EXTRACT(month FROM order_ts)`. What goes wrong?
- Nothing
* January 2024 and January 2025 are added together
- The query fails on leap years
> Group by `date_trunc('month', order_ts)`, which keeps the year.
---
Why shouldn't a daily pipeline filter with `CURRENT_DATE - 1`?
- CURRENT_DATE is slow
* A rerun or backfill for an old date loads the wrong day
- It doesn't work in Spark
> Drive the window from the scheduler's run date so every run is repeatable.
---
When do intervals [a_start, a_end) and [b_start, b_end) overlap?
- a_start = b_start
* a_start < b_end AND b_start < a_end
- a_end > b_end
> Each must start before the other ends. This covers every overlap shape.
```

```practice
sql 16
sql 11
sql 43
sql 44
sql 45
sql 46
sql 50
sql 48
```
