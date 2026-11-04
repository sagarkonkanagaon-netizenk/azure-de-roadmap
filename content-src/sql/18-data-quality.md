# Data quality with SQL

By the end of this chapter you can write the core data quality checks in SQL, reconcile a load against its source, quarantine bad rows instead of loading them, and explain the write-audit-publish pattern.

## Why quality is a DE job

Nobody notices a pipeline that works. Everyone notices the morning the revenue dashboard shows double. Most data incidents are not crashes: the job succeeds and the data is wrong. Checks catch that before a stakeholder does.

## The six checks that catch most problems

| Check | Question | Example on our tables |
|---|---|---|
| Volume | did roughly the expected number of rows arrive? | orders today vs the 7-day average |
| Uniqueness | is the key unique? | one row per order_id |
| Completeness | are required columns filled? | no NULL customer_id |
| Validity | are values in range and format? | quantity > 0, status in the known list |
| Referential integrity | do foreign keys point at real rows? | every order's customer exists |
| Freshness | is the data recent enough? | latest order_ts within the last hour |

## Uniqueness and completeness

```sql
SELECT COUNT(*)                     AS rows,
       COUNT(DISTINCT event_id)     AS distinct_keys,
       COUNT(*) - COUNT(DISTINCT event_id) AS duplicate_rows,
       COUNT(*) - COUNT(user_id)    AS null_user_id,
       ROUND(100.0 * (COUNT(*) - COUNT(user_id)) / COUNT(*), 2) AS null_user_pct
FROM web_events;
```

One pass, several checks. For web events, anonymous users are expected, so the right check isn't "zero NULLs" but "NULL rate between 15% and 25%". A good check encodes what normal looks like.

## Validity

```sql
SELECT COUNT(*) FILTER (WHERE distance_km <= 0)            AS zero_or_negative_distance,
       COUNT(*) FILTER (WHERE fare < 0)                    AS negative_fare,
       COUNT(*) FILTER (WHERE dropoff_ts <= pickup_ts)     AS ends_before_start,
       COUNT(*) FILTER (WHERE passengers NOT BETWEEN 1 AND 6) AS odd_passenger_count,
       COUNT(*)                                            AS trips
FROM taxi_trips;
```

## Referential integrity

```sql
SELECT COUNT(*) AS orphan_orders
FROM shop_orders o
WHERE NOT EXISTS (SELECT 1 FROM shop_customers c WHERE c.customer_id = o.customer_id);
```

Zero here. In real systems orphans often appear because facts arrive before their dimension rows. Common fixes: load dimensions first, or point late facts at an "Unknown" dimension member and repair them when the dimension row arrives.

## Volume against history

```sql
WITH daily AS (
    SELECT CAST(order_ts AS DATE) AS day, COUNT(*) AS orders
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-11-01'
    GROUP BY day
),
scored AS (
    SELECT day, orders,
           AVG(orders) OVER (ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS avg_prev_7
    FROM daily
)
SELECT day, orders, ROUND(avg_prev_7) AS avg_prev_7,
       ROUND(100.0 * (orders - avg_prev_7) / avg_prev_7, 1) AS pct_vs_avg,
       ABS(orders - avg_prev_7) > 0.3 * avg_prev_7 AS alert
FROM scored
WHERE avg_prev_7 IS NOT NULL
ORDER BY day
LIMIT 15;
```

A fixed threshold ("at least 1,000 rows") breaks on festival days and weekends. Comparing with recent history adapts. Seasonal businesses compare with the same weekday in previous weeks.

## Reconciliation

After a load, prove the target matches the source:

```sql
WITH source AS (
    SELECT CAST(order_ts AS DATE) AS day, COUNT(*) AS n, SUM(quantity * unit_price) AS gross
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-12-01' AND order_ts < TIMESTAMP '2025-12-08'
    GROUP BY day
),
target AS (
    -- pretend the load lost a few rows on one day
    SELECT CAST(order_ts AS DATE) AS day, COUNT(*) AS n, SUM(quantity * unit_price) AS gross
    FROM shop_orders
    WHERE order_ts >= TIMESTAMP '2025-12-01' AND order_ts < TIMESTAMP '2025-12-08'
      AND NOT (CAST(order_ts AS DATE) = DATE '2025-12-05' AND order_id % 100 = 0)
    GROUP BY day
)
SELECT s.day, s.n AS source_rows, t.n AS target_rows, s.n - t.n AS missing,
       s.gross - t.gross AS gross_diff
FROM source s
FULL JOIN target t ON t.day = s.day
WHERE s.n IS DISTINCT FROM t.n OR s.gross IS DISTINCT FROM t.gross
ORDER BY s.day;
```

Counts and sums per day narrow a problem to one partition fast; chapter 8's EXCEPT then finds the exact rows.

## Quarantine instead of failing or loading

Bad rows have three possible fates: fail the whole job, load them anyway, or set them aside. For most pipelines, setting aside is best:

```sql
CREATE TABLE trips_clean AS
SELECT * FROM taxi_trips
WHERE distance_km > 0 AND fare >= 0 AND dropoff_ts > pickup_ts;

CREATE TABLE trips_quarantine AS
SELECT *,
       CASE WHEN distance_km <= 0 THEN 'zero_or_negative_distance'
            WHEN fare < 0 THEN 'negative_fare'
            ELSE 'ends_before_start' END AS reason
FROM taxi_trips
WHERE NOT (distance_km > 0 AND fare >= 0 AND dropoff_ts > pickup_ts);

SELECT reason, COUNT(*) AS rows FROM trips_quarantine GROUP BY reason ORDER BY rows DESC;
```

Then alert when the quarantine rate is unusually high. A few bad rows are normal; 20% means a source broke and the job should stop.

## Write, audit, publish

The safest pattern for important tables:

1. **Write** the new data to a staging table or a hidden branch, not the table people read.
2. **Audit** it with the checks above.
3. **Publish** only if checks pass: swap or merge into production in one transaction.

If an audit fails, consumers keep seeing yesterday's correct data instead of today's wrong data. Delta Lake (with a staging table or shallow clone), Iceberg (with branches) and dbt (build, test, then swap) all support it.

## Tools

You can write all of this in SQL, and you should be able to in an interview. In production, teams use dbt tests (handbook 11), Great Expectations or Soda for expectation suites, Databricks Lakeflow expectations, and data contracts that make the source team agree to a schema and rules.

## Common mistakes

- **Checks that only test "not NULL" and "unique".** Volume and freshness catch more real incidents.
- **Hard-coded thresholds** that alert every weekend until everyone ignores them.
- **Failing the whole pipeline for one bad row.**
- **Checking only after publishing.** People already saw the bad numbers.
- **No owner for an alert.** Every check needs a person who acts on it.

## In the interview

**"What data quality checks do you put on a pipeline?"** Name the six with a concrete example each, then say where they run (before publish), what happens on failure (quarantine or block), and who gets alerted.

**"Source and target counts don't match. What do you do?"** Narrow by partition with counts and sums, then EXCEPT both ways on the failing partition, then check filters, join fan-out, late data and dedup logic.

```quiz
A job runs successfully but loads half the usual rows. Which check catches it?
- Uniqueness
* Volume compared with recent history
- Referential integrity
> Successful jobs with wrong data are the common incident. Volume and freshness checks find them.
---
What is the point of write-audit-publish?
* Readers keep seeing the last good data if the new data fails its checks
- It makes loads faster
- It removes the need for tests
> New data is checked in staging and only swapped into production when it passes.
---
1 in 10,000 rows has a negative fare. What should most pipelines do?
- Fail the whole job
- Load them unchanged
* Move them to a quarantine table with a reason, and alert if the rate jumps
> Quarantine keeps good data flowing and keeps bad rows for investigation.
```

```practice
sql 64
sql 65
sql 66
sql 5
sql 63
```
