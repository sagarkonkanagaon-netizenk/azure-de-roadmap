// Incident drills: a pipeline broke, the pager went off, fix the SQL.
export const DRILLS = [
  {
    id: 'schema-drift',
    title: 'Schema drift',
    level: 'Silver layer',
    pager: 'P2 · silver.orders · revenue for 2026-03-02 is 0',
    story: 'The upstream team renamed `amount` to `order_amount` in their export on 2 March and did not tell anyone. Bronze kept loading because it stores raw JSON, but the silver query reads `amount`, which is now NULL for every new row. The finance dashboard shows zero revenue for the day.',
    task: 'Rewrite the silver query so it reads the amount from whichever field is present. Return order_id, order_date and amount for every order.',
    hint: 'Extract both fields from the JSON and COALESCE them. `json_extract_string(payload, \'$.amount\')` reads one field.',
    setup: `CREATE TABLE bronze_orders(order_id INT, order_date DATE, payload VARCHAR);
INSERT INTO bronze_orders VALUES
 (1, DATE '2026-03-01', '{"amount": 120.50, "currency": "INR"}'),
 (2, DATE '2026-03-01', '{"amount": 80.00, "currency": "INR"}'),
 (3, DATE '2026-03-02', '{"order_amount": 310.00, "currency": "INR"}'),
 (4, DATE '2026-03-02', '{"order_amount": 45.25, "currency": "INR"}'),
 (5, DATE '2026-03-02', '{"order_amount": 99.99, "currency": "INR"}');`,
    starter: `-- silver.orders (broken since 2 March)
SELECT order_id,
       order_date,
       CAST(json_extract_string(payload, '$.amount') AS DECIMAL(10,2)) AS amount
FROM bronze_orders;`,
    ref: `SELECT order_id, order_date,
       CAST(COALESCE(json_extract_string(payload, '$.amount'),
                     json_extract_string(payload, '$.order_amount')) AS DECIMAL(10,2)) AS amount
FROM bronze_orders;`,
    lesson: 'Fix the query, then fix the process: add a schema check in bronze that alerts when an expected field disappears or a new one appears, and agree a data contract with the producer.',
  },
  {
    id: 'replay-dupes',
    title: 'Duplicate replay',
    level: 'Bronze to silver',
    pager: 'P1 · silver.payments · revenue up 38% overnight',
    story: 'A Kafka consumer crashed and restarted from an old offset, so the 09:00 batch of payments was loaded twice. Each payment also has updates (status changes). Silver must hold exactly one row per payment: its latest version.',
    task: 'Return one row per payment_id with the latest status and amount, using updated_at to pick the latest version.',
    hint: 'ROW_NUMBER() OVER (PARTITION BY payment_id ORDER BY updated_at DESC) and keep row 1. Exact duplicates tie on updated_at, which is fine because they are identical.',
    setup: `CREATE TABLE bronze_payments(payment_id INT, status VARCHAR, amount DECIMAL(10,2), updated_at TIMESTAMP);
INSERT INTO bronze_payments VALUES
 (1,'PENDING',500,TIMESTAMP '2026-03-05 09:00'),(1,'PENDING',500,TIMESTAMP '2026-03-05 09:00'),(1,'SUCCESS',500,TIMESTAMP '2026-03-05 09:02'),
 (2,'PENDING',1200,TIMESTAMP '2026-03-05 09:01'),(2,'PENDING',1200,TIMESTAMP '2026-03-05 09:01'),
 (3,'PENDING',75,TIMESTAMP '2026-03-05 09:03'),(3,'FAILED',75,TIMESTAMP '2026-03-05 09:04'),(3,'FAILED',75,TIMESTAMP '2026-03-05 09:04'),
 (4,'SUCCESS',2300,TIMESTAMP '2026-03-05 09:05');`,
    starter: `-- silver.payments: someone "fixed" it with DISTINCT
SELECT DISTINCT payment_id, status, amount
FROM bronze_payments;`,
    ref: `SELECT payment_id, status, amount
FROM bronze_payments
QUALIFY ROW_NUMBER() OVER (PARTITION BY payment_id ORDER BY updated_at DESC) = 1;`,
    lesson: 'Sources are at-least-once. Make every write idempotent: MERGE on the business key with the latest version, so replaying a batch changes nothing.',
  },
  {
    id: 'late-data',
    title: 'Late-arriving data',
    level: 'Gold layer',
    pager: 'P2 · gold.daily_revenue · 1 March total is lower than the source system',
    story: 'Mobile apps buffer events offline and upload them hours later. The gold job groups by the date the event was ingested, so sales made late on 1 March show up under 2 March, and the totals never match the payments system.',
    task: 'Rebuild daily revenue grouped by the date the sale happened (event time), not the date it arrived. Return sale_date and revenue.',
    hint: 'Group by CAST(event_ts AS DATE). Event time is the truth; ingestion time is when you heard about it.',
    setup: `CREATE TABLE sales_events(sale_id INT, event_ts TIMESTAMP, ingested_at TIMESTAMP, amount DECIMAL(10,2));
INSERT INTO sales_events VALUES
 (1,TIMESTAMP '2026-03-01 10:00',TIMESTAMP '2026-03-01 10:01',100),
 (2,TIMESTAMP '2026-03-01 18:30',TIMESTAMP '2026-03-01 18:31',250),
 (3,TIMESTAMP '2026-03-01 23:40',TIMESTAMP '2026-03-02 07:15',400),
 (4,TIMESTAMP '2026-03-01 22:05',TIMESTAMP '2026-03-02 09:30',150),
 (5,TIMESTAMP '2026-03-02 11:00',TIMESTAMP '2026-03-02 11:00',300),
 (6,TIMESTAMP '2026-03-02 21:10',TIMESTAMP '2026-03-03 06:00',80);`,
    starter: `-- gold.daily_revenue
SELECT CAST(ingested_at AS DATE) AS sale_date,
       SUM(amount) AS revenue
FROM sales_events
GROUP BY 1
ORDER BY 1;`,
    ref: `SELECT CAST(event_ts AS DATE) AS sale_date, SUM(amount) AS revenue
FROM sales_events GROUP BY 1 ORDER BY 1;`,
    lesson: 'Aggregate by event time, and reprocess a lookback window (for example the last 3 days) on every run so late rows land in the right day. In streaming, a watermark decides how late is too late.',
  },
  {
    id: 'null-storm',
    title: 'Null storm',
    level: 'Data quality gate',
    pager: 'P2 · silver.customers · job failed: NOT NULL constraint on customer_id',
    story: 'A CRM release started sending some records with an empty customer_id and some with the literal string "null". The silver write has a NOT NULL constraint, so the whole job fails and nothing loads, including the good rows.',
    task: 'Return only the valid rows for silver: customer_id present (not NULL, not empty, not the string "null"), email trimmed and lower-cased. Bad rows go to quarantine, not to silver.',
    hint: 'Use NULLIF(TRIM(customer_id), \'\') and also exclude LOWER(...) = \'null\'. Clean emails with LOWER(TRIM(email)).',
    setup: `CREATE TABLE bronze_customers(customer_id VARCHAR, email VARCHAR, city VARCHAR);
INSERT INTO bronze_customers VALUES
 ('C001','  Asha@Example.com ','Pune'),
 ('C002','ravi@example.com','Delhi'),
 (NULL,'ghost@example.com','Goa'),
 ('','empty@example.com','Kochi'),
 ('null','literal@example.com','Agra'),
 ('C003','MEERA@EXAMPLE.COM','Chennai'),
 ('  ','spaces@example.com','Surat');`,
    starter: `-- silver.customers
SELECT customer_id, email, city
FROM bronze_customers
WHERE customer_id IS NOT NULL;`,
    ref: `SELECT TRIM(customer_id) AS customer_id, LOWER(TRIM(email)) AS email, city
FROM bronze_customers
WHERE NULLIF(TRIM(customer_id), '') IS NOT NULL
  AND LOWER(TRIM(customer_id)) <> 'null';`,
    lesson: 'Never let a few bad rows block the good ones. Split the batch: valid rows to silver, invalid rows to a quarantine table with the reason, and alert when the quarantine rate crosses a threshold.',
  },
  {
    id: 'source-outage',
    title: 'Source outage',
    level: 'Monitoring',
    pager: 'P3 · bronze.sensor_readings · dashboard has flat lines',
    story: 'The IoT gateway went down twice yesterday and nobody noticed, because the pipeline "succeeded" every hour, just with no data. You need a freshness check that lists every hour with zero readings so the gaps can be backfilled.',
    task: 'List every hour on 2026-03-10 (00:00 to 23:00) that has no readings at all. Return one column: the hour as a timestamp.',
    hint: 'Generate the 24 hours with generate_series or range, LEFT JOIN the readings truncated to the hour, and keep the hours with no match.',
    setup: `CREATE TABLE sensor_readings(sensor_id INT, reading_ts TIMESTAMP, temp DOUBLE);
INSERT INTO sensor_readings
SELECT (i % 3) + 1, TIMESTAMP '2026-03-10 00:00:00' + INTERVAL (i * 20) MINUTE, 20 + (i % 7)
FROM range(0, 72) t(i)
WHERE NOT (i * 20 >= 300 AND i * 20 < 480) AND NOT (i * 20 >= 1080 AND i * 20 < 1140);`,
    starter: `-- freshness check: hours with no data
SELECT DATE_TRUNC('hour', reading_ts) AS hour, COUNT(*) AS readings
FROM sensor_readings
GROUP BY 1
HAVING COUNT(*) = 0;`,
    ref: `SELECT h.hour
FROM (SELECT TIMESTAMP '2026-03-10 00:00:00' + INTERVAL (i) HOUR AS hour FROM range(0, 24) t(i)) h
LEFT JOIN sensor_readings r ON DATE_TRUNC('hour', r.reading_ts) = h.hour
WHERE r.sensor_id IS NULL
ORDER BY h.hour;`,
    lesson: 'A job that succeeds with zero rows is still an incident. Monitor freshness and volume (rows per hour against a baseline), not just job status.',
  },
]
