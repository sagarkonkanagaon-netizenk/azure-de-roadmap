# Query performance

By the end of this chapter you can read a query plan, find where the time goes, and apply the handful of fixes that solve most slow queries on warehouses and lakehouses: read less data, shuffle less data, and do less work twice.

## How analytical engines spend time

Columnar engines (DuckDB, Spark, Snowflake, BigQuery, Databricks SQL, Synapse) store each column separately, compressed, in files split into chunks with min/max statistics. Almost every speed-up comes from three ideas:

1. **Read less:** fewer columns, fewer files, fewer row groups.
2. **Move less:** shuffles and big joins are the expensive steps on a cluster.
3. **Compute once:** don't recompute the same heavy result for every query.

## Read the plan

```sql
EXPLAIN
SELECT channel, SUM(quantity * unit_price) AS gross
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-12-01'
GROUP BY channel;
```

`EXPLAIN` shows the plan the optimiser chose without running it. `EXPLAIN ANALYZE` runs it and adds the real time and row count per step:

```sql
EXPLAIN ANALYZE
SELECT channel, SUM(quantity * unit_price) AS gross
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-12-01'
GROUP BY channel;
```

Read it bottom up: the scan, then the filter, then the aggregate. Look for three things: the step with the most time, a step whose row count is far larger than you expected (a fan-out join or a missing filter), and a filter that runs after the scan instead of inside it. In Spark the same information is in `df.explain('formatted')` and the SQL tab of the Spark UI (handbook 5).

## Fix 1: select only the columns you need

```sql
-- Reads every column of a million rows
SELECT * FROM shop_orders WHERE status = 'returned' LIMIT 5;

-- Reads two columns
SELECT order_id, order_ts FROM shop_orders WHERE status = 'returned' LIMIT 5;
```

In a columnar store, unread columns are never touched on disk. On BigQuery and Synapse serverless you're billed by bytes scanned, so `SELECT *` is literally more expensive.

## Fix 2: let filters skip data

Engines skip files and row groups whose min/max statistics can't match your filter, and they skip whole folders when a table is partitioned by the filtered column. That only works when the filter is on the raw column:

```sql
-- Can skip: compares the stored column to constants
SELECT COUNT(*) FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-12-01' AND order_ts < TIMESTAMP '2026-01-01';

-- Harder to skip: a function wraps the column
SELECT COUNT(*) FROM shop_orders
WHERE strftime(order_ts, '%Y-%m') = '2025-12';
```

Both return the same count. The first form lets the engine prune; the second makes it compute the function for every row first. Write filters as ranges on the stored column.

**Partitioning** splits a table into folders by a column, usually a date. Pick a column almost every query filters on, with a manageable number of values: daily partitions over years is fine, partitioning by customer_id creates millions of tiny folders and is far slower. On Delta, **Z-ordering** or **liquid clustering** co-locate rows by a second column so file skipping works on it too.

## Fix 3: join smart

- **Filter and aggregate before joining.** Shrink both sides first.
- **Broadcast small tables.** Copying a 5,000-row product table to every worker avoids shuffling a billion-row fact. Spark does it automatically below a size threshold and accepts a `BROADCAST` hint.
- **Join on the same types.** A string key against an integer key forces a cast on every row.
- **Watch for skew.** If one customer has 30% of the orders, one task does 30% of the work. Spark's adaptive query execution (AQE) splits skewed partitions; salting the key is the manual fix.

```sql
WITH small_orders AS (
    SELECT product_id, SUM(quantity * unit_price) AS gross
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-12-01'
    GROUP BY product_id
)
SELECT p.category, SUM(s.gross) AS gross
FROM small_orders s
JOIN shop_products p ON p.product_id = s.product_id
GROUP BY p.category
ORDER BY gross DESC;
```

The fact is aggregated to 5,000 rows before it meets the product table.

## Fix 4: compute once

- A heavy CTE referenced three times: materialise it (chapter 7).
- A dashboard query run every minute over raw data: build a gold aggregate table (chapter 15).
- Spark DataFrames reused in several actions: `cache()` them, then `unpersist()`.

## Fix 5: keep files healthy

Lakehouse tables slow down when they collect thousands of tiny files from streaming or frequent small appends. Each file costs a request and a footer read. Compact them with `OPTIMIZE` on Delta (or auto-compaction), aim for files of roughly 100 MB to 1 GB, and clean up old versions with `VACUUM` after your time travel window.

## A debugging routine

When someone says "this query got slow":

1. Did the data grow, or did the query or plan change? Compare row counts and the plan with last week's.
2. Run EXPLAIN ANALYZE. Find the slowest step and the biggest row count.
3. Check filters are prunable and columns are selected, not starred.
4. Check join row counts for fan-out, and key types.
5. Check for skew and small files.
6. Only then add resources. A bigger cluster for a bad plan just burns more money faster.

## Common mistakes

- **`SELECT *` in production queries.**
- **Functions on filtered columns** that block pruning.
- **Over-partitioning** into millions of small folders.
- **DISTINCT to fix a fan-out** instead of fixing the join.
- **Scaling the cluster first.**

## In the interview

**"A query got slow. How do you debug it?"** Walk through the routine above, in order, and name one concrete fix for each finding. Practice 78 is this question.

**"Why does this query scan the whole table?"** Usually a function around the partition or filter column, an implicit cast, or `SELECT *`. Rewrite as a range on the raw column. Practice 69 asks exactly this.

```quiz
Which filter lets the engine skip partitions of a table partitioned by order_date?
- `WHERE year(order_date) = 2025`
* `WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'`
- `WHERE CAST(order_date AS VARCHAR) LIKE '2025%'`
> Compare the raw column with constants. A function or cast around it hides it from pruning.
---
A 2-billion-row fact joins a 5,000-row product table in Spark. What's the usual best strategy?
- Sort-merge join
* Broadcast the product table
- Cross join
> Copying the small table to every executor avoids shuffling the huge one.
---
A query slowed down after a month of streaming writes into a Delta table. What's a likely cause?
- The SQL changed
* Thousands of small files; compact them with OPTIMIZE
- Delta tables slow down with age
> Many tiny files mean many reads and footers. Compaction restores large files.
```

```practice
sql 69
sql 78
```
