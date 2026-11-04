# Views, materialized views and temporary objects

By the end of this chapter you can choose between a view, a materialized view, a table and a temp table for any piece of logic, and you know what each one costs when the data grows.

## Four ways to save a query

| Object | Stores data? | Fresh? | Cost |
|---|---|---|---|
| View | no, just the SQL | always, recomputed on every read | every query pays the full compute |
| Materialized view | yes | refreshed on a schedule or incrementally | storage plus refresh |
| Table (built by a job) | yes | as fresh as the last job run | storage plus the job |
| Temp table | yes, for this session only | as of when you created it | gone when the session ends |

## Views

```sql
CREATE VIEW v_delivered_orders AS
SELECT order_id, customer_id, order_ts,
       quantity * unit_price AS gross
FROM shop_orders
WHERE status = 'delivered';

SELECT date_trunc('month', order_ts) AS month, SUM(gross) AS gross
FROM v_delivered_orders
WHERE order_ts >= TIMESTAMP '2025-10-01'
GROUP BY month
ORDER BY month;
```

A view gives logic a name and one place to change it. The optimiser merges the view's SQL into your query, so the outer filter still prunes data. Good uses:

- One agreed definition, such as "a delivered order", that everyone queries.
- Hiding columns or rows for security: a view that leaves out email and phone.
- A stable interface: rename a source column underneath, and the view keeps the old name.

Watch for views built on views built on views. Each layer looks cheap, but the final query can be enormous and slow, and nobody can read it.

## Materialized views

A materialized view stores its result and refreshes it:

```sql norun
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT CAST(order_ts AS DATE) AS day, channel, SUM(quantity * unit_price) AS gross
FROM shop_orders
GROUP BY ALL;
```

Reads are fast because the work is done in advance. Engines differ a lot: Snowflake and BigQuery refresh automatically with restrictions on the SQL allowed; Databricks materialized views refresh in a Lakeflow pipeline and can update incrementally; Postgres needs an explicit `REFRESH MATERIALIZED VIEW`. DuckDB doesn't have them, which is why this block doesn't run here. Check the engine's limits before relying on one.

In practice many teams skip materialized views and build a gold table with a scheduled job or a dbt model, which gives them full control over refresh, testing and backfills.

## Temp tables

```sql
CREATE TEMP TABLE big_spenders AS
SELECT customer_id, SUM(quantity * unit_price) AS gross
FROM shop_orders
GROUP BY customer_id
HAVING SUM(quantity * unit_price) > 3000000;

SELECT COUNT(*) AS customers, ROUND(AVG(gross)) AS avg_gross FROM big_spenders;
```

A temp table holds an intermediate result for the rest of your session: compute once, query many times, inspect while debugging. In Spark, `df.createOrReplaceTempView('name')` gives a DataFrame a name for SQL, but it's a view, not stored data. Add `.cache()` if you'll reuse it (handbook 5).

## Choosing

- Logic used in one query: a CTE (chapter 7).
- Logic shared by many queries and cheap to compute: a view.
- Expensive logic read many times: a table built by a job, or a materialized view if the engine's refresh fits.
- Scratch work in one session: a temp table.

## Common mistakes

- **A view over a 1-billion-row table** queried by a dashboard every minute. Every refresh pays for the full scan.
- **`SELECT *` in a view.** In some engines the column list is fixed when the view is created, so new source columns don't appear, or a dropped column breaks the view.
- **Expecting a temp table to exist in the next job.** It's gone when the session ends.
- **Deep view chains** nobody can debug.

## In the interview

**"View vs materialized view?"** A view stores only SQL and recomputes on every read; a materialized view stores the result and refreshes it. Trade freshness and compute against storage and staleness, and name the engine's refresh behaviour.

**"CTE vs temp table?"** A CTE lives in one query and may be recomputed; a temp table lives for the session and is computed once.

```quiz
A dashboard reads a view over a 2-billion-row table 500 times a day. What's the main problem?
- Views can't be read that often
* Every read recomputes the full query, paying for the scan each time
- The view will go out of date
> Precompute: a gold table built by a job, or a materialized view.
---
Which object disappears when your session ends?
- A view
- A materialized view
* A temp table
> Temp tables are session-scoped. Views and materialized views are saved in the catalog.
---
What does `df.createOrReplaceTempView('orders')` do in Spark?
* Gives the DataFrame a name you can query with SQL in this session
- Writes the data to disk
- Creates a permanent table
> It's a named view of the DataFrame's plan, not stored data. Use cache() or a table to store it.
```

```practice
sql 77
sql 69
```
