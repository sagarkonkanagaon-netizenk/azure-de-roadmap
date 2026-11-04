# Subqueries and CTEs

By the end of this chapter you can break any hard question into small named steps, choose between a subquery, a CTE and a temp table, and walk a hierarchy with a recursive CTE.

## Why this matters

Interview questions and real pipeline logic are rarely one SELECT. "Customers who spend more than the average customer in their city" is three steps: spend per customer, average per city, compare. CTEs let you write those steps in order, each with a name, so you and your reviewer can check each one.

## Subqueries: a query inside a query

A subquery can stand wherever a value, a list or a table can:

```sql
-- As a single value (scalar subquery)
SELECT order_id, quantity * unit_price AS gross
FROM shop_orders
WHERE quantity * unit_price > (SELECT AVG(quantity * unit_price) * 5 FROM shop_orders)
LIMIT 10;
```

```sql
-- As a list
SELECT COUNT(*) AS premium_orders
FROM shop_orders
WHERE customer_id IN (SELECT customer_id FROM shop_customers WHERE is_premium);
```

```sql
-- As a table (derived table)
SELECT segment, ROUND(AVG(orders), 1) AS avg_orders_per_customer
FROM (
    SELECT c.segment, o.customer_id, COUNT(*) AS orders
    FROM shop_orders o
    JOIN shop_customers c ON c.customer_id = o.customer_id
    GROUP BY c.segment, o.customer_id
) per_customer
GROUP BY segment
ORDER BY segment;
```

A scalar subquery must return exactly one row and one column, or the query fails at run time.

## Correlated subqueries

A correlated subquery refers to the outer row, so in principle it runs once per row:

```sql
SELECT c.customer_id, c.full_name,
       (SELECT MAX(o.order_ts) FROM shop_orders o
        WHERE o.customer_id = c.customer_id) AS last_order_ts
FROM shop_customers c
WHERE c.city = 'Pune'
LIMIT 10;
```

Modern optimisers usually rewrite this into a join, but not always. If a correlated subquery is slow, rewrite it as a join to a grouped CTE yourself.

## CTEs: name each step

`WITH name AS (...)` defines a temporary named result that the rest of the query can use. Here is the city-average question, step by step:

```sql
WITH spend AS (
    SELECT o.customer_id, c.city,
           SUM(o.quantity * o.unit_price) AS gross
    FROM shop_orders o
    JOIN shop_customers c ON c.customer_id = o.customer_id
    WHERE o.status = 'delivered'
    GROUP BY o.customer_id, c.city
),
city_avg AS (
    SELECT city, AVG(gross) AS avg_gross
    FROM spend
    GROUP BY city
)
SELECT s.city,
       COUNT(*) AS above_avg_customers
FROM spend s
JOIN city_avg a ON a.city = s.city
WHERE s.gross > a.avg_gross
GROUP BY s.city
ORDER BY above_avg_customers DESC
LIMIT 5;
```

Read it top to bottom like a recipe. To debug, swap the final SELECT for `SELECT * FROM spend LIMIT 10` and check each step on its own. This is how dbt models are written too (handbook 11).

## Subquery, CTE or temp table?

| Use | When |
|---|---|
| Subquery | a small, one-off piece used once |
| CTE | several steps, or the same step used twice in one query |
| Temp table | a heavy intermediate result reused by several queries, or one you want to inspect or index |
| View | logic other people and jobs should reuse (chapter 15) |

A CTE is mainly for readability. Some engines compute a CTE once and reuse it; others inline it each time it's referenced. If a CTE is expensive and referenced several times, check the plan or use a temp table.

## Recursive CTEs

A recursive CTE has a starting query and a step that refers to itself, repeated until it adds no rows. Two everyday uses: generating sequences and walking hierarchies.

```sql
-- Generate the 12 months of 2025
WITH RECURSIVE months(month) AS (
    SELECT DATE '2025-01-01'
    UNION ALL
    SELECT CAST(month + INTERVAL 1 MONTH AS DATE) FROM months
    WHERE month < DATE '2025-12-01'
)
SELECT month FROM months;
```

```sql
-- Walk a reporting line: everyone under manager 1, with their depth
WITH RECURSIVE staff(emp_id, name, manager_id) AS (
    VALUES (1, 'Asha', NULL), (2, 'Ravi', 1), (3, 'Meera', 1),
           (4, 'Kabir', 2), (5, 'Zoya', 4), (6, 'Dev', 3)
),
tree AS (
    SELECT emp_id, name, manager_id, 0 AS depth, name AS path
    FROM staff WHERE manager_id IS NULL
    UNION ALL
    SELECT s.emp_id, s.name, s.manager_id, t.depth + 1, t.path || ' > ' || s.name
    FROM staff s
    JOIN tree t ON s.manager_id = t.emp_id
)
SELECT depth, name, path FROM tree ORDER BY path;
```

Always make sure the recursive step can stop. A cycle in the data (A manages B, B manages A) loops forever unless you cap the depth with `WHERE t.depth < 20`. Spark SQL only gained recursive CTEs recently, so older Spark jobs walk hierarchies with a loop in Python instead.

## Common mistakes

- **A scalar subquery that returns two rows.** Fails at run time, often only on production data.
- **NOT IN with a nullable subquery.** Use NOT EXISTS (chapter 4).
- **One giant query with five nested subqueries.** Split it into CTEs.
- **Assuming a CTE is cached.** It may be recomputed each time it's used.
- **A recursive CTE with no stop condition.**

## In the interview

**"CTE vs subquery vs temp table?"** Readability and reuse within one query for a CTE, a one-off for a subquery, and a temp table when an expensive result is reused across queries or needs inspecting. Mention that CTE materialisation depends on the engine.

**"Find all reports under a manager at any level."** A recursive CTE with an anchor (the manager) and a step joining employees to the rows found so far. Mention cycle protection.

```quiz
A scalar subquery in SELECT returns two rows for one customer. What happens?
- The engine picks the first row
* The query fails with an error
- The customer appears twice
> A scalar subquery must return at most one row. Aggregate it, or turn it into a join.
---
What makes a recursive CTE stop?
- It always runs exactly 100 times
* The recursive step returns no new rows
- The engine detects the end of the table
> Each pass feeds the previous pass's rows into the step. When the step adds nothing, it ends. Guard against cycles.
---
You reference an expensive CTE three times in one query and it's slow. What is a good fix?
- Rename the CTE
* Materialise the result into a temp table, then query it
- Add ORDER BY inside the CTE
> Some engines recompute a CTE at each reference. A temp table computes it once.
```

```practice
sql 13
sql 59
sql 18
sql 77
```
