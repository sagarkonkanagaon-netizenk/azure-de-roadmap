# Where SQL fits in data engineering

By the end of this chapter you can explain where SQL sits in a data platform, name the five practice tables you'll use all course, and run your first queries on them.

## Why a data engineer lives in SQL

A data engineer moves data from where it's created to where it's trusted. Python and Spark do some of the moving. Almost everything else is SQL:

- **Checking what arrived.** Did today's file have the usual number of rows? Are there new NULLs?
- **Cleaning and shaping.** Turning raw events into clean tables, one row per order or per customer per day.
- **Modelling.** Facts and dimensions that analysts can query without knowing how the source works.
- **Loading.** INSERT, MERGE and overwrite patterns that don't double count.
- **Debugging.** When a dashboard number looks wrong, you trace it back with queries.

Spark SQL, Databricks SQL, Snowflake, BigQuery, Redshift, Postgres and DuckDB all speak SQL. dbt models are SQL files. Learn SQL well once and it works everywhere, with small dialect differences (chapter 19).

## The life of one order

Follow one food order from the app to a dashboard:

| Step | System | Shape of the data |
|---|---|---|
| 1. You tap "Place order" | App database (OLTP), e.g. Postgres | One row in `orders`, updated as the status changes |
| 2. The change is captured | CDC tool or a nightly export | A file or event per change |
| 3. It lands in the lake | Cloud storage (S3, ADLS, GCS) | Raw JSON or CSV, untouched (bronze) |
| 4. It's cleaned | Spark or a warehouse | Typed, deduplicated rows (silver) |
| 5. It's modelled | SQL models, often dbt | Facts and dimensions (gold) |
| 6. Someone reads it | BI tool, notebook, API | "Revenue by city yesterday" |

Steps 4 to 6 are mostly SQL. Step 1 is SQL too, but a different kind.

## OLTP and OLAP: two kinds of database

| | OLTP (the app's database) | OLAP (warehouse or lakehouse) |
|---|---|---|
| Job | Run the business: place an order, update a status | Understand the business: revenue by month |
| Typical query | Read or write one row by its key | Scan millions of rows, aggregate a few columns |
| Storage | Row by row | Column by column (Parquet, Delta, Iceberg) |
| Design | Normalised: many small tables, no repeats | Denormalised for reading: facts and dimensions |
| Examples | Postgres, MySQL, SQL Server | Databricks, Snowflake, BigQuery, Redshift, DuckDB |

A data engineer reads from OLTP systems and builds OLAP ones. Never run a heavy analytics query on the app's production database: you can slow down checkout for real customers.

## Meet your practice tables

Every example in this course runs in your browser on the Playground's shop data: about 2.6 million rows, generated the same for everyone. Press **Run it** on any SQL block to open it in the Playground.

| Table | Rows | One row is | Mess added on purpose |
|---|---|---|---|
| `shop_customers` | 100,000 | a customer | about 2% have no city, 3% no email |
| `shop_products` | 5,000 | a product | none |
| `shop_orders` | 1,000,000 | an order line, 2024 to 2025 | statuses include cancelled and returned |
| `web_events` | 1,000,000 | a click on the website or app | 1% duplicated events, 20% anonymous users |
| `taxi_trips` | 500,000 | a cab trip | zero distances, negative fares |

The **grain** (what one row means) is the most important fact about any table. Say it out loud before you write a query.

## Your first queries

Look at a few rows before anything else:

```sql
SELECT *
FROM shop_orders
LIMIT 10;
```

See the columns and their types:

```sql
DESCRIBE shop_orders;
```

Count the rows, and see the date range:

```sql
SELECT COUNT(*)      AS orders,
       MIN(order_ts) AS first_order,
       MAX(order_ts) AS last_order
FROM shop_orders;
```

## Profile a table in one query

When a new table lands, data engineers profile it: how many rows, how many distinct keys, how many NULLs. This one query tells you a lot about `shop_customers`:

```sql
SELECT COUNT(*)                     AS row_count,
       COUNT(DISTINCT customer_id)  AS distinct_ids,
       COUNT(*) - COUNT(city)       AS missing_city,
       COUNT(*) - COUNT(email)      AS missing_email,
       MIN(signup_date)             AS first_signup,
       MAX(signup_date)             AS last_signup
FROM shop_customers;
```

If `distinct_ids` is less than `row_count`, the key isn't unique and every join on it will multiply rows. You'll see why in chapter 5.

## How to read the rest of this course

Each chapter has the same shape: the idea, worked examples you can run, the mistakes people make, what interviewers ask, a quick check, and lab problems to practise on. Type the examples yourself rather than only pressing Run: your fingers learn SQL faster than your eyes do.

## Common mistakes

- **Querying before knowing the grain.** "Revenue per customer" from an order-line table needs a SUM. From a customer table it's a lookup.
- **Running heavy queries on the app's database.** Use a replica, an export, or the warehouse.
- **Trusting a table because it exists.** Profile it first: row count, key uniqueness, NULLs, date range.

## In the interview

**"How do you use SQL day to day?"** A strong answer names real tasks: "I write the transformations from raw to clean tables, the MERGE that loads them, and the quality checks that run before a dashboard refreshes. When numbers look wrong, SQL is how I trace them back."

**Follow-up: "What's the difference between OLTP and OLAP?"** OLTP runs the business, with row-at-a-time reads and writes. OLAP analyses it, with column scans over millions of rows. Then say why it matters: you design tables differently for each.

```quiz
What is the grain of `shop_orders`?
- One row per customer
* One row per order line
- One row per day
> The grain is what one row means. Each row of shop_orders is one order line, so "orders per customer" needs a COUNT grouped by customer.
---
`COUNT(DISTINCT customer_id)` is lower than `COUNT(*)` in a customer table. What does that tell you?
- The table has NULL customer ids only
* Some customer ids appear more than once, so joins on it will multiply rows
- Nothing, that's normal for a customer table
> A customer table should have one row per customer. Duplicated keys mean every join on customer_id can multiply rows.
---
Why shouldn't you run a big analytics query on the app's production database?
- SQL works differently there
* It competes with real customers' queries and can slow the app down
- OLTP databases can't run GROUP BY
> OLTP databases are tuned for many small reads and writes. A big scan can slow down checkout. Use a replica or the warehouse.
```

```practice
page /playground Open the Playground and profile shop_products
sql 70
```
