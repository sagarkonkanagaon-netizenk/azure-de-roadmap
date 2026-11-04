# Loading data: DML and pipeline patterns

By the end of this chapter you can write the four load patterns every pipeline uses (full refresh, append, upsert, delete-and-insert), make a load safe to rerun, and load only what changed since last time.

## The DML statements

```sql
CREATE TABLE stage_customers AS
SELECT customer_id, full_name, city, segment
FROM shop_customers
WHERE customer_id <= 5;

INSERT INTO stage_customers VALUES (100001, 'New Person', 'Goa', 'Consumer');

UPDATE stage_customers SET city = 'Pune' WHERE customer_id = 1;

DELETE FROM stage_customers WHERE customer_id = 2;

SELECT * FROM stage_customers ORDER BY customer_id;
```

| Statement | Removes | Can roll back? | Speed on big tables |
|---|---|---|---|
| `DELETE FROM t WHERE ...` | chosen rows | yes | slow: row by row, logged |
| `TRUNCATE TABLE t` | all rows, keeps the table | depends on engine | fast |
| `DROP TABLE t` | the table and its definition | depends on engine | fast |

On a lakehouse table (Delta, Iceberg), DELETE and UPDATE rewrite the affected files. That's why partitioning and file layout matter for load speed (chapter 17).

## Pattern 1: full refresh

Rebuild the whole table every run:

```sql
CREATE OR REPLACE TABLE dim_product AS
SELECT product_id, product_name, category, brand, list_price
FROM shop_products;

SELECT COUNT(*) AS rows_loaded FROM dim_product;
```

Simple and always correct, because it can't drift from the source. Use it for small dimensions and anything under a few million rows. It stops scaling when the source is large or keeps history the source no longer has.

## Pattern 2: append

Add new rows, never change old ones. Right for immutable events like clicks and payments. The danger is running the same batch twice. Make appends safe with a check on a batch or event key:

```sql
CREATE TABLE fact_events AS
SELECT * FROM web_events WHERE event_ts < TIMESTAMP '2025-01-02';

-- A batch that overlaps what we already loaded
INSERT INTO fact_events
SELECT n.*
FROM web_events n
WHERE n.event_ts >= TIMESTAMP '2025-01-01 12:00:00'
  AND n.event_ts <  TIMESTAMP '2025-01-03'
  AND NOT EXISTS (SELECT 1 FROM fact_events f WHERE f.event_id = n.event_id);

SELECT COUNT(*) AS loaded, COUNT(DISTINCT event_id) AS unique_events FROM fact_events;
```

The overlap between the two batches didn't create new duplicates. The source itself has duplicate event_ids, which is why the two counts still differ: dedupe the batch with ROW_NUMBER (chapter 9) before inserting.

## Pattern 3: upsert with MERGE

Update rows that exist, insert rows that don't. This is SCD Type 1 and the standard way to apply a CDC feed:

```sql
CREATE TABLE dim_customer AS
SELECT customer_id, full_name, city FROM shop_customers WHERE customer_id <= 3;

CREATE TABLE changes(customer_id INTEGER, full_name VARCHAR, city VARCHAR);
INSERT INTO changes VALUES (1, 'Zoya Singh', 'Nagpur'), (4, 'Brand New', 'Goa');

MERGE INTO dim_customer t
USING changes s
   ON t.customer_id = s.customer_id
WHEN MATCHED AND t.city IS DISTINCT FROM s.city THEN
    UPDATE SET city = s.city
WHEN NOT MATCHED THEN
    INSERT (customer_id, full_name, city) VALUES (s.customer_id, s.full_name, s.city);

SELECT * FROM dim_customer ORDER BY customer_id;
```

Three things make a MERGE production-safe:

1. **The source has one row per key.** If `changes` had two rows for customer 1, MERGE fails or picks one at random. Dedupe first with ROW_NUMBER.
2. **The match condition uses `IS DISTINCT FROM`**, so NULL-to-value changes aren't missed (chapter 4), and unchanged rows aren't rewritten.
3. **Deletes are explicit.** If the CDC feed has an `op = 'D'` flag, add `WHEN MATCHED AND s.op = 'D' THEN DELETE`.

Engines without MERGE use `INSERT ... ON CONFLICT (key) DO UPDATE` (Postgres, DuckDB) or an UPDATE followed by an INSERT of the missing keys.

```sql
CREATE TABLE kv(id INTEGER PRIMARY KEY, val VARCHAR);
INSERT INTO kv VALUES (1, 'a'), (2, 'b');
INSERT INTO kv VALUES (2, 'B'), (3, 'c')
ON CONFLICT (id) DO UPDATE SET val = excluded.val;
SELECT * FROM kv ORDER BY id;
```

## Pattern 4: delete and insert a partition

For daily facts, the simplest safe rerun is to replace exactly the slice you're loading:

```sql
CREATE TABLE fact_daily_sales AS
SELECT CAST(order_ts AS DATE) AS day, channel, SUM(quantity * unit_price) AS gross
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-06-01' AND order_ts < TIMESTAMP '2025-06-03'
GROUP BY ALL;

BEGIN;
DELETE FROM fact_daily_sales WHERE day = DATE '2025-06-02';
INSERT INTO fact_daily_sales
SELECT CAST(order_ts AS DATE), channel, SUM(quantity * unit_price)
FROM shop_orders
WHERE order_ts >= TIMESTAMP '2025-06-02' AND order_ts < TIMESTAMP '2025-06-03'
GROUP BY ALL;
COMMIT;

SELECT day, COUNT(*) AS channels, SUM(gross) AS gross FROM fact_daily_sales GROUP BY day ORDER BY day;
```

Run it twice and the table looks the same. That property, called idempotency, is the most important thing about any load. In Spark and Delta the same idea is `INSERT OVERWRITE ... PARTITION (day = ...)` or `replaceWhere`.

## Loading only what changed

Reading the whole source every run gets expensive. Incremental loads keep a **watermark**: the highest change timestamp already loaded.

```sql
CREATE TABLE load_state(table_name VARCHAR, last_loaded_ts TIMESTAMP);
INSERT INTO load_state VALUES ('orders', TIMESTAMP '2025-12-30 00:00:00');

SELECT COUNT(*) AS rows_to_load
FROM shop_orders
WHERE order_ts >  (SELECT last_loaded_ts FROM load_state WHERE table_name = 'orders')
  AND order_ts <= TIMESTAMP '2025-12-31 00:00:00';

UPDATE load_state SET last_loaded_ts = TIMESTAMP '2025-12-31 00:00:00' WHERE table_name = 'orders';
SELECT * FROM load_state;
```

The rules that keep a watermark honest:

- Use a column that changes whenever the row changes (`updated_at`), not one set only on insert.
- Set the upper bound at the start of the run and use it as the next watermark, so rows written during the run aren't skipped.
- Move the watermark only after the load commits.
- Late-arriving rows with old timestamps are missed. Re-read a small overlap (for example, the last two hours) and rely on MERGE to absorb repeats.
- Watermarks can't see deletes. For those you need CDC from the database log (handbook 9) or a periodic full compare (chapter 8).

## Common mistakes

- **Plain INSERT in a job that can be retried.** Every retry duplicates data.
- **MERGE from a source with duplicate keys.**
- **Moving the watermark before the load commits.** A failure loses that window for good.
- **`WHERE updated_at > watermark` with `=` rows at the boundary** being skipped or doubled. Pick `>` or `>=` deliberately and dedupe.
- **DELETE without WHERE.** Run the WHERE as a SELECT first.

## In the interview

**"How do you make a pipeline idempotent?"** Replace a well-defined slice (delete and insert, or overwrite a partition), or MERGE on a unique key from a deduplicated source. Running it twice must give the same table.

**"Full load or incremental?"** Full while it's cheap, because it's simpler and self-healing. Incremental when volume or cost forces it, with a watermark, an overlap window, MERGE, and a periodic full reconcile.

**"DELETE vs TRUNCATE vs DROP?"** Chosen rows and logged; all rows, fast; the whole table and its definition.

```quiz
A daily job inserts yesterday's orders with a plain INSERT. Airflow retries it after a timeout. What happens?
- Nothing, the database ignores repeats
* Yesterday's orders are loaded twice
- The second run fails
> Make it idempotent: delete and insert the day's partition, or MERGE on order_id.
---
Your MERGE source has two rows for customer 7. What should you do?
- Nothing, MERGE takes the newest
* Deduplicate the source first, keeping the latest row per key
- Switch to INSERT
> Most engines fail or behave unpredictably on duplicate source keys.
---
When should a pipeline move its watermark forward?
- At the start of the run
* After the load has committed successfully
- Before reading the source
> If the load fails after the watermark moved, that window is never loaded.
```

```practice
sql 60
sql 61
sql 62
sql 63
sql 65
sql 6
sql 12
sql 76
```
