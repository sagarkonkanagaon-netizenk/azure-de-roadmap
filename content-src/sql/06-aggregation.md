# Aggregation

By the end of this chapter you can turn a million rows into the handful of numbers a business asks for, count several things in one pass, build subtotals, and explain why the average order value can mislead.

## GROUP BY in one picture

GROUP BY collapses rows that share the same values into one row per group, and aggregate functions summarise each group:

```sql
SELECT channel,
       COUNT(*)                         AS orders,
       SUM(quantity * unit_price)       AS gross,
       ROUND(AVG(quantity * unit_price)) AS avg_order_value
FROM shop_orders
GROUP BY channel
ORDER BY gross DESC;
```

The rule: every column in SELECT is either in GROUP BY or inside an aggregate. Otherwise the engine doesn't know which of the many values to show. DuckDB, Databricks and Snowflake accept `GROUP BY ALL`, which groups by every non-aggregated column for you.

## The aggregate functions you'll use

| Function | Returns | Watch out |
|---|---|---|
| `COUNT(*)` | rows | counts NULL rows too |
| `COUNT(col)` | non-NULL values | |
| `COUNT(DISTINCT col)` | distinct non-NULL values | expensive on big data: see below |
| `SUM`, `AVG` | total, mean | ignore NULLs |
| `MIN`, `MAX` | smallest, largest | work on dates and text too |
| `MEDIAN`, `quantile_cont(col, 0.9)` | middle, 90th percentile | names differ by engine |
| `STRING_AGG(col, ', ')` | values joined into text | `LISTAGG` in Snowflake, `collect_list` in Spark |

## Mean versus median

```sql
SELECT ROUND(AVG(quantity * unit_price))                AS mean_order,
       quantile_cont(quantity * unit_price, 0.5)        AS median_order,
       quantile_cont(quantity * unit_price, 0.9)        AS p90_order
FROM shop_orders;
```

The mean is about ₹37,000 but the median is about ₹21,000. A few very large orders pull the mean up. When someone asks for a "typical" order, give the median and say why. The same goes for latency, delivery time and salaries.

## Count many things in one pass

A dashboard often needs several counts. Don't write five queries; use FILTER (DuckDB, Postgres, Spark 3.2+) or CASE inside the aggregate (works everywhere):

```sql
SELECT COUNT(*)                                        AS orders,
       COUNT(*) FILTER (WHERE status = 'delivered')    AS delivered,
       COUNT(*) FILTER (WHERE status = 'cancelled')    AS cancelled,
       SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'cancelled') / COUNT(*), 2) AS cancel_rate_pct
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-01-01';
```

One scan of the table instead of five. On a warehouse that bills by data scanned, that's five times cheaper.

## HAVING filters groups

```sql
SELECT customer_id,
       COUNT(*)                   AS orders,
       SUM(quantity * unit_price) AS gross
FROM shop_orders
WHERE status = 'delivered'
GROUP BY customer_id
HAVING COUNT(*) >= 20
ORDER BY gross DESC
LIMIT 10;
```

WHERE removes cancelled orders before grouping; HAVING keeps only customers with 20 or more delivered orders after grouping. Put every condition you can in WHERE, because fewer rows reach the grouping step.

## Shares of a total

"What share of revenue does each payment method bring?" needs the group total and the grand total together. A window over the grouped result does it in one query:

```sql
SELECT payment_method,
       SUM(quantity * unit_price) AS gross,
       ROUND(100.0 * SUM(quantity * unit_price)
             / SUM(SUM(quantity * unit_price)) OVER (), 1) AS share_pct
FROM shop_orders
GROUP BY payment_method
ORDER BY gross DESC;
```

`SUM(SUM(...)) OVER ()` looks strange: the inner SUM is the group total, the outer window SUM adds up all groups. Window functions get their own chapter (9).

## Subtotals with ROLLUP

Finance reports want subtotals and a grand total. ROLLUP adds them:

```sql
SELECT channel,
       payment_method,
       COUNT(*) AS orders
FROM shop_orders
GROUP BY ROLLUP (channel, payment_method)
ORDER BY channel NULLS LAST, payment_method NULLS LAST;
```

Rows where payment_method is NULL are channel subtotals; the row where both are NULL is the grand total. `CUBE` gives subtotals for every combination, and `GROUPING SETS` lets you list exactly the ones you want. Use `GROUPING(col)` to tell a subtotal NULL from a real NULL.

## Pivoting rows into columns

```sql
SELECT channel,
       COUNT(*) FILTER (WHERE payment_method = 'UPI')  AS upi,
       COUNT(*) FILTER (WHERE payment_method = 'Card') AS card,
       COUNT(*) FILTER (WHERE payment_method = 'Cash on delivery') AS cod
FROM shop_orders
GROUP BY channel
ORDER BY channel;
```

Conditional aggregation is the portable pivot. Many engines also have a `PIVOT` keyword, but its syntax differs everywhere (chapter 19).

## Counting distinct values at scale

`COUNT(DISTINCT user_id)` has to remember every value it has seen, which is slow and memory-hungry on billions of rows. When an exact number isn't needed, use an approximate count:

```sql
SELECT COUNT(DISTINCT user_id)        AS exact_users,
       approx_count_distinct(user_id) AS approx_users
FROM web_events;
```

The approximate version uses a HyperLogLog sketch. On this table it lands a few percent off the exact count but needs only a few kilobytes of memory however many values there are. Use it for dashboards and monitoring, never for billing or reconciliation. Spark, Databricks, BigQuery and Snowflake all have it under similar names.

## Common mistakes

- **A column in SELECT that isn't grouped or aggregated.** Most engines refuse; MySQL used to pick a random value.
- **AVG of an average.** The average of daily averages is not the overall average when days have different volumes. Sum and count separately, then divide.
- **COUNT(*) after a join** that fanned out (chapter 5).
- **Integer division in rates.** Multiply by `100.0`.
- **Grouping by a timestamp** when you meant a day. Use `date_trunc('day', order_ts)` (chapter 10).

## In the interview

**"WHERE or HAVING?"** WHERE filters rows before grouping; HAVING filters groups after. Then mention the performance reason.

**"How would you count orders per status in a single row?"** Conditional aggregation with FILTER or CASE, one scan. Practice 23 is this exact question.

**"Why is your average different from finance's?"** Probably one of: NULL handling, cancelled orders included or not, or an average of averages. Asking which definition they use is the senior answer.

```quiz
Daily average order values are ₹100 (10 orders) and ₹200 (90 orders). What is the overall average order value?
- ₹150
* ₹190
- ₹200
> Total value is 10 × 100 + 90 × 200 = 19,000 over 100 orders. Averaging the two averages gives the wrong ₹150.
---
Which query keeps only customers with at least 5 orders?
- `... WHERE COUNT(*) >= 5 GROUP BY customer_id`
* `... GROUP BY customer_id HAVING COUNT(*) >= 5`
- `... GROUP BY customer_id WHERE COUNT(*) >= 5`
> Aggregates can't go in WHERE, because groups don't exist yet when WHERE runs.
---
After `GROUP BY ROLLUP (channel, payment_method)`, what does a row with channel = 'app' and payment_method NULL mean?
- Orders from the app with no payment method recorded
* The subtotal for all app orders
- The grand total
> ROLLUP adds a subtotal per channel and a grand total. Use GROUPING() to tell it from a real NULL.
```

```practice
sql 23
sql 16
sql 17
sql 22
sql 15
sql 20
sql 24
sql 72
```
