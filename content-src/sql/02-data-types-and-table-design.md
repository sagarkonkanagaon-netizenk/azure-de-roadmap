# Data types and table design

By the end of this chapter you can pick the right type for every column, explain why money is never a float, and design a table with sensible keys and constraints.

## Why types matter

A type is a promise about what a column holds. Get it right and the engine stores data compactly, sorts it correctly and catches bad values. Get it wrong and you get wrong totals, slow joins, or dates that sort as text: "2026-10-9" comes after "2026-10-10".

## The types you'll use most

| Kind | Types | Use for | Watch out |
|---|---|---|---|
| Whole numbers | `INTEGER`, `BIGINT` | ids, counts, quantities | INTEGER tops out near 2.1 billion. Use BIGINT for event ids. |
| Exact decimals | `DECIMAL(p, s)` / `NUMERIC` | money, rates you report | `p` is total digits, `s` is digits after the point |
| Approximate | `DOUBLE`, `FLOAT`, `REAL` | measurements, scores, ML features | never for money: binary rounding errors |
| Text | `VARCHAR`, `STRING`, `TEXT` | names, codes, free text | trailing spaces and case make "equal" values differ |
| Dates and times | `DATE`, `TIMESTAMP`, `TIMESTAMPTZ` | events, business dates | store UTC, convert at the edge (chapter 10) |
| True or false | `BOOLEAN` | flags like `is_premium` | NULL is a third state, not false |
| Nested | `ARRAY`/`LIST`, `STRUCT`, `MAP`, `JSON` | events and API payloads | flatten before you join (chapter 12) |

## Why money is never a float

Floats store numbers in binary, and most decimal fractions can't be written exactly in binary. Try it:

```sql
SELECT 0.1::DOUBLE + 0.2::DOUBLE              AS float_sum,
       0.1::DOUBLE + 0.2::DOUBLE = 0.3::DOUBLE AS float_equal,
       0.1::DECIMAL(10,2) + 0.2::DECIMAL(10,2) = 0.3 AS decimal_equal;
```

`float_equal` is false. Across a million order lines these tiny errors add up, and finance's total won't match yours. In the practice tables, `unit_price` is `DECIMAL(10,2)` for exactly this reason.

## Casting: changing a value's type

`CAST(x AS type)` (or `x::type` in DuckDB, Postgres and Spark) converts a value. When the value can't convert, `CAST` raises an error, which stops a pipeline. `TRY_CAST` returns NULL instead, so you can catch and quarantine the bad rows:

```sql
SELECT raw,
       TRY_CAST(raw AS DECIMAL(10,2))                                 AS as_is,
       TRY_CAST(regexp_replace(raw, '[^0-9.]', '', 'g') AS DECIMAL(10,2)) AS cleaned
FROM (VALUES ('349.00'), ('₹349.00'), ('three hundred'), (NULL)) AS t(raw);
```

The pattern above is a real one: raw text comes in, a cleaned version goes to silver, and rows where `cleaned` is still NULL go to a quarantine table with a reason.

> Spark and Databricks with ANSI mode on (the default on serverless) also raise errors on bad casts. Use `try_cast`, `try_to_timestamp` and `try_divide` there.

## Keys

- **Primary key:** the column (or columns) that identify a row. In `shop_orders` it's `order_id`.
- **Natural key:** a key from the business, like an email or a GST number. It can change.
- **Surrogate key:** a meaningless id you generate, like `customer_sk = 1, 2, 3…`. It never changes, which is why dimensions use one (chapter 14).
- **Foreign key:** a column that points at another table's key, like `shop_orders.customer_id`.

Warehouses and lakehouses (Databricks, Snowflake, BigQuery) usually **don't enforce** primary and foreign keys. You can declare them, but the engine won't stop a duplicate. Your pipeline and your quality checks have to do it (chapter 18).

## Designing a table

Here's a cleaned orders table as a data engineer would design it:

```sql
CREATE TABLE silver_orders (
    order_id        BIGINT        NOT NULL PRIMARY KEY,
    customer_id     INTEGER       NOT NULL,
    product_id      INTEGER       NOT NULL,
    order_ts        TIMESTAMP     NOT NULL,          -- when it happened (UTC)
    order_date      DATE          NOT NULL,          -- derived, for filters and partitions
    quantity        INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    discount_pct    INTEGER       NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    status          VARCHAR       NOT NULL,
    _source_file    VARCHAR,                         -- where the row came from
    _ingested_at    TIMESTAMP                        -- when we loaded it
);
```

Choices worth defending in an interview:

- **`NOT NULL` on everything the business needs.** A NULL quantity is a bug, so the table refuses it.
- **`CHECK` constraints** catch impossible values at write time.
- **A derived `order_date`** makes daily filters and partitioning simple.
- **Audit columns** (`_source_file`, `_ingested_at`) let you trace any row back to its file, which you'll want at 3 AM.

## Create a table from a query

Most tables in a pipeline are created from a query (CTAS, "create table as select"):

```sql
CREATE TABLE daily_revenue AS
SELECT CAST(order_ts AS DATE)                                     AS order_date,
       SUM(quantity * unit_price * (1 - discount_pct / 100.0))    AS revenue
FROM shop_orders
WHERE status = 'delivered'
GROUP BY 1;

SELECT * FROM daily_revenue ORDER BY order_date LIMIT 5;
```

## Common mistakes

- **Dates stored as text.** They sort wrong and can't be compared. Cast once, in silver.
- **Money as FLOAT or DOUBLE.** Use DECIMAL with enough digits: `DECIMAL(18,2)` covers almost any total.
- **Joining INTEGER to VARCHAR.** Some engines cast silently and scan everything, others fail. Make key types match.
- **INTEGER ids for events.** A busy app passes 2.1 billion events quickly. Use BIGINT.
- **Assuming the warehouse enforces keys.** It usually doesn't. Check uniqueness yourself.

## In the interview

**"Design a table for orders."** Start with the grain ("one row per order line"), then the key, then the types, especially DECIMAL for money and TIMESTAMP in UTC. Then constraints and audit columns. Say what you'd partition or cluster by (order date).

**Follow-up: "Natural or surrogate key?"** Natural keys can change and can come from several systems. A surrogate key is stable and makes SCD Type 2 history possible. Keep the natural key as a column too, so you can join back to the source.

```quiz
Which type should hold `unit_price`?
- DOUBLE
* DECIMAL(10,2)
- VARCHAR
> Money needs exact decimal arithmetic. DOUBLE has binary rounding errors, and VARCHAR can't be summed.
---
A raw column holds values like "₹349.00" and "N/A". What's the safest way to turn it into a number in a pipeline?
- CAST(raw AS DECIMAL(10,2))
* Strip the symbols, TRY_CAST, and quarantine rows that come back NULL
- Leave it as text and cast in the dashboard
> CAST would fail the whole job on the first bad value. TRY_CAST lets you keep the good rows and send the bad ones somewhere you can look at them.
---
Databricks lets you declare a primary key on a table. What happens if you insert a duplicate?
* It's accepted. The key is informational, so you must check uniqueness yourself
- The insert fails
- The old row is replaced
> Most warehouses and lakehouses treat primary and foreign keys as information for the optimizer and for people, not as rules they enforce.
```

```practice
sql 76
sql 65
```
