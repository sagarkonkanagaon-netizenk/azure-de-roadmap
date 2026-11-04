# Joins

By the end of this chapter you can pick the right join for any question, predict the row count before you run it, and catch the two join bugs that cause most wrong dashboards: fan-out and the LEFT JOIN filter trap.

## Why joins matter so much in DE

Source systems store each thing once: customers in one table, products in another, orders pointing at both. Almost every pipeline step that builds something useful joins them back together. Get a join wrong and every number downstream is wrong, usually without an error.

## The join types

| Join | Keeps | Use it for |
|---|---|---|
| `INNER JOIN` | only rows that match on both sides | enrich orders with customer details |
| `LEFT JOIN` | every left row, matched right columns or NULL | "all customers, with their orders if any" |
| `RIGHT JOIN` | every right row | rarely needed: swap the tables and use LEFT |
| `FULL OUTER JOIN` | every row from both sides | reconciling source against target |
| `CROSS JOIN` | every combination | building a date × product grid |
| Semi join (`EXISTS`) | left rows that have a match, once each | "customers who ordered" |
| Anti join (`NOT EXISTS`) | left rows with no match | "customers who never ordered" |

```sql
SELECT o.order_id,
       o.order_ts,
       c.full_name,
       c.city,
       p.product_name,
       p.category
FROM shop_orders o
JOIN shop_customers c ON c.customer_id = o.customer_id
JOIN shop_products  p ON p.product_id  = o.product_id
LIMIT 10;
```

Always alias tables and prefix every column. When a second table gains a column with the same name, unprefixed queries break.

## Predict the row count first

Before running a join, say out loud how many rows you expect. Orders to customers is many-to-one, so an inner join keeps exactly one row per order:

```sql
SELECT COUNT(*) AS orders_with_customer
FROM shop_orders o
JOIN shop_customers c ON c.customer_id = o.customer_id;
```

That's 1,000,000, the same as the orders table, so no order lost its customer. A LEFT JOIN from customers to orders gives 1,000,049: one row per order plus one row for each of the 49 customers who never ordered.

If the count is bigger than you expected, you have fan-out.

## Fan-out: the silent number inflater

A join multiplies rows whenever the key repeats on the side you didn't expect. Here a small "targets" table accidentally has two rows for Mumbai:

```sql
WITH city_targets(city, target) AS (
    VALUES ('Mumbai', 100), ('Mumbai', 120), ('Pune', 80)
)
SELECT c.city,
       COUNT(*) AS customer_rows_after_join
FROM shop_customers c
JOIN city_targets t ON t.city = c.city
GROUP BY c.city
ORDER BY c.city;
```

Every Mumbai customer now appears twice, so any SUM over that join doubles. Before joining, check that the key is unique on the side that should be "one":

```sql
SELECT customer_id, COUNT(*) AS n
FROM shop_customers
GROUP BY customer_id
HAVING COUNT(*) > 1;
```

No rows back means customer_id is unique and safe to join on.

## The LEFT JOIN filter trap

"All customers, with their count of cancelled orders, including zero":

```sql
-- Wrong: the WHERE throws away customers with no cancelled orders
SELECT COUNT(DISTINCT c.customer_id) AS customers
FROM shop_customers c
LEFT JOIN shop_orders o ON o.customer_id = c.customer_id
WHERE o.status = 'cancelled';
```

For customers with no cancelled order, `o.status` is NULL, the WHERE drops them, and the LEFT JOIN has quietly become an INNER JOIN. Put conditions on the right-hand table in the ON clause:

```sql
SELECT COUNT(DISTINCT c.customer_id)  AS customers,
       COUNT(o.order_id)              AS cancelled_orders
FROM shop_customers c
LEFT JOIN shop_orders o
       ON o.customer_id = c.customer_id
      AND o.status = 'cancelled';
```

Now every one of the 100,000 customers is kept. The rule: filters on the left table go in WHERE, filters on the right table of a LEFT JOIN go in ON.

## Semi and anti joins

To ask "does a match exist?", don't join and DISTINCT. Use EXISTS:

```sql
-- Customers who placed at least one UPI order
SELECT COUNT(*) AS upi_customers
FROM shop_customers c
WHERE EXISTS (
    SELECT 1 FROM shop_orders o
    WHERE o.customer_id = c.customer_id
      AND o.payment_method = 'UPI'
);
```

```sql
-- Customers who never ordered: the anti join
SELECT c.customer_id, c.full_name, c.signup_date
FROM shop_customers c
LEFT JOIN shop_orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.signup_date DESC
LIMIT 10;
```

The `LEFT JOIN ... WHERE right.key IS NULL` pattern and `NOT EXISTS` give the same result. Spark and DuckDB also accept `LEFT SEMI JOIN` and `LEFT ANTI JOIN`.

## Self joins and cross joins

A self join compares rows in the same table, like "employees earning more than their manager" (practice 3). A cross join builds every combination, useful for filling gaps:

```sql
WITH months AS (
    SELECT * FROM (VALUES (DATE '2025-01-01'), (DATE '2025-02-01'), (DATE '2025-03-01')) m(month)
),
cats AS (
    SELECT DISTINCT category FROM shop_products
)
SELECT m.month, c.category
FROM months m
CROSS JOIN cats c
ORDER BY m.month, c.category;
```

Left join your real sales onto this grid and every month × category shows up, even with zero sales, which is what a chart needs.

## How engines run joins

You'll meet these names in query plans and in the Spark chapters:

- **Hash join:** build a hash table on the smaller side, stream the bigger side through it. The default for equality joins.
- **Broadcast join** (Spark): copy the small table to every worker so the big one never moves. Fastest when one side is small.
- **Sort-merge join:** sort both sides by the key, then walk them together. Spark's default for two big tables.
- **Nested loop:** compare every pair. Used for non-equality conditions like `a.ts BETWEEN b.start AND b.end`. Slow on big tables.

## Common mistakes

- **Not checking key uniqueness** before joining. Fan-out doubles revenue.
- **Right-table filter in WHERE** after a LEFT JOIN.
- **JOIN then DISTINCT** to fix duplicates. It hides fan-out instead of fixing the key. Use EXISTS.
- **Joining on columns of different types**, like a string id against an integer id. Some engines cast silently and can't use indexes or partitions.
- **NULL keys.** They never match, so those rows drop out of inner joins.

## In the interview

**"Table A has 5 rows, table B has 3. How many rows does each join return?"** It depends on the keys, and saying so is the point. Walk through the matches: an inner join returns the matching pairs, a LEFT JOIN adds unmatched A rows, a FULL JOIN adds unmatched rows from both. With duplicate keys, matches multiply. Practice 7 drills exactly this.

**"Customers who never ordered?"** Give NOT EXISTS or the LEFT JOIN / IS NULL anti join, and mention why NOT IN is risky with NULLs.

```quiz
After `customers LEFT JOIN orders ... WHERE orders.status = 'cancelled'`, what happened to customers with no cancelled orders?
- They are kept with NULL status
* They are dropped, as if it were an inner join
- The query errors
> The WHERE runs after the join, and NULL = 'cancelled' isn't TRUE. Move the condition into ON.
---
A revenue total doubled after you joined a targets table. What is the most likely cause?
- The SUM function rounds up
* The join key repeats in the targets table, so rows fan out
- LEFT JOIN always duplicates rows
> Check `GROUP BY key HAVING COUNT(*) > 1` on the side that should be unique.
---
Which pattern finds customers who never placed an order, safely even with NULLs?
- `WHERE customer_id NOT IN (SELECT customer_id FROM orders)`
* `WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)`
- `INNER JOIN orders ... WHERE order_id IS NULL`
> NOT EXISTS ignores NULLs in the subquery. An inner join can never produce a NULL order_id.
```

```practice
sql 8
sql 7
sql 3
sql 4
sql 15
sql 19
```
