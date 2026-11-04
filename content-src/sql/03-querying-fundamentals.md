# Querying fundamentals

By the end of this chapter you can filter, sort, compute and label rows, and you know the order in which the engine actually runs a query, which explains most beginner errors.

## The shape of a query

```sql
SELECT   customer_id,
         SUM(quantity * unit_price) AS gross
FROM     shop_orders
WHERE    order_ts >= TIMESTAMP '2025-01-01'
GROUP BY customer_id
HAVING   SUM(quantity * unit_price) > 50000
ORDER BY gross DESC
LIMIT    10;
```

That's the top 10 customers by gross spend in 2025, among those who spent more than ₹50,000. Each clause has one job.

## The order the engine runs it

You write SELECT first, but the engine runs it almost last:

1. `FROM` and `JOIN`: build the rows
2. `WHERE`: keep some rows
3. `GROUP BY`: form groups
4. `HAVING`: keep some groups
5. `SELECT`: compute the output columns, including window functions
6. `DISTINCT`: remove duplicate output rows
7. `ORDER BY`: sort
8. `LIMIT` / `OFFSET`: cut

This explains three rules that confuse beginners:

- **You can't use a SELECT alias in WHERE.** WHERE runs before SELECT, so the alias doesn't exist yet. (DuckDB is friendlier and allows it, but don't rely on that in interviews.)
- **You can't put an aggregate in WHERE.** Groups don't exist yet. Use HAVING.
- **You can't put a window function in WHERE.** Windows are computed in SELECT. Wrap the query, or use QUALIFY (chapter 9).

## Selecting and computing

```sql
SELECT order_id,
       quantity,
       unit_price,
       discount_pct,
       quantity * unit_price                              AS gross,
       quantity * unit_price * (1 - discount_pct / 100.0) AS net
FROM shop_orders
LIMIT 5;
```

Note `/ 100.0` and not `/ 100`. In Postgres and SQL Server, an integer divided by an integer is an integer: `15 / 100` is `0`, and every discount would vanish. DuckDB, Spark, Snowflake and BigQuery return a fraction there, but writing `100.0` makes your SQL correct everywhere.

## Filtering with WHERE

```sql
SELECT order_id, order_ts, status, payment_method, channel
FROM shop_orders
WHERE status IN ('delivered', 'shipped')
  AND payment_method = 'UPI'
  AND channel <> 'marketplace'
  AND order_ts >= TIMESTAMP '2025-03-01'
  AND order_ts <  TIMESTAMP '2025-04-01'
LIMIT 20;
```

The operators you'll use daily:

| Operator | Example | Note |
|---|---|---|
| `=`, `<>` (or `!=`) | `status = 'delivered'` | text is case-sensitive in most engines |
| `<`, `<=`, `>`, `>=` | `order_ts >= TIMESTAMP '2025-03-01'` | |
| `BETWEEN a AND b` | `quantity BETWEEN 2 AND 5` | inclusive on both ends |
| `IN (...)` | `status IN ('shipped', 'delivered')` | a short list of values |
| `LIKE`, `ILIKE` | `email LIKE '%@example.com'` | `%` any characters, `_` exactly one. ILIKE ignores case. |
| `IS NULL`, `IS NOT NULL` | `city IS NULL` | `= NULL` never matches (chapter 4) |
| `AND`, `OR`, `NOT` | | AND binds tighter than OR: use brackets |

## Half-open date ranges

For a month of timestamps, use `>= start AND < next_start`:

```sql
SELECT COUNT(*) AS march_orders
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-03-01'
  AND order_ts <  TIMESTAMP '2025-04-01';
```

`BETWEEN '2025-03-01' AND '2025-03-31'` looks right but is wrong for timestamps: `'2025-03-31'` means midnight at the start of the 31st, so it drops almost a whole day of orders. Half-open ranges never overlap and never leave gaps, which is why pipelines use them for every incremental window.

## The AND/OR trap

```sql
-- Wrong: means "UPI orders that are delivered" OR "any cancelled order"
SELECT COUNT(*) FROM shop_orders
WHERE payment_method = 'UPI' AND status = 'delivered' OR status = 'cancelled';

-- Right: brackets say what you mean
SELECT COUNT(*) FROM shop_orders
WHERE payment_method = 'UPI' AND (status = 'delivered' OR status = 'cancelled');
```

Run both and compare the counts. Whenever you mix AND and OR, add brackets, even when you think you don't need them.

## Labelling with CASE

CASE turns values into categories:

```sql
SELECT order_id,
       quantity * unit_price AS gross,
       CASE
           WHEN quantity * unit_price >= 10000 THEN 'large'
           WHEN quantity * unit_price >= 1000  THEN 'medium'
           ELSE 'small'
       END AS order_size
FROM shop_orders
LIMIT 10;
```

CASE checks its branches top to bottom and stops at the first match, so put the strictest condition first. Without an ELSE, unmatched rows get NULL.

## Sorting, limiting and DISTINCT

```sql
SELECT DISTINCT channel, payment_method
FROM shop_orders
ORDER BY channel, payment_method;
```

- `ORDER BY` can sort by several columns, each `ASC` (default) or `DESC`.
- Without ORDER BY, row order is not guaranteed, not even between two runs of the same query.
- `LIMIT 10` without ORDER BY gives you *some* 10 rows, not the first 10.
- `DISTINCT` applies to the whole output row, not just the first column.

## Common mistakes

- **Integer division.** `discount_pct / 100` is 0 in Postgres and SQL Server. Write `100.0`.
- **BETWEEN on timestamps.** It drops most of the last day. Use half-open ranges.
- **Mixing AND and OR without brackets.**
- **`LIMIT` without `ORDER BY`** in a result someone will rely on.
- **`SELECT *` in pipelines.** A new source column silently changes your table. Name the columns.

## In the interview

**"In what order does SQL execute a query?"** FROM, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT. Then give a consequence: "That's why I can't filter on a window function in WHERE and need QUALIFY or a subquery."

**Follow-up: "WHERE or HAVING?"** WHERE filters rows before grouping, HAVING filters groups after. Filter in WHERE whenever you can: fewer rows reach the GROUP BY, so it's faster.

```quiz
Why does `SELECT quantity * 2 AS q2 FROM t WHERE q2 > 10` fail in most engines?
- Aliases can't contain digits
* WHERE runs before SELECT, so the alias doesn't exist yet
- WHERE can't compare numbers
> Logical order: FROM, WHERE, then SELECT. Repeat the expression in WHERE, or wrap the query.
---
You need all orders placed in March 2025. Which filter is correct for a TIMESTAMP column?
- `order_ts BETWEEN '2025-03-01' AND '2025-03-31'`
* `order_ts >= '2025-03-01' AND order_ts < '2025-04-01'`
- `order_ts LIKE '2025-03%'`
> BETWEEN stops at midnight at the start of 31 March. The half-open range covers every second of March.
---
In Postgres, what does `15 / 100` return?
* 0
- 0.15
- An error
> Integer divided by integer is integer division in Postgres and SQL Server. Write 15 / 100.0.
```

```practice
sql 70
sql 71
sql 11
```
