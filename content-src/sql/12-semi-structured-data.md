# Semi-structured data: JSON, arrays and structs

By the end of this chapter you can query nested data with arrays and structs, explode a list into rows and roll rows back into a list, and pull fields out of raw JSON the way bronze-to-silver jobs do.

## Why DEs meet nested data daily

APIs return JSON. Kafka messages are JSON or Avro. Event trackers send a payload whose fields change every sprint. Modern engines (Spark, Databricks, Snowflake, BigQuery, DuckDB) store this as nested columns instead of forcing it flat, so you need to read and reshape it with SQL.

## Arrays (lists)

An array is an ordered list of values in one column:

```sql
SELECT [10, 20, 30]                    AS arr,
       len([10, 20, 30])               AS n,
       [10, 20, 30][1]                 AS first_item,
       list_contains([10, 20, 30], 20) AS has_20,
       list_sort([3, 1, 2])            AS sorted;
```

Array indexes start at 1 in DuckDB, Snowflake's SQL functions vary, and Spark's `element_at` starts at 1 while `arr[0]` starts at 0. Check before you index.

## Explode: one row per item

```sql
WITH baskets(order_id, items) AS (
    VALUES (1, ['tea', 'biscuits']),
           (2, ['coffee']),
           (3, [])
)
SELECT order_id, unnest(items) AS item
FROM baskets;
```

Order 3 disappears because its list is empty, just like `explode` in Spark. Spark's `explode_outer` keeps it with a NULL item. Decide whether an empty basket should stay before you choose.

## Collect: many rows into one list

```sql
SELECT customer_id,
       list(DISTINCT payment_method ORDER BY payment_method) AS methods_used,
       COUNT(*) AS orders
FROM shop_orders
WHERE customer_id BETWEEN 101 AND 105
GROUP BY customer_id
ORDER BY customer_id;
```

Spark calls these `collect_list` and `collect_set`; Snowflake uses `ARRAY_AGG`. This is how you build a "cumulative table" that keeps a user's whole history in one row, a pattern handbook 13 uses for fast activity reports.

## Structs: named fields in one column

```sql
WITH people AS (
    SELECT {'name': 'Asha', 'address': {'city': 'Pune', 'pin': '411001'}} AS person
)
SELECT person.name,
       person.address.city,
       person.address.pin
FROM people;
```

A struct is like a mini row inside a column. Dot notation reaches into it, at any depth. An array of structs, such as `[{'sku': 'A1', 'qty': 2}, ...]`, is the most common shape in order and event payloads:

```sql
WITH orders(order_id, lines) AS (
    VALUES (1, [{'sku': 'TEA-1', 'qty': 2}, {'sku': 'BIS-4', 'qty': 1}]),
           (2, [{'sku': 'COF-2', 'qty': 3}])
)
SELECT order_id, line.sku, line.qty
FROM (SELECT order_id, unnest(lines) AS line FROM orders);
```

## Raw JSON strings

Bronze tables often keep the payload as a JSON string. You pull out the fields you need into typed columns in silver. In DuckDB:

```sql norun
SELECT payload ->> '$.user.id'              AS user_id,
       CAST(payload ->> '$.amount' AS DOUBLE) AS amount,
       payload -> '$.items'                  AS items_json,
       json_array_length(payload -> '$.items') AS item_count
FROM raw_events;
```

The same in other engines:

| Engine | Get a field as text | Parse to typed columns |
|---|---|---|
| DuckDB | `payload ->> '$.user.id'` | `from_json(payload, '{"user":{"id":"INTEGER"}}')` |
| Spark / Databricks | `get_json_object(payload, '$.user.id')` or `payload:user.id` | `from_json(payload, schema)` |
| Snowflake | `payload:user.id::int` on a VARIANT | `PARSE_JSON` then path access |
| BigQuery | `JSON_VALUE(payload, '$.user.id')` | `JSON_EXTRACT_ARRAY` |
| Postgres | `payload ->> 'user'` on JSONB | `jsonb_to_record` |

Parse once into a typed schema in silver. Don't make every analyst re-parse JSON in every query: it's slow, and each person handles a missing field differently.

## Schema drift

Payload fields appear, disappear and change type. Defensive habits:

- Keep the raw payload in bronze, untouched, so you can re-parse later.
- Parse with an explicit schema, not schema inference, so a surprise field doesn't change your table.
- Route rows that fail to parse into a quarantine column or table (Databricks Auto Loader calls it `_rescued_data`).
- Alert when a new field appears, then decide whether to add it.

The Spark and Databricks handbooks show these with real files.

## Common mistakes

- **Exploding before filtering.** Explode multiplies rows; filter the parent rows first.
- **`explode` dropping empty or NULL arrays** when the business needed those rows.
- **Leaving JSON as strings in silver.** Every query pays the parsing cost.
- **Off-by-one array indexes** between engines.
- **Schema inference in production.** One odd file changes the column types.

## In the interview

**"Explode an array column into rows."** `unnest` or `explode`, and immediately mention empty arrays and `explode_outer`. Practice 68 is this one.

**"How do you handle JSON whose schema changes?"** Raw in bronze, explicit schema in silver, quarantine for failures, an alert on new fields, and a reprocess path from bronze.

```quiz
`explode` runs on an order whose items array is empty. What happens to that order?
- It appears once with a NULL item
* It disappears from the output
- The query fails
> Use explode_outer (Spark) or a LEFT JOIN on unnest to keep it.
---
Where should raw JSON be parsed into typed columns?
- In every analyst's query
* Once, in the silver layer, with an explicit schema
- In the source system
> Bronze keeps the raw payload so you can reparse; silver holds clean typed columns.
---
Which function rolls many rows into one list per group in Spark?
- explode
* collect_list
- split
> collect_list keeps duplicates; collect_set removes them. DuckDB calls it list().
```

```practice
sql 68
sql 66
```
