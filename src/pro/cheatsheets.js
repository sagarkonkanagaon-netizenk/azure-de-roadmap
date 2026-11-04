// Pro cheat sheets, free preview. One printable page each.
export const SHEETS = [
  {
    slug: 'sql-window-functions',
    title: 'SQL window functions',
    tag: 'SQL',
    md: `## The shape

\`\`\`sql
fn(...) OVER (
  PARTITION BY a          -- restart per group (optional)
  ORDER BY b              -- order inside the group
  ROWS BETWEEN 2 PRECEDING AND CURRENT ROW   -- the frame (optional)
)
\`\`\`

A window function keeps every row. GROUP BY collapses rows.

## Ranking

| Function | Ties 100, 100, 90 | Use it for |
|---|---|---|
| \`ROW_NUMBER()\` | 1, 2, 3 | dedup, latest row per key |
| \`RANK()\` | 1, 1, 3 | competition ranking, gaps after ties |
| \`DENSE_RANK()\` | 1, 1, 2 | "Nth highest salary" |
| \`NTILE(4)\` | quartiles | buckets of equal size |

## Look around

| Function | Returns |
|---|---|
| \`LAG(x, 1, 0)\` | previous row's x, or 0 if there is none |
| \`LEAD(x)\` | next row's x |
| \`FIRST_VALUE(x)\` | first in the frame |
| \`LAST_VALUE(x)\` | last in the frame (watch the default frame!) |

## Running and moving

\`\`\`sql
SUM(amount) OVER (PARTITION BY user_id ORDER BY ts)                    -- running total
AVG(amount) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) -- 7-row moving avg
amount / SUM(amount) OVER (PARTITION BY city)                          -- share of city total
\`\`\`

## Patterns interviewers ask

\`\`\`sql
-- latest row per key
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
  FROM events) WHERE rn = 1;

-- Databricks, DuckDB and Snowflake: QUALIFY skips the subquery
SELECT * FROM events
QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1;

-- gaps and islands: consecutive login days
SELECT user_id, MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*) AS days
FROM (SELECT user_id, d,
        d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INT) AS grp
      FROM logins) GROUP BY user_id, grp;
\`\`\`

## Traps

- **The default frame** with ORDER BY is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW. So LAST_VALUE returns the current row, and ties in ORDER BY are summed together. Write ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING when you mean the whole partition.
- **WHERE runs before windows.** Filter on a window result in an outer query or with QUALIFY.
- **A non-unique ORDER BY** makes ROW_NUMBER pick at random between ties. Add a tie-breaker column.
- **In Spark**, a window with no PARTITION BY moves all rows to one task.`,
  },
  {
    slug: 'sql-joins-and-traps',
    title: 'SQL joins and traps',
    tag: 'SQL',
    md: `## The joins

| Join | Keeps | Typical use |
|---|---|---|
| \`INNER\` | matches only | facts with their dimension |
| \`LEFT\` | all left rows, NULLs where no match | "customers and their orders, if any" |
| \`FULL OUTER\` | everything from both sides | reconciling two systems |
| \`CROSS\` | every pair | calendars × stores |
| \`LEFT SEMI\` / \`EXISTS\` | left rows that have a match, no duplicates | filtering by another table |
| \`LEFT ANTI\` / \`NOT EXISTS\` | left rows with **no** match | "customers who never ordered" |

## Trap 1: the filter that kills your LEFT JOIN

\`\`\`sql
-- wrong: WHERE on the right table turns it back into an INNER JOIN
SELECT c.id, o.id FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'delivered';

-- right: put the right-table filter in ON
SELECT c.id, o.id FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered';
\`\`\`

## Trap 2: NOT IN with a NULL

\`\`\`sql
-- returns NO rows if any orders.customer_id is NULL
SELECT * FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);
-- safe
SELECT * FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
\`\`\`

## Trap 3: fan-out (row explosion)

Joining orders to a table with **many rows per key** (payments, items, SCD history) multiplies the orders, and SUM(order_amount) doubles. Before you join, check:

\`\`\`sql
SELECT key, COUNT(*) FROM right_table GROUP BY key HAVING COUNT(*) > 1;
\`\`\`

Fix it by aggregating the right side first, or by joining on the full key (for SCD2, add the date range).

## Trap 4: NULL never equals NULL

\`NULL = NULL\` is unknown, so rows with NULL keys never join. Use \`a IS NOT DISTINCT FROM b\` (or Spark's \`a <=> b\`) when NULL should match NULL.

## Trap 5: duplicates after UNION

\`UNION\` removes duplicate rows (and costs a sort or hash). \`UNION ALL\` keeps them and is faster. Say which one you meant.

## Row counts to expect

| Join | Rows out |
|---|---|
| INNER on a unique key | ≤ left rows |
| LEFT on a unique key | = left rows |
| any join on a non-unique key | can be more than both |

**Interview habit:** say the grain of each table out loud before writing the join: "one row per order", "one row per order item".`,
  },
  {
    slug: 'pyspark-dataframe-api',
    title: 'PySpark DataFrame API',
    tag: 'PySpark',
    md: `## Setup

\`\`\`python
from pyspark.sql import functions as F, Window
df = spark.read.option("header", True).csv("/Volumes/main/raw/orders/")
df = spark.table("main.silver.orders")
\`\`\`

## Everyday transformations

\`\`\`python
df.select("id", F.col("amount").cast("decimal(10,2)").alias("amount"))
df.withColumn("order_date", F.to_date("order_ts"))
df.withColumns({"year": F.year("ts"), "month": F.month("ts")})   # Spark 3.3+
df.filter((F.col("status") == "delivered") & F.col("amount").isNotNull())
df.withColumnRenamed("amt", "amount")
df.drop("tmp_col")
df.dropDuplicates(["order_id"])                # keeps an arbitrary row per key!
df.fillna({"city": "unknown", "qty": 0})
df.orderBy(F.col("amount").desc())
\`\`\`

## Conditions and strings

\`\`\`python
F.when(F.col("amount") > 1000, "big").when(F.col("amount") > 100, "mid").otherwise("small")
F.coalesce("email", F.lit("n/a"))
F.trim(F.lower("city")); F.initcap("name"); F.regexp_replace("amount", "[^0-9.]", "")
F.split("tags", ","); F.concat_ws("-", "a", "b")
\`\`\`

## Aggregation

\`\`\`python
(df.groupBy("city", "order_date")
   .agg(F.count("*").alias("orders"),
        F.countDistinct("customer_id").alias("customers"),
        F.sum("amount").alias("revenue"),
        F.expr("percentile_approx(amount, 0.5)").alias("median")))
\`\`\`

## Windows

\`\`\`python
w = Window.partitionBy("order_id").orderBy(F.col("updated_at").desc())
latest = df.withColumn("rn", F.row_number().over(w)).filter("rn = 1").drop("rn")
running = df.withColumn("cum", F.sum("amount").over(Window.partitionBy("user").orderBy("ts")))
\`\`\`

## Joins

\`\`\`python
orders.join(customers, "customer_id", "left")                  # same column name
orders.join(F.broadcast(dim), "restaurant_id")                  # small table: no shuffle
orders.join(customers, "customer_id", "left_anti")              # orders with no customer
\`\`\`

## Nested data

\`\`\`python
df.select("id", F.explode("items").alias("item"))               # one row per array element
df.select("payload.user.id")                                    # struct field
df.withColumn("j", F.from_json("raw", "id STRING, amt DOUBLE"))
F.get_json_object("raw", "$.coupon_code")
\`\`\`

## Writing

\`\`\`python
df.write.mode("overwrite").saveAsTable("main.gold.daily_revenue")
df.write.mode("append").partitionBy("order_date").saveAsTable("main.silver.events")
\`\`\`

## Traps

- **\`dropDuplicates\`** keeps a random row. Use a window when "latest" matters.
- **Python UDFs** are slow and block optimisations. Look for a built-in in \`F\` first, then a pandas UDF.
- **\`collect()\`** pulls everything to the driver. Use \`limit\`, \`show\` or \`display\`.
- **Under ANSI mode** (default on Databricks serverless), bad casts raise errors. Use \`try_cast\`, \`try_to_timestamp\` and \`try_divide\`.`,
  },
  {
    slug: 'delta-lake-commands',
    title: 'Delta Lake commands',
    tag: 'Delta Lake',
    md: `## Create and write

\`\`\`sql
CREATE TABLE main.silver.orders (order_id STRING, amount DECIMAL(10,2), order_ts TIMESTAMP)
CLUSTER BY (order_ts);                        -- liquid clustering (newer than partitions + Z-order)

INSERT INTO main.silver.orders SELECT ...;
CREATE OR REPLACE TABLE main.gold.daily AS SELECT ...;
\`\`\`

## MERGE (upsert)

\`\`\`sql
MERGE INTO main.silver.orders t
USING updates s ON t.order_id = s.order_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
WHEN NOT MATCHED BY SOURCE THEN DELETE;   -- only for a full sync: removes rows the source no longer has
\`\`\`

The source must have **one row per key**, or MERGE fails with "multiple source rows matched". Dedup it first.

## Overwrite just one slice

\`\`\`python
(df.write.mode("overwrite")
   .option("replaceWhere", "order_date >= '2026-10-01' AND order_date < '2026-10-04'")
   .saveAsTable("main.gold.daily"))
\`\`\`

## Time travel and undo

\`\`\`sql
DESCRIBE HISTORY main.silver.orders;
SELECT * FROM main.silver.orders VERSION AS OF 12;
SELECT * FROM main.silver.orders TIMESTAMP AS OF '2026-10-03 06:00';
RESTORE TABLE main.silver.orders TO VERSION AS OF 12;
\`\`\`

## Maintenance

| Command | What it does |
|---|---|
| \`OPTIMIZE t\` | compacts small files |
| \`OPTIMIZE t ZORDER BY (col)\` | co-locates data for filters on col (non-clustered tables) |
| \`VACUUM t RETAIN 168 HOURS\` | deletes files no longer referenced (breaks time travel before that) |
| \`ANALYZE TABLE t COMPUTE STATISTICS FOR ALL COLUMNS\` | better join plans |
| \`DESCRIBE DETAIL t\` | size, number of files, location |

## Schema

\`\`\`sql
ALTER TABLE t ADD COLUMNS (coupon_code STRING);
ALTER TABLE t ALTER COLUMN amount SET NOT NULL;
ALTER TABLE t ADD CONSTRAINT positive_amount CHECK (amount >= 0);
\`\`\`

\`\`\`python
df.write.option("mergeSchema", True).mode("append").saveAsTable("t")   # allow new columns
\`\`\`

## Change data feed

\`\`\`sql
ALTER TABLE t SET TBLPROPERTIES (delta.enableChangeDataFeed = true);
SELECT * FROM table_changes('main.silver.orders', 5);    -- inserts, updates, deletes since v5
\`\`\`

## Interview one-liners

- **Why Delta over plain Parquet?** ACID transactions, MERGE, time travel, schema enforcement, and no half-written files for readers.
- **Small-file problem?** Many small writes make many files. OPTIMIZE or auto-compaction fixes it, and so does writing in bigger batches.
- **How is it ACID?** A transaction log (_delta_log) of JSON commits plus Parquet checkpoints. Writers use optimistic concurrency.`,
  },
  {
    slug: 'spark-performance-tuning',
    title: 'Spark performance tuning',
    tag: 'Spark',
    md: `## First, look before you tune

Open the Spark UI, find the **slowest stage**, and compare max task time with the median task time.

| You see | It usually means |
|---|---|
| one task runs far longer than the rest | **skew** on a join or group key |
| huge "shuffle read/write" | wide transformations, or a join that could be broadcast |
| "spill (disk)" | too little memory per task, or too few partitions |
| thousands of tiny tasks | too many small files or partitions |
| the job is slow before any stage | listing many small files, or a huge plan |

## Joins

\`\`\`python
big.join(F.broadcast(small), "key")        # small side < ~10s of MB: no shuffle of big
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 50 * 1024 * 1024)
\`\`\`

## Skew

\`\`\`python
spark.conf.set("spark.sql.adaptive.enabled", True)               # on by default in Spark 3.2+
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", True)      # splits skewed partitions
\`\`\`

If AQE isn't enough, **salt** the hot key: add a random 0..N-1 to the big side, explode the small side N times, join on (key, salt), then aggregate in two steps.

## Partitions

\`\`\`python
spark.conf.set("spark.sql.shuffle.partitions", "auto")   # Databricks; else size it ~ 128 MB per task
df.repartition(200, "customer_id")   # full shuffle, even spread by key
df.coalesce(16)                      # fewer partitions, no shuffle (for writing fewer files)
\`\`\`

## Read less

- **Filter early** and select only the columns you need. Parquet and Delta skip the rest.
- **Partition pruning:** filter on the partition column directly. \`WHERE order_date = '2026-10-01'\` prunes, but \`WHERE year(order_date) = 2026\` may not.
- **Data skipping:** cluster or Z-order on columns you filter by, then OPTIMIZE.

## Cache only when reused

\`\`\`python
df.cache(); df.count()   # materialise once, reuse in several actions
df.unpersist()
\`\`\`

## Code smells

- Python UDFs on big data: use built-in functions.
- \`collect()\` or \`toPandas()\` on large DataFrames.
- \`count()\` in a loop to "check" progress: every action re-runs the plan.
- Many small appends: batch them, or turn on auto-compaction.

## Numbers worth remembering

| Thing | Rule of thumb |
|---|---|
| target file size | 128 MB to 1 GB |
| target shuffle partition | 100 to 200 MB |
| broadcast limit (default) | 10 MB, safe to raise to a few hundred MB |
| executor cores | 4 to 5 per executor |

**Interview story shape:** symptom (SLA missed) → evidence (Spark UI, max vs median task) → fix (broadcast, AQE, salting, compaction) → result (runtime before and after) → guard (alert on runtime).`,
  },
]
