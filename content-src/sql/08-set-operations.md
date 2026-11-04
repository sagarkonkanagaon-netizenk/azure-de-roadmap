# Set operations

By the end of this chapter you can stack, intersect and subtract result sets, you know why UNION ALL is the default in pipelines, and you can use EXCEPT to reconcile a source against a target.

## Stacking results

Set operations combine whole result sets top to bottom, not side by side like a join. Both sides must have the same number of columns with compatible types, matched by position, not by name.

| Operation | Returns | Removes duplicates? |
|---|---|---|
| `UNION ALL` | every row from both sides | no |
| `UNION` | every distinct row from both sides | yes |
| `INTERSECT` | rows that appear on both sides | yes |
| `EXCEPT` (`MINUS` in Oracle and Snowflake) | rows on the left that are not on the right | yes |

## UNION ALL is the pipeline default

```sql
SELECT 'web' AS source, COUNT(*) AS orders FROM shop_orders WHERE channel = 'web'
UNION ALL
SELECT 'app', COUNT(*) FROM shop_orders WHERE channel = 'app'
UNION ALL
SELECT 'marketplace', COUNT(*) FROM shop_orders WHERE channel = 'marketplace';
```

`UNION` has to sort or hash every row to remove duplicates, which is expensive on big data, and it can quietly delete rows you meant to keep: two genuine ₹500 orders from the same customer on the same day look identical if you didn't select order_id. Use `UNION ALL` unless you truly want duplicates removed, and say why when you do.

```sql
SELECT COUNT(*) AS union_all_rows FROM (
    SELECT city FROM shop_customers WHERE country = 'India'
    UNION ALL
    SELECT city FROM shop_customers WHERE segment = 'Corporate'
);
```

```sql
SELECT COUNT(*) AS union_rows FROM (
    SELECT city FROM shop_customers WHERE country = 'India'
    UNION
    SELECT city FROM shop_customers WHERE segment = 'Corporate'
);
```

The first counts every row from both sides. The second collapses them to the distinct list of cities.

## Matching columns by name

Because columns match by position, a swapped column order puts emails in the name column without any error. DuckDB and Spark offer a safer form:

```sql
SELECT customer_id, email FROM shop_customers WHERE customer_id <= 2
UNION ALL BY NAME
SELECT email, customer_id FROM shop_customers WHERE customer_id BETWEEN 3 AND 4;
```

In Spark the DataFrame equivalent is `df1.unionByName(df2, allowMissingColumns=True)`, which you'll use when appending files whose schema changes over time.

## INTERSECT and EXCEPT

```sql
-- Customers who paid by both UPI and card
SELECT customer_id FROM shop_orders WHERE payment_method = 'UPI'
INTERSECT
SELECT customer_id FROM shop_orders WHERE payment_method = 'Card'
LIMIT 10;
```

```sql
-- Customers who used UPI but never cash on delivery
SELECT COUNT(*) AS upi_never_cod FROM (
    SELECT customer_id FROM shop_orders WHERE payment_method = 'UPI'
    EXCEPT
    SELECT customer_id FROM shop_orders WHERE payment_method = 'Cash on delivery'
);
```

Unlike NOT IN, EXCEPT treats NULLs as equal to each other, so a NULL on both sides cancels out instead of breaking the result.

## Reconciling source and target

After a load, data engineers check that the target matches the source. EXCEPT in both directions finds every difference:

```sql
WITH source(id, city) AS (
    VALUES (1, 'Pune'), (2, 'Mumbai'), (3, 'Delhi'), (4, NULL)
),
target(id, city) AS (
    VALUES (1, 'Pune'), (2, 'Bengaluru'), (4, NULL), (5, 'Goa')
)
SELECT 'missing or changed in target' AS problem, * FROM (SELECT * FROM source EXCEPT SELECT * FROM target)
UNION ALL
SELECT 'extra or changed in target', * FROM (SELECT * FROM target EXCEPT SELECT * FROM source)
ORDER BY id;
```

Id 2 shows on both sides because its city changed, id 3 never arrived, and id 5 shouldn't be there. Id 4 matches even though its city is NULL. On large tables you'd compare row counts and column checksums per partition first, and only run the full EXCEPT on partitions that disagree (chapter 18).

## Common mistakes

- **UNION by habit.** Slower, and it can drop real rows.
- **Columns in a different order** on each side. No error, wrong data.
- **ORDER BY inside one branch.** It applies to the whole result, so put it once at the end.
- **Mismatched types** like an integer id against a string id. Cast explicitly on both sides.

## In the interview

**"UNION vs UNION ALL?"** UNION removes duplicates, so it sorts or hashes the whole result; UNION ALL just appends. Default to UNION ALL in pipelines, both for speed and because UNION can delete legitimate duplicate rows.

**"How do you check a target table matches its source?"** Row counts first, then checksums per partition, then EXCEPT in both directions on the partitions that differ.

```quiz
Branch A returns 10 rows and branch B returns 10 rows. 4 rows are identical across them and there are no duplicates within a branch. How many rows does UNION return?
- 20
* 16
- 4
> UNION keeps each distinct row once: 10 + 10 − 4 = 16. UNION ALL would return 20.
---
Why is UNION ALL usually preferred in pipelines?
- It sorts the output
* It doesn't deduplicate, so it's faster and never drops genuine duplicate rows
- It matches columns by name
> Deduplication needs a sort or hash of everything. Do it deliberately, on a key, when you need it.
---
`SELECT name, email FROM a UNION ALL SELECT email, name FROM b` runs without error. What's wrong?
- Nothing
* Columns match by position, so emails land in the name column for b's rows
- UNION ALL needs the same table on both sides
> Name the columns in the same order, or use UNION ALL BY NAME where it's supported.
```

```practice
sql 73
sql 63
sql 64
sql 19
```
