# Data modeling for analytics

By the end of this chapter you can design a star schema from raw tables, choose a fact table's grain, build a date dimension, and keep history with SCD Type 2. Handbook 13 goes deeper into modeling patterns; this chapter gives you the SQL.

## Why model at all?

Source tables are designed for the app that writes them: normalised, full of codes, changed often. Analysts need tables that are easy to query, fast and stable. Dimensional modeling (Kimball's star schema) is still the most common answer, on warehouses and lakehouses alike.

## Facts and dimensions

- A **fact** table records events or measurements: one row per order line, payment or click. It holds foreign keys and numbers you add up.
- A **dimension** table describes the things involved: customer, product, date, store. It holds the attributes you filter and group by.

In a star schema, the fact sits in the middle and each dimension joins to it on one key. A snowflake schema splits dimensions further (product into category into department). Prefer the star: fewer joins, easier for people and BI tools.

## Step 1: choose the grain

The grain is what one row of the fact means, stated in one sentence. "One row per order" and "one row per customer per day" are different tables. Decide it first; every other decision follows. Mixing grains, like daily totals in the same table as individual orders, is the most damaging modeling mistake because every SUM double counts.

## Step 2: build the dimensions

```sql
CREATE TABLE dim_customer AS
SELECT ROW_NUMBER() OVER (ORDER BY customer_id) AS customer_sk,
       customer_id,
       full_name,
       COALESCE(city, 'Unknown') AS city,
       country,
       segment,
       is_premium,
       signup_date
FROM shop_customers;

SELECT * FROM dim_customer LIMIT 5;
```

`customer_sk` is a **surrogate key**: a number the warehouse owns, separate from the source's `customer_id` (the natural or business key). Surrogate keys let you keep several versions of the same customer (SCD Type 2 below) and survive a source system changing its ids.

A **date dimension** saves every analyst from writing date logic:

```sql
CREATE TABLE dim_date AS
SELECT CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key,
       CAST(d AS DATE)                         AS full_date,
       EXTRACT(year FROM d)                    AS year,
       EXTRACT(quarter FROM d)                 AS quarter,
       EXTRACT(month FROM d)                   AS month,
       monthname(d)                            AS month_name,
       dayname(d)                              AS day_name,
       EXTRACT(isodow FROM d) IN (6, 7)        AS is_weekend,
       CASE WHEN EXTRACT(month FROM d) >= 4 THEN EXTRACT(year FROM d) ELSE EXTRACT(year FROM d) - 1 END AS fiscal_year_start
FROM generate_series(TIMESTAMP '2024-01-01', TIMESTAMP '2025-12-31', INTERVAL 1 DAY) t(d);

SELECT * FROM dim_date WHERE full_date BETWEEN DATE '2025-03-29' AND DATE '2025-04-02';
```

The fiscal year column follows India's April-to-March year. Add holidays and sale events as columns too, and every report can use them.

## Step 3: build the fact

```sql
CREATE TABLE dim_customer AS
SELECT ROW_NUMBER() OVER (ORDER BY customer_id) AS customer_sk, customer_id, city, segment
FROM shop_customers;

CREATE TABLE fact_orders AS
SELECT o.order_id,
       CAST(strftime(o.order_ts, '%Y%m%d') AS INTEGER) AS date_key,
       c.customer_sk,
       o.product_id,
       o.channel,
       o.status,
       o.quantity,
       o.quantity * o.unit_price                               AS gross_amount,
       o.quantity * o.unit_price * o.discount_pct / 100.0      AS discount_amount
FROM shop_orders o
JOIN dim_customer c ON c.customer_id = o.customer_id
WHERE o.order_ts >= TIMESTAMP '2025-12-01';

SELECT c.segment, f.channel, SUM(f.gross_amount) AS gross
FROM fact_orders f
JOIN dim_customer c ON c.customer_sk = f.customer_sk
GROUP BY ALL
ORDER BY gross DESC;
```

Measures come in three kinds. **Additive** ones (amount, quantity) can be summed across every dimension. **Semi-additive** ones (an account balance) can be summed across customers but not across days. **Non-additive** ones (a ratio or a percentage) must be recomputed from their parts, never summed.

## Slowly changing dimensions

Customers move cities. What should last year's report show?

| Type | What happens on change | Use when |
|---|---|---|
| Type 0 | never change | fixed facts like date of birth |
| Type 1 | overwrite | corrections, or history doesn't matter |
| Type 2 | close the old row, add a new one | history matters: "sales by the city they lived in then" |
| Type 3 | keep a "previous value" column | only the last change matters |

Type 2 keeps `valid_from`, `valid_to` and `is_current` columns:

```sql
CREATE TABLE dim_customer_scd2 (
    customer_sk INTEGER, customer_id INTEGER, city VARCHAR,
    valid_from DATE, valid_to DATE, is_current BOOLEAN
);
INSERT INTO dim_customer_scd2 VALUES
    (1, 7, 'Mumbai', DATE '2024-01-01', DATE '9999-12-31', TRUE),
    (2, 8, 'Delhi',  DATE '2024-01-01', DATE '9999-12-31', TRUE);

CREATE TABLE incoming(customer_id INTEGER, city VARCHAR);
INSERT INTO incoming VALUES (7, 'Pune'), (8, 'Delhi'), (9, 'Goa');

-- 1. Close current rows whose tracked value changed
UPDATE dim_customer_scd2 d
SET valid_to = DATE '2025-07-01', is_current = FALSE
FROM incoming i
WHERE d.customer_id = i.customer_id
  AND d.is_current
  AND d.city IS DISTINCT FROM i.city;

-- 2. Insert a new current row for changed and brand-new customers
INSERT INTO dim_customer_scd2
SELECT (SELECT MAX(customer_sk) FROM dim_customer_scd2) + ROW_NUMBER() OVER (ORDER BY i.customer_id),
       i.customer_id, i.city, DATE '2025-07-01', DATE '9999-12-31', TRUE
FROM incoming i
LEFT JOIN dim_customer_scd2 d ON d.customer_id = i.customer_id AND d.is_current
WHERE d.customer_id IS NULL;

SELECT * FROM dim_customer_scd2 ORDER BY customer_id, valid_from;
```

Customer 7 now has two rows, Mumbai until 1 July and Pune from 1 July; customer 8 is unchanged; customer 9 is new. The old row's `valid_to` equals the new row's `valid_from`, and the end is exclusive, the same half-open rule as chapter 3, so every day belongs to exactly one version. A fact row joins to the version that was current on its date:

```sql norun
SELECT f.order_id, d.city
FROM fact_orders f
JOIN dim_customer_scd2 d
  ON d.customer_id = f.customer_id
 AND f.order_date >= d.valid_from
 AND f.order_date <  d.valid_to;
```

On Delta Lake the two steps become one MERGE, which the Pro project 1 builds end to end. dbt snapshots (handbook 11) and Databricks' `APPLY CHANGES` automate the same logic.

## Other patterns you'll meet

- **Factless fact:** rows with keys and no measures, such as "student attended class". You count them.
- **Periodic snapshot:** one row per entity per period, such as daily inventory or month-end balances.
- **Accumulating snapshot:** one row per process instance, updated as it moves through stages (ordered, packed, shipped, delivered), with a date column per stage.
- **Junk dimension:** a handful of low-cardinality flags (is_gift, is_express) combined into one small dimension.
- **One Big Table:** a fully denormalised wide table. Popular on lakehouses because storage is cheap and joins are expensive. Build it from a clean star, not instead of one.

## Common mistakes

- **No stated grain.** Ask "what is one row?" before writing any SQL.
- **Summing a ratio or a balance.**
- **SCD2 change detection with `<>`.** NULL-to-value changes are missed. Use IS DISTINCT FROM.
- **Overlapping SCD2 ranges** for one key. Test that each key has exactly one current row and no gaps.
- **Joining facts to the current dimension row** when the report needs history.

## In the interview

**"Design a data model for a food-delivery app."** State the business questions, then the grain of each fact (one row per order, one per delivery event), the dimensions (customer, restaurant, rider, date, location), which dimensions need SCD2 (restaurant commission rate, customer city), and how it will be loaded. Grain first, out loud.

**"SCD Type 1 vs Type 2?"** Overwrite versus keep history with validity dates. Mention surrogate keys, the current flag, and IS DISTINCT FROM for change detection.

```quiz
A fact table has one row per order, and someone adds daily total rows to it. What breaks?
- Nothing
* Every SUM double counts, because the table mixes two grains
- Joins to dimensions stop working
> One table, one grain. Daily totals belong in their own aggregate table.
---
Which measure is semi-additive?
- Order amount
* Account balance at the end of each day
- Number of clicks
> Balances can be summed across accounts on one day, but not across days.
---
Why does SCD Type 2 need a surrogate key?
* The same customer_id appears in several rows, one per version, so it can't be the primary key
- Surrogate keys are faster to type
- The source system requires it
> Each version needs its own key so facts can point at the version current at the time.
```

```practice
sql 61
sql 60
sql 50
```
