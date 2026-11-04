# Pattern library

By the end of this chapter you have a toolbox of the SQL patterns that solve most real pipeline and interview problems, each one runnable on the Playground tables. Most real transformation work is a few of these combined at the right grain.

## Latest row per key

The dedup that every CDC feed and every bronze-to-silver job needs. Order by the change time, then a tie-breaker:

```sql
SELECT *
FROM web_events
QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY event_ts DESC, session_id DESC) = 1
LIMIT 10;
```

## Change detection between two snapshots

Classify every key as inserted, deleted, updated or unchanged by comparing a hash of the tracked columns:

```sql
WITH yesterday(id, name, city) AS (VALUES (1, 'Asha', 'Pune'), (2, 'Ravi', 'Delhi'), (3, 'Meera', 'Goa')),
today(id, name, city)     AS (VALUES (1, 'Asha', 'Pune'), (2, 'Ravi', 'Mumbai'), (4, 'Kabir', 'Kochi')),
y AS (SELECT id, md5(concat_ws('|', name, city)) AS h FROM yesterday),
t AS (SELECT id, md5(concat_ws('|', name, city)) AS h FROM today)
SELECT COALESCE(t.id, y.id) AS id,
       CASE WHEN y.id IS NULL THEN 'INSERT'
            WHEN t.id IS NULL THEN 'DELETE'
            WHEN t.h <> y.h   THEN 'UPDATE'
            ELSE 'SAME' END AS change_type
FROM t
FULL JOIN y ON y.id = t.id
ORDER BY id;
```

`concat_ws` skips NULLs, so `('a', NULL)` and `(NULL, 'a')` would hash the same. In production, wrap each column in `COALESCE(col, '~')` before hashing.

## Fill missing days per group

```sql
WITH days AS (
    SELECT CAST(d AS DATE) AS day
    FROM generate_series(TIMESTAMP '2025-12-01', TIMESTAMP '2025-12-07', INTERVAL 1 DAY) t(d)
),
channels AS (SELECT DISTINCT channel FROM shop_orders),
sales AS (
    SELECT CAST(order_ts AS DATE) AS day, channel, COUNT(*) AS orders
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-12-01' AND order_ts < TIMESTAMP '2025-12-08'
      AND status = 'returned' AND quantity = 6
    GROUP BY ALL
)
SELECT d.day, c.channel, COALESCE(s.orders, 0) AS orders
FROM days d
CROSS JOIN channels c
LEFT JOIN sales s ON s.day = d.day AND s.channel = c.channel
ORDER BY d.day, c.channel;
```

## Sessionise clicks

A new session starts after 30 minutes of inactivity. Flag the starts with LAG, then running-sum the flags:

```sql
WITH clicks AS (
    SELECT user_id, event_ts
    FROM web_events
    WHERE user_id = 42
),
flagged AS (
    SELECT user_id, event_ts,
           CASE WHEN LAG(event_ts) OVER w IS NULL
                  OR event_ts - LAG(event_ts) OVER w > INTERVAL 30 MINUTE
                THEN 1 ELSE 0 END AS new_session
    FROM clicks
    WINDOW w AS (PARTITION BY user_id ORDER BY event_ts)
)
SELECT user_id,
       SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_ts) AS session_no,
       event_ts
FROM flagged
ORDER BY event_ts
LIMIT 15;
```

"Flag a change, then cumulative sum" is a general trick: it also groups consecutive status runs and price periods.

## Funnel conversion

```sql
WITH per_session AS (
    SELECT session_id,
           MAX(CASE WHEN event_type = 'page_view'   THEN 1 ELSE 0 END) AS viewed,
           MAX(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS carted,
           MAX(CASE WHEN event_type = 'checkout'    THEN 1 ELSE 0 END) AS checked_out,
           MAX(CASE WHEN event_type = 'purchase'    THEN 1 ELSE 0 END) AS purchased
    FROM web_events
    GROUP BY session_id
)
SELECT SUM(viewed)      AS viewed,
       SUM(carted)      AS carted,
       SUM(checked_out) AS checked_out,
       SUM(purchased)   AS purchased,
       ROUND(100.0 * SUM(purchased) / NULLIF(SUM(viewed), 0), 2) AS view_to_purchase_pct
FROM per_session;
```

A strict funnel also requires the steps in order; compare the timestamps of each step per session for that.

## Forward fill the last known value

```sql
WITH readings(device, ts, temp) AS (
    VALUES ('d1', 1, 30.5), ('d1', 2, NULL), ('d1', 3, NULL), ('d1', 4, 31.0), ('d1', 5, NULL)
)
SELECT device, ts, temp,
       LAST_VALUE(temp IGNORE NULLS) OVER (PARTITION BY device ORDER BY ts
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS temp_filled
FROM readings
ORDER BY ts;
```

Spark writes it `last(temp, true)`; Snowflake and BigQuery use `IGNORE NULLS` as here.

## Year over year

```sql
WITH m AS (
    SELECT date_trunc('month', order_ts) AS month, SUM(quantity * unit_price) AS revenue
    FROM shop_orders
    GROUP BY month
)
SELECT cur.month, cur.revenue, prev.revenue AS revenue_last_year,
       ROUND(100.0 * (cur.revenue - prev.revenue) / NULLIF(prev.revenue, 0), 1) AS yoy_pct
FROM m cur
LEFT JOIN m prev ON prev.month = cur.month - INTERVAL 1 YEAR
WHERE cur.month >= TIMESTAMP '2025-01-01'
ORDER BY cur.month;
```

A self join on "same month last year" is clearer than `LAG(revenue, 12)`, which silently compares the wrong months if one month is missing.

## Point-in-time join

Attach the version of a dimension that was valid when the fact happened (chapter 14):

```sql
WITH dim(customer_id, city, valid_from, valid_to) AS (
    VALUES (7, 'Mumbai', DATE '2024-01-01', DATE '2025-07-01'),
           (7, 'Pune',   DATE '2025-07-01', DATE '9999-12-31')
),
facts(order_id, customer_id, order_date) AS (
    VALUES (1, 7, DATE '2025-03-10'), (2, 7, DATE '2025-07-01'), (3, 7, DATE '2025-09-20')
)
SELECT f.order_id, f.order_date, d.city
FROM facts f
JOIN dim d
  ON d.customer_id = f.customer_id
 AND f.order_date >= d.valid_from
 AND f.order_date <  d.valid_to
ORDER BY f.order_id;
```

DuckDB also has `ASOF JOIN`, and Spark has a similar function for time series. The range join above works everywhere.

## Pairs bought together

```sql
WITH baskets AS (
    SELECT DISTINCT customer_id, product_id
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-01-01'
)
SELECT a.product_id AS product_a, b.product_id AS product_b, COUNT(*) AS together
FROM baskets a
JOIN baskets b
  ON b.customer_id = a.customer_id
 AND a.product_id < b.product_id
GROUP BY ALL
ORDER BY together DESC
LIMIT 10;
```

Here a basket is everything a customer bought in 2025; in a real shop it would be one order or one session. `a.product_id < b.product_id` keeps each pair once and drops a product paired with itself. Self joins grow quickly, so filter to a small window first.

## Growth accounting

Label every customer each month as new, retained, resurrected or churned. Handbook 13 builds the full report; the core is a comparison of this month's activity with the history:

```sql
WITH active AS (
    SELECT DISTINCT customer_id, date_trunc('month', order_ts) AS month
    FROM shop_orders
    WHERE customer_id <= 2000
),
labelled AS (
    SELECT a.customer_id, a.month,
           MIN(a.month) OVER (PARTITION BY a.customer_id) AS first_month,
           LAG(a.month) OVER (PARTITION BY a.customer_id ORDER BY a.month) AS prev_active
    FROM active a
)
SELECT month,
       COUNT(*) FILTER (WHERE month = first_month)                                AS new_customers,
       COUNT(*) FILTER (WHERE prev_active = month - INTERVAL 1 MONTH)             AS retained,
       COUNT(*) FILTER (WHERE prev_active < month - INTERVAL 1 MONTH)             AS resurrected
FROM labelled
GROUP BY month
ORDER BY month
LIMIT 12;
```

Churned customers are the ones active last month and missing this month, found with the anti join from chapter 10.

## How to use this toolbox

When a new problem arrives, ask which patterns it combines. "Weekly active users who came back after a break, by city" is growth accounting plus a dimension join plus date truncation. Name the grain, pick the patterns, then write one CTE per step.

```quiz
To dedupe a CDC feed to the latest row per key, what should the window ORDER BY include?
- Only the key
* The change timestamp descending, plus a tie-breaker
- Nothing, ROW_NUMBER picks the newest
> Without a tie-breaker, two rows with the same timestamp make the result change between runs.
---
What does the "flag, then cumulative sum" trick do in sessionisation?
* Turns session-start flags into a running session number for every click
- Counts all clicks per user
- Removes duplicate clicks
> Each new-session flag increments the running sum, so all clicks in one session share a number.
---
Why compare with the same month last year by a self join rather than LAG(revenue, 12)?
- LAG is slower
* If a month is missing, LAG(…, 12) compares against the wrong month
- LAG doesn't work on dates
> A join on the actual month value is always correct, even with gaps.
```

```practice
sql 34
sql 47
sql 58
sql 41
sql 45
sql 61
```
