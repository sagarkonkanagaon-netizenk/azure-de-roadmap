# Dialect cheat sheet

By the end of this chapter you can translate a query between the engines Indian DE job descriptions ask for most: Spark SQL on Databricks, Snowflake, BigQuery, SQL Server and Synapse, and Postgres. Standard SQL covers about 90% of a query; this chapter is the other 10%.

## How to use this page

Write standard SQL first: SELECT, JOIN, GROUP BY, window functions and CTEs work everywhere. When something fails on a new engine, it's almost always one of the rows below. Versions matter: where a feature arrived recently, the version is noted. When in doubt, check the engine's docs for your version.

## Querying

| Task | Spark SQL / Databricks | Snowflake | BigQuery | SQL Server / Synapse | Postgres |
|---|---|---|---|---|---|
| First n rows | `LIMIT n` | `LIMIT n` or `TOP n` | `LIMIT n` | `TOP n`, or `OFFSET 0 ROWS FETCH NEXT n ROWS ONLY` | `LIMIT n` |
| Quote a name | `` `my col` `` | `"my col"` | `` `my col` `` | `[my col]` | `"my col"` |
| Filter on a window | `QUALIFY` on Databricks; subquery in older open-source Spark | `QUALIFY` | `QUALIFY` | subquery | subquery |
| Group by all non-aggregates | `GROUP BY ALL` on Databricks | `GROUP BY ALL` | `GROUP BY ALL` | list the columns | list the columns |
| Integer `7 / 2` | `3.5` (`7 div 2` is 3) | `3.5` | `3.5` (`DIV(7, 2)` is 3) | `3` | `3` |
| Safe divide | `try_divide(a, b)` | `DIV0NULL(a, b)` | `SAFE_DIVIDE(a, b)` | `a / NULLIF(b, 0)` | `a / NULLIF(b, 0)` |
| Cast that returns NULL on failure | `try_cast(x AS INT)` | `TRY_CAST(x AS INT)` | `SAFE_CAST(x AS INT64)` | `TRY_CAST(x AS INT)` | no built-in: use a CASE with a regex check |

## NULLs and strings

| Task | Spark SQL / Databricks | Snowflake | BigQuery | SQL Server / Synapse | Postgres |
|---|---|---|---|---|---|
| Default for NULL | `coalesce`, `nvl` | `COALESCE`, `NVL`, `IFNULL` | `COALESCE`, `IFNULL` | `COALESCE`, `ISNULL` | `COALESCE` |
| Null-safe equals | `a <=> b`, `IS NOT DISTINCT FROM` | `EQUAL_NULL(a, b)`, `IS NOT DISTINCT FROM` | `IS NOT DISTINCT FROM` | `IS NOT DISTINCT FROM` (2022+) | `IS NOT DISTINCT FROM` |
| Concatenate | `concat(a, b)`, `a \|\| b` | `a \|\| b`, `CONCAT` | `CONCAT`, `a \|\| b` | `a + b`, `CONCAT` | `a \|\| b` |
| Regex extract | `regexp_extract(s, pat, 1)` | `REGEXP_SUBSTR(s, pat)` | `REGEXP_EXTRACT(s, pat)` | limited: `PATINDEX`; regex functions arrive in SQL Server 2025 | `substring(s from pat)`, `regexp_match` |
| Split to array | `split(s, ',')` | `SPLIT(s, ',')` | `SPLIT(s, ',')` | `STRING_SPLIT(s, ',')` returns rows | `string_to_array(s, ',')` |
| Rows to text | `concat_ws(',', collect_list(x))` | `LISTAGG(x, ',')` | `STRING_AGG(x, ',')` | `STRING_AGG(x, ',')` | `string_agg(x, ',')` |

## Dates

| Task | Spark SQL / Databricks | Snowflake | BigQuery | SQL Server / Synapse | Postgres |
|---|---|---|---|---|---|
| Now | `current_timestamp()` | `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP()` | `SYSDATETIME()`, `GETDATE()` | `now()` |
| Add days | `date_add(d, 7)` | `DATEADD(day, 7, d)` | `DATE_ADD(d, INTERVAL 7 DAY)` | `DATEADD(day, 7, d)` | `d + INTERVAL '7 days'` |
| Add months | `add_months(d, 1)` | `DATEADD(month, 1, d)` | `DATE_ADD(d, INTERVAL 1 MONTH)` | `DATEADD(month, 1, d)` | `d + INTERVAL '1 month'` |
| Days between | `datediff(end, start)` | `DATEDIFF(day, start, end)` | `DATE_DIFF(end, start, DAY)` | `DATEDIFF(day, start, end)` | `end - start` |
| Start of month | `date_trunc('MONTH', ts)` | `DATE_TRUNC('month', ts)` | `DATE_TRUNC(d, MONTH)` | `DATETRUNC(month, d)` (2022+) | `date_trunc('month', ts)` |
| Parse text | `to_date(s, 'dd/MM/yyyy')` | `TO_DATE(s, 'DD/MM/YYYY')` | `PARSE_DATE('%d/%m/%Y', s)` | `CONVERT(date, s, 103)` | `to_date(s, 'DD/MM/YYYY')` |
| Series of dates | `explode(sequence(start, end, interval 1 day))` | `GENERATOR` with `DATEADD` | `UNNEST(GENERATE_DATE_ARRAY(start, end))` | `GENERATE_SERIES` (2022+), or a recursive CTE | `generate_series(start, end, '1 day')` |

Watch the argument order in date differences: Spark and BigQuery put the end first, Snowflake and SQL Server put the unit and start first.

## Loading and nested data

| Task | Spark SQL / Databricks | Snowflake | BigQuery | SQL Server / Synapse | Postgres |
|---|---|---|---|---|---|
| Upsert | `MERGE INTO` (Delta) | `MERGE` | `MERGE` | `MERGE` | `MERGE` (15+), `INSERT ... ON CONFLICT` |
| Replace a table | `CREATE OR REPLACE TABLE` | `CREATE OR REPLACE TABLE` | `CREATE OR REPLACE TABLE` | `DROP TABLE IF EXISTS` then create | `DROP TABLE IF EXISTS` then create |
| Explode an array | `explode(arr)`, `LATERAL VIEW` | `LATERAL FLATTEN(input => arr)` | `CROSS JOIN UNNEST(arr)` | `CROSS APPLY OPENJSON(json)` | `unnest(arr)` |
| JSON field | `get_json_object(j, '$.a')`, `j:a` | `j:a` on VARIANT | `JSON_VALUE(j, '$.a')` | `JSON_VALUE(j, '$.a')` | `j ->> 'a'` |
| Set difference | `EXCEPT` | `EXCEPT`, `MINUS` | `EXCEPT DISTINCT` | `EXCEPT` | `EXCEPT` |
| Approximate distinct | `approx_count_distinct` | `APPROX_COUNT_DISTINCT` | `APPROX_COUNT_DISTINCT` | `APPROX_COUNT_DISTINCT` (2019+) | extension needed |
| Time travel | `VERSION AS OF n` (Delta) | `AT(OFFSET => -60)` | `FOR SYSTEM_TIME AS OF ts` | temporal tables | not built in |

## The same query in two dialects

Monthly revenue and month-over-month growth, Spark SQL:

```sql norun
SELECT month, revenue,
       ROUND(100 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month), 1) AS mom_pct
FROM (
    SELECT date_trunc('MONTH', order_ts) AS month, SUM(quantity * unit_price) AS revenue
    FROM silver.orders
    GROUP BY date_trunc('MONTH', order_ts)
) m
ORDER BY month;
```

SQL Server:

```sql norun
SELECT month, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS mom_pct
FROM (
    SELECT DATETRUNC(month, order_ts) AS month, SUM(quantity * unit_price) AS revenue
    FROM dbo.orders
    GROUP BY DATETRUNC(month, order_ts)
) m
ORDER BY month;
```

Two differences: the date-truncation syntax, and `100.0` plus NULLIF, because SQL Server does integer division and errors on divide by zero.

## Common mistakes

- **Assuming `/` means the same everywhere.**
- **Swapped date-diff arguments** between Spark and Snowflake.
- **Writing QUALIFY for SQL Server or Postgres.**
- **Backticks in Snowflake** or double quotes in Spark: in Spark, double quotes mean a string.

## In the interview

**"Which SQL dialects have you used?"** Name them and one real difference you hit, such as "SQL Server's integer division broke a ratio when we migrated to Synapse, so we standardised on multiplying by 100.0." A specific story beats a list.

```quiz
`SELECT 7 / 2` in SQL Server returns what?
* 3
- 3.5
- An error
> Integer divided by integer is integer division in SQL Server and Postgres. Spark, Snowflake and BigQuery return 3.5.
---
In Spark SQL, what does `WHERE city = "Pune"` compare against?
* The string Pune, because Spark treats double quotes as a string by default
- A column called Pune
- Nothing, it's a syntax error
> Spark uses backticks for names. Snowflake and Postgres use double quotes for names, so the same line means something else there.
---
Which engine needs a subquery instead of QUALIFY to filter on ROW_NUMBER()?
- Snowflake
- BigQuery
* Postgres
> Postgres and SQL Server don't support QUALIFY. Wrap the window in a subquery and filter outside.
```

```practice
sql 76
sql 70
```
