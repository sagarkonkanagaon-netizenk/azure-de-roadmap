# Window functions

By the end of this chapter you can rank, number, compare and accumulate rows without losing detail, deduplicate with ROW_NUMBER, control window frames, and solve the gaps-and-islands questions that every DE interview loves.

## What a window function does

GROUP BY collapses rows. A window function keeps every row and adds a value computed over a set of related rows, the "window". That's why it's the tool for "rank within", "previous value", "running total" and "latest per key".

```sql
SELECT order_id, customer_id, order_ts,
       quantity * unit_price AS gross,
       SUM(quantity * unit_price) OVER (PARTITION BY customer_id) AS customer_total,
       COUNT(*)                   OVER (PARTITION BY customer_id) AS customer_orders
FROM shop_orders
WHERE customer_id IN (101, 102)
ORDER BY customer_id, order_ts
LIMIT 12;
```

The anatomy: `function() OVER (PARTITION BY ... ORDER BY ... frame)`.

- **PARTITION BY** splits rows into groups, like GROUP BY but without collapsing.
- **ORDER BY** sets the order inside each partition.
- **The frame** picks which rows around the current one count (see below).

## Ranking: ROW_NUMBER, RANK, DENSE_RANK

```sql
SELECT score,
       ROW_NUMBER() OVER (ORDER BY score DESC) AS row_number,
       RANK()       OVER (ORDER BY score DESC) AS rank,
       DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank
FROM (VALUES (100), (100), (90), (80)) t(score);
```

| Function | Ties | After a tie of two at 1st |
|---|---|---|
| `ROW_NUMBER` | always unique, ties broken arbitrarily | 1, 2, 3 |
| `RANK` | ties share, then skips | 1, 1, 3 |
| `DENSE_RANK` | ties share, no gaps | 1, 1, 2 |

For "top 3 per group", decide what a tie should do before choosing. "Top 3 products by revenue in each category" with DENSE_RANK can return more than 3 rows when there are ties, and that's often what the business wants.

## Top N per group

```sql
WITH product_sales AS (
    SELECT p.category, p.product_name,
           SUM(o.quantity * o.unit_price) AS gross
    FROM shop_orders o
    JOIN shop_products p ON p.product_id = o.product_id
    WHERE o.status = 'delivered'
    GROUP BY p.category, p.product_name
)
SELECT category, product_name, gross,
       RANK() OVER (PARTITION BY category ORDER BY gross DESC) AS rnk
FROM product_sales
QUALIFY rnk <= 3
ORDER BY category, rnk;
```

`QUALIFY` filters on a window result, the way HAVING filters on an aggregate. It works in DuckDB, Databricks, Snowflake and BigQuery. In Postgres, SQL Server and older Spark, wrap the query and filter in the outer WHERE.

## Deduplicate: latest row per key

This is the single most used window pattern in data engineering. Web events arrive twice sometimes; keep one per event_id:

```sql
SELECT COUNT(*) AS rows_before,
       COUNT(DISTINCT event_id) AS unique_events
FROM web_events;
```

```sql
SELECT event_id, user_id, event_ts, event_type
FROM web_events
QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY event_ts DESC) = 1
LIMIT 10;
```

The same shape keeps the latest version of each customer in a CDC feed: partition by the business key, order by the update timestamp descending, keep row 1. Always add a tie-breaker to the ORDER BY (an ingestion id or file name). With a tie, ROW_NUMBER picks arbitrarily and the "latest" row can change between runs.

## LAG and LEAD: compare with neighbours

```sql
WITH daily AS (
    SELECT CAST(order_ts AS DATE) AS day,
           SUM(quantity * unit_price) AS revenue
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-03-01' AND order_ts < TIMESTAMP '2025-03-15'
    GROUP BY day
)
SELECT day, revenue,
       LAG(revenue) OVER (ORDER BY day)                         AS prev_day,
       revenue - LAG(revenue) OVER (ORDER BY day)               AS change,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY day))
             / LAG(revenue) OVER (ORDER BY day), 1)             AS change_pct
FROM daily
ORDER BY day;
```

`LAG(col, n, default)` looks n rows back; `LEAD` looks forward. The first row has no previous one, so LAG returns NULL unless you give a default.

```sql
-- Days between a customer's consecutive orders
SELECT customer_id, order_ts,
       DATE_DIFF('day', LAG(order_ts) OVER (PARTITION BY customer_id ORDER BY order_ts), order_ts) AS days_since_prev
FROM shop_orders
WHERE customer_id = 101
ORDER BY order_ts
LIMIT 10;
```

## Running totals and moving averages: frames

With an ORDER BY, aggregate windows become cumulative. The frame says exactly which rows count:

```sql
WITH daily AS (
    SELECT CAST(order_ts AS DATE) AS day, COUNT(*) AS orders
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-01-01' AND order_ts < TIMESTAMP '2025-02-01'
    GROUP BY day
)
SELECT day, orders,
       SUM(orders) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
       ROUND(AVG(orders) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) AS moving_avg_7d,
       SUM(orders) OVER (PARTITION BY date_trunc('week', day) ORDER BY day) AS week_to_date
FROM daily
ORDER BY day;
```

**ROWS vs RANGE.** `ROWS` counts physical rows. `RANGE` groups rows with equal ORDER BY values. The default frame when you write ORDER BY without a frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, so tied rows all get the same running total, which surprises people:

```sql
SELECT day, amount,
       SUM(amount) OVER (ORDER BY day)                                          AS default_range,
       SUM(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_frame
FROM (VALUES (1, 10), (2, 20), (2, 30), (3, 40)) t(day, amount);
```

Write the frame explicitly whenever you mean ROWS. A 7-day moving average over ROWS is only correct if every day has a row, so fill missing days first (chapter 5's cross join, or chapter 10).

## FIRST_VALUE, LAST_VALUE, NTILE

```sql
SELECT customer_id,
       quantity * unit_price AS gross,
       FIRST_VALUE(quantity * unit_price) OVER w AS first_order_value,
       LAST_VALUE(quantity * unit_price)  OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_order_value
FROM shop_orders
WHERE customer_id = 101
WINDOW w AS (PARTITION BY customer_id ORDER BY order_ts)
ORDER BY order_ts
LIMIT 5;
```

LAST_VALUE with the default frame only sees up to the current row, so it just returns the current row. Give it the full frame, as above. `NTILE(4)` splits rows into four nearly equal buckets: quartiles of customer spend in practice 36.

## Gaps and islands

"Users who were active 3 or more days in a row" is the classic. The trick: for consecutive dates, `date - ROW_NUMBER()` is constant, so it labels each streak.

```sql
WITH days AS (
    SELECT DISTINCT user_id, CAST(event_ts AS DATE) AS day
    FROM web_events
    WHERE user_id IS NOT NULL AND user_id <= 200
),
grouped AS (
    SELECT user_id, day,
           day - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS INTEGER) AS streak_id
    FROM days
)
SELECT user_id, MIN(day) AS streak_start, MAX(day) AS streak_end, COUNT(*) AS days
FROM grouped
GROUP BY user_id, streak_id
HAVING COUNT(*) >= 3
ORDER BY days DESC, user_id
LIMIT 10;
```

The same idea collapses consecutive numbers into ranges (practice 49) and finds the longest streak (practice 42). The other gaps-and-islands tool is "flag a change with LAG, then running-sum the flags", which builds sessions from clicks (practice 47).

## Performance notes

- Every distinct `PARTITION BY ... ORDER BY` needs its own sort. Reuse one window definition with `WINDOW w AS (...)` when you can.
- A window with no PARTITION BY puts every row into one partition. In Spark that means one task processes the whole table, and you'll see the warning "No Partition Defined for Window operation". Partition by something whenever the question allows it.
- Filtering before the window (in WHERE) is cheaper than filtering after (in QUALIFY).

## Common mistakes

- **ROW_NUMBER without a tie-breaker** in dedup logic. Results change between runs.
- **Filtering a window result in WHERE.** Use QUALIFY or an outer query.
- **LAST_VALUE with the default frame.**
- **Moving averages over ROWS with missing days.**
- **Expecting a window to collapse rows.** Add DISTINCT or group afterwards if you need one row per partition.

## In the interview

**"ROW_NUMBER vs RANK vs DENSE_RANK on 100, 100, 90?"** 1, 2, 3; 1, 1, 3; 1, 1, 2. Then say which you'd use for "top 3 salaries per department" and why ties matter.

**"Remove duplicates, keep the latest."** ROW_NUMBER over the key, ordered by timestamp descending with a tie-breaker, keep 1. Mention QUALIFY and that this is how you'd dedup a CDC feed before a MERGE.

**"Users who logged in 3 days in a row."** The date minus ROW_NUMBER trick. Explain why it works, not just the code.

```quiz
Scores are 100, 100 and 90. What does DENSE_RANK() OVER (ORDER BY score DESC) return?
- 1, 2, 3
- 1, 1, 3
* 1, 1, 2
> DENSE_RANK shares ranks on ties and leaves no gap. RANK would give 1, 1, 3.
---
`SUM(x) OVER (ORDER BY day)` gives two rows with the same day the same running total. Why?
- It's a bug in the engine
* The default frame is RANGE, which treats rows with equal ORDER BY values as one step
- SUM ignores duplicates
> Write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` to count physical rows one by one.
---
Why does `date - ROW_NUMBER()` find streaks of consecutive days?
- ROW_NUMBER skips missing days
* Within a streak both rise by 1 each row, so the difference stays the same and labels the streak
- It only works on weekdays
> When a day is missing, the date jumps by more than the row number does, so the difference changes and a new streak starts.
```

```practice
sql 27
sql 28
sql 34
sql 67
sql 25
sql 26
sql 29
sql 30
sql 31
sql 33
sql 36
sql 38
sql 40
sql 41
sql 42
sql 47
```
