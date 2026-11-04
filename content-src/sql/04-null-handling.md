# NULL handling

By the end of this chapter you can predict what any expression does with a NULL, and you can spot the three NULL bugs that quietly drop rows from real pipelines.

## What NULL means

NULL is not zero, not an empty string and not "false". It means *unknown*. That one idea explains every rule below: if you don't know a value, you also don't know whether it equals something else.

In the Playground, 1,954 customers have no city and 2,943 have no email. In web events, 199,538 rows have no user_id because the visitor never logged in. Real sources look like this every day.

## Three-valued logic

Comparisons with NULL return NULL, not true or false:

```sql
SELECT NULL = NULL        AS eq,
       NULL <> 'Delhi'    AS neq,
       NULL > 5           AS gt,
       NULL IS NULL       AS is_null,
       NULL AND FALSE     AS and_false,
       NULL OR TRUE       AS or_true;
```

WHERE keeps a row only when the condition is TRUE. NULL is not TRUE, so the row is dropped. Note the last two: `NULL AND FALSE` is FALSE and `NULL OR TRUE` is TRUE, because the answer doesn't depend on the unknown part.

## Trap 1: `<>` silently drops NULLs

"Customers outside Delhi" sounds simple:

```sql
SELECT COUNT(*) AS not_delhi
FROM shop_customers
WHERE city <> 'Delhi';
```

That returns 93,238. But 1,954 customers with no city are also "not in Delhi" as far as the business is concerned, and they vanished. Say what you mean:

```sql
SELECT COUNT(*) AS not_delhi_incl_unknown
FROM shop_customers
WHERE city IS DISTINCT FROM 'Delhi';
```

`IS DISTINCT FROM` treats NULL as a normal value: two NULLs are "not distinct", and NULL is distinct from 'Delhi'. It works in DuckDB, Postgres, Spark, Databricks and Snowflake. Spark also has the operator `<=>` for null-safe equality. In engines without it, write `(city <> 'Delhi' OR city IS NULL)`.

## Trap 2: NOT IN with a NULL in the list

Which customers never visited the website?

```sql
-- Returns 0 rows. Why?
SELECT COUNT(*) AS never_visited
FROM shop_customers
WHERE customer_id NOT IN (SELECT user_id FROM web_events);
```

`x NOT IN (a, b, NULL)` means `x <> a AND x <> b AND x <> NULL`. The last part is NULL, so the whole condition can never be TRUE. One anonymous event wipes out the whole answer. Use NOT EXISTS, which doesn't have this problem:

```sql
SELECT COUNT(*) AS never_visited
FROM shop_customers c
WHERE NOT EXISTS (
    SELECT 1 FROM web_events e WHERE e.user_id = c.customer_id
);
```

That returns 140. Make NOT EXISTS (or an anti join, chapter 5) your default. If you must use NOT IN, add `WHERE user_id IS NOT NULL` inside the subquery.

## Trap 3: aggregates skip NULLs

```sql
SELECT COUNT(*)              AS all_rows,
       COUNT(email)          AS with_email,
       COUNT(DISTINCT city)  AS distinct_cities
FROM shop_customers;
```

`COUNT(*)` counts rows. `COUNT(col)` counts non-NULL values. SUM, AVG, MIN and MAX ignore NULLs too, which changes averages:

```sql
SELECT AVG(score)              AS avg_ignoring_null,
       AVG(COALESCE(score, 0)) AS avg_null_as_zero
FROM (VALUES (10), (20), (NULL)) AS t(score);
```

The first is 15, the second is 10. Neither is wrong; they answer different questions. Decide which one the business means and write it down.

## Tools for NULLs

| Function | What it does | Example |
|---|---|---|
| `COALESCE(a, b, ...)` | first non-NULL argument | `COALESCE(city, 'Unknown')` |
| `NULLIF(a, b)` | NULL when a = b, else a | `clicks / NULLIF(views, 0)` avoids divide by zero |
| `IS [NOT] NULL` | the only correct NULL test | `email IS NULL` |
| `IS [NOT] DISTINCT FROM` | null-safe comparison | `old.city IS DISTINCT FROM new.city` |
| `IFNULL`, `NVL`, `ISNULL` | two-argument COALESCE in some dialects | prefer COALESCE, it works everywhere |

```sql
SELECT customer_id,
       COALESCE(city, 'Unknown')  AS city,
       COALESCE(email, 'missing') AS email
FROM shop_customers
WHERE city IS NULL OR email IS NULL
LIMIT 10;
```

## NULLs in joins, grouping and sorting

- **Joins:** `a.key = b.key` never matches NULL keys, so rows with a NULL key drop out of inner joins. A LEFT JOIN keeps them but with NULLs on the right side.
- **GROUP BY** puts all NULLs in one group. So does DISTINCT.
- **ORDER BY:** where NULLs land depends on the engine. Write `NULLS FIRST` or `NULLS LAST` when it matters.
- **Change detection:** in a pipeline, `WHERE old.city <> new.city` misses a city going from NULL to 'Pune'. Always use `IS DISTINCT FROM` when comparing old and new rows. This is one of the most common real SCD bugs (chapter 14).

```sql
SELECT city, COUNT(*) AS customers
FROM shop_customers
GROUP BY city
ORDER BY customers DESC NULLS LAST
LIMIT 5;
```

## Common mistakes

- **`= NULL`** instead of `IS NULL`. It never matches.
- **`<>` on a nullable column** in a filter that should keep unknowns.
- **`NOT IN` over a nullable subquery.** Returns nothing.
- **Dividing by a column that can be 0.** Wrap it: `NULLIF(views, 0)`.
- **COALESCE to a fake value** like `'1900-01-01'` in a fact table. It hides the gap from everyone downstream. Keep NULL and document it, or use an explicit "Unknown" member in a dimension.

## In the interview

**"Why does `WHERE city <> 'Delhi'` miss some rows?"** Because NULL compared with anything is NULL, and WHERE keeps only TRUE. Fix it with `IS DISTINCT FROM` or `OR city IS NULL`.

**"Why can NOT IN return no rows?"** One NULL in the subquery makes every `<>` comparison unknown. Use NOT EXISTS. Saying this unprompted, with the reason, is a strong signal in a DE interview.

```quiz
What does `SELECT COUNT(*) FROM t WHERE col = NULL` return when col has 50 NULLs?
- 50
* 0
- An error
> `col = NULL` is NULL for every row, and WHERE keeps only TRUE. Use `col IS NULL`.
---
The subquery `SELECT user_id FROM web_events` contains NULLs. What does `WHERE id NOT IN (subquery)` return?
- Only the ids that never appear
* No rows at all
- Every row
> `id <> NULL` is unknown, so the whole NOT IN can never be TRUE. Use NOT EXISTS instead.
---
Values are 10, 20 and NULL. What is AVG(value)?
- 10
* 15
- NULL
> AVG ignores NULLs, so it's (10 + 20) / 2. AVG(COALESCE(value, 0)) would be 10.
```

```practice
sql 74
sql 75
sql 72
sql 66
sql 57
```
