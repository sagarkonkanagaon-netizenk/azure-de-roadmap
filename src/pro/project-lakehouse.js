// Pro project 1, shown free as a preview: RasoiRun orders lakehouse on Databricks Free Edition.
// Each step has the ask, a hint, the full solution and a checkpoint number that matches the data exactly.

const n = (x) => Number(x).toLocaleString('en-IN')
const m = (x) => Number(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const PROJECT = {
  id: 'food-delivery-lakehouse',
  n: 1,
  title: 'Food-delivery lakehouse',
  sub: 'Orders to bronze, silver and gold on Delta Lake',
  hours: '8 to 10 hours',
  level: 'Intermediate',
  stack: ['Databricks Free Edition', 'PySpark', 'Spark SQL', 'Delta Lake', 'Auto Loader', 'Lakeflow Jobs'],
  brief: `Morning! Finance and ops both pull numbers straight from the app's order events, and they never match. Finance counts replayed events twice, ops forgets the late ones, and nobody agrees which city a restaurant is in.

I need one trusted place for this. Land the raw order files as they are, clean them once, and give me two tables by 7 AM every day: **revenue by city and day**, and **on-time delivery by city and day**. It has to survive a rerun without double counting, and it has to tell us when the data is bad instead of hiding it.

Three days of files are attached. Ping me when the numbers reconcile.

— Kavya, Data Lead, RasoiRun`,
  outcomes: [
    'Ingest raw JSON files incrementally with Auto Loader, and survive schema drift without the pipeline breaking',
    'Clean, type and deduplicate events into a silver table with MERGE, and quarantine bad rows with a reason',
    'Keep restaurant history with a Slowly Changing Dimension Type 2, and join each order to the version valid at order time',
    'Build gold tables, add quality checks that fail the job, and schedule it as an idempotent Lakeflow Job',
  ],
  mess: [
    ['Replayed events', 'About 2% of events arrive twice, exactly the same.', 'Deduplicate on order_id, keep the latest update.'],
    ['Status updates', 'Each order arrives as "placed", then "delivered" or "cancelled", sometimes in the next day\'s file.', 'Keep one row per order: the latest by updated_at.'],
    ['Late arrivals', '30 orders from 1 October only show up in the 3 October file.', 'Gold must be rebuilt for past days, not just today.'],
    ['Bad rows', 'Missing order_id, dates written as 01/10/2026, negative amounts, an unknown restaurant r999.', 'Quarantine with a reason. Never drop silently.'],
    ['Schema drift', 'On 3 October a new coupon_code field appears and some amounts arrive as text like "₹349.00".', 'Auto Loader rescue mode, then clean the amount.'],
    ['Messy cities', 'Bangalore, BANGALORE and " bengaluru" are one city. Bombay is Mumbai.', 'One clean_city rule, used everywhere.'],
    ['Changing restaurants', 'On 3 October restaurant r007 moves from Pune to Mumbai and r012 is renamed.', 'SCD Type 2: orders before the move stay in Pune.'],
  ],
}

export function steps(E) {
  return [
    {
      id: 'setup',
      title: 'Set up the workspace',
      time: '20 min',
      ask: `Create a free account on **Databricks Free Edition**. Then create three schemas, one per layer, and two volumes: one for the raw files and one for streaming checkpoints.

Upload only **orders_2026-10-01.json** to \`raw/orders/\` for now, plus both restaurant files to \`raw/restaurants/\` and deliveries.csv to \`raw/deliveries/\`. You'll add the other two order files later, to see the pipeline pick up only new files.`,
      hint: 'Free Edition gives you a catalog called workspace. In Catalog Explorer, open a volume and use "Upload to this volume". You can create folders there too.',
      solution: `Run this in a SQL cell or the SQL editor:

\`\`\`sql
CREATE SCHEMA IF NOT EXISTS workspace.rasoirun_bronze;
CREATE SCHEMA IF NOT EXISTS workspace.rasoirun_silver;
CREATE SCHEMA IF NOT EXISTS workspace.rasoirun_gold;

CREATE VOLUME IF NOT EXISTS workspace.rasoirun_bronze.raw;
CREATE VOLUME IF NOT EXISTS workspace.rasoirun_bronze.checkpoints;
\`\`\`

Then, at the top of every notebook in this project:

\`\`\`python
from pyspark.sql import functions as F

CAT = "workspace"
RAW = f"/Volumes/{CAT}/rasoirun_bronze/raw"
CHK = f"/Volumes/{CAT}/rasoirun_bronze/checkpoints"
\`\`\``,
      check: 'In Catalog Explorer you see three schemas, and raw/orders/ holds one file.',
    },
    {
      id: 'bronze',
      title: 'Bronze: land the files as they are',
      time: '1 hour',
      ask: `Load the order files into **rasoirun_bronze.orders** with **Auto Loader**, as an incremental job that processes only files it hasn't seen and then stops. Keep every column as raw text, and add the source file name and the load time to every row.

Load restaurants and deliveries into bronze too. They are small CSV files, so a plain batch read is fine.

Run it once with the 1 October file. Then upload the 2 October and 3 October files and run it again. The second run must only pick up the two new files.`,
      hint: 'Use cloudFiles with availableNow=True so the stream processes everything new and stops. JSON columns are inferred as strings by default, which is what you want in bronze. Set schemaEvolutionMode to rescue so the new coupon_code field on 3 October lands in _rescued_data instead of stopping the stream.',
      solution: `\`\`\`python
(spark.readStream.format("cloudFiles")
    .option("cloudFiles.format", "json")
    .option("cloudFiles.schemaLocation", f"{CHK}/orders_schema")
    .option("cloudFiles.schemaEvolutionMode", "rescue")
    .load(f"{RAW}/orders/")
    .select("*",
            F.col("_metadata.file_path").alias("_source_file"),
            F.current_timestamp().alias("_ingested_at"))
    .writeStream
    .option("checkpointLocation", f"{CHK}/orders")
    .trigger(availableNow=True)
    .toTable(f"{CAT}.rasoirun_bronze.orders")
    .awaitTermination())

for name in ["restaurants", "deliveries"]:
    (spark.read.option("header", True).csv(f"{RAW}/{name}/")
        .withColumn("_source_file", F.col("_metadata.file_path"))
        .withColumn("_ingested_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", True)
        .saveAsTable(f"{CAT}.rasoirun_bronze.{name}"))
\`\`\`

**Why it works:** the checkpoint remembers which files were processed, so a rerun only reads new files. Bronze keeps everything, including bad rows, so you can always rebuild silver from it.`,
      check: `After all three order files: \`SELECT count(*) FROM workspace.rasoirun_bronze.orders\` returns **${n(E.bronzeRows)}**. Deliveries has **${n(E.deliveriesRows)}** rows.`,
    },
    {
      id: 'silver',
      title: 'Silver: clean, quarantine and deduplicate orders',
      time: '2 hours',
      ask: `Turn bronze orders into **rasoirun_silver.orders**, with one row per order and proper types:

1. Parse **order_ts** and **updated_at** as timestamps. Strip "₹" and any other text from **amount** and store it as a decimal. Pick up **coupon_code**, whether it is a real column or sitting in _rescued_data.
2. Send bad rows to **rasoirun_silver.orders_quarantine** with a reason. Bad means a missing order_id, an order_ts that won't parse, a missing or negative amount, or a restaurant that isn't in the restaurant files.
3. Keep only the latest event for each order, by updated_at.
4. MERGE the result into silver, so that reruns and late files update rows instead of duplicating them.`,
      hint: 'Databricks runs with ANSI mode on, so a bad cast raises an error. Use try_to_timestamp and try_cast so a bad value becomes NULL, then quarantine it. For the latest event, use row_number() over a window partitioned by order_id and ordered by updated_at descending.',
      solution: `\`\`\`python
from pyspark.sql.window import Window

o = spark.table(f"{CAT}.rasoirun_bronze.orders")

# coupon_code is a real column if Auto Loader saw it while inferring, otherwise it is in _rescued_data
coupon = F.get_json_object("_rescued_data", "$.coupon_code")
if "coupon_code" in o.columns:
    coupon = F.coalesce(F.col("coupon_code"), coupon)

typed = o.select(
    "order_id", "customer_id", "restaurant_id", "status",
    F.try_to_timestamp("order_ts", F.lit("yyyy-MM-dd HH:mm:ss")).alias("order_ts"),
    F.try_to_timestamp("updated_at", F.lit("yyyy-MM-dd HH:mm:ss")).alias("updated_at"),
    F.expr("try_cast(regexp_replace(amount, '[^0-9.-]', '') AS DECIMAL(10,2))").alias("amount"),
    coupon.alias("coupon_code"),
    "_source_file",
)

known = (spark.table(f"{CAT}.rasoirun_bronze.restaurants")
         .select("restaurant_id").distinct().withColumn("_known", F.lit(True)))

flagged = (typed.join(known, "restaurant_id", "left")
    .withColumn("_reason",
        F.when(F.col("order_id").isNull(), "missing order_id")
         .when(F.col("order_ts").isNull(), "bad order_ts")
         .when(F.col("amount").isNull() | (F.col("amount") < 0), "bad amount")
         .when(F.col("_known").isNull(), "unknown restaurant"))
    .drop("_known"))

(flagged.where("_reason IS NOT NULL")
    .withColumn("_quarantined_at", F.current_timestamp())
    .write.mode("overwrite").saveAsTable(f"{CAT}.rasoirun_silver.orders_quarantine"))

w = Window.partitionBy("order_id").orderBy(F.col("updated_at").desc())
latest = (flagged.where("_reason IS NULL").drop("_reason")
          .withColumn("_rn", F.row_number().over(w)).where("_rn = 1").drop("_rn"))

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {CAT}.rasoirun_silver.orders (
  restaurant_id STRING, order_id STRING, customer_id STRING, status STRING,
  order_ts TIMESTAMP, updated_at TIMESTAMP, amount DECIMAL(10,2),
  coupon_code STRING, _source_file STRING)
""")

latest.createOrReplaceTempView("latest_orders")
spark.sql(f"""
MERGE INTO {CAT}.rasoirun_silver.orders t
USING latest_orders s
ON t.order_id = s.order_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
""")
\`\`\`

**Why the MERGE condition matters:** \`s.updated_at > t.updated_at\` means an old replay can never overwrite a newer status. Run the cell twice and nothing changes.`,
      check: `Silver has **${n(E.silverOrders)}** orders and the quarantine has **${n(E.quarantineRows)}** rows. \`SELECT count(*) - count(DISTINCT order_id) FROM workspace.rasoirun_silver.orders\` returns **0**.`,
    },
    {
      id: 'scd2',
      title: 'Restaurant history with SCD Type 2',
      time: '1.5 hours',
      ask: `Build **rasoirun_silver.dim_restaurant** from the two restaurant files. Each file is a full snapshot, and the date in its file name is the date it became true.

Clean the city names first, so that Bangalore and BANGALORE don't count as a change. When a restaurant's name, city or cuisine changes, close the old row (set valid_to and is_current = false) and insert a new current row. Make the step safe to rerun: a snapshot that has already been applied must not be applied again.`,
      hint: 'The classic Delta pattern: stage the snapshot twice. One copy has merge_key = restaurant_id, which matches and closes the current row. The other copy holds only the changed rows with merge_key = NULL, so they never match and are inserted as new versions.',
      solution: `\`\`\`python
from delta.tables import DeltaTable

def clean_city(c):
    c = F.initcap(F.trim(c))
    return (F.when(c == "Bangalore", "Bengaluru")
             .when(c == "Bombay", "Mumbai")
             .when(c == "New Delhi", "Delhi")
             .otherwise(c))

snaps = (spark.table(f"{CAT}.rasoirun_bronze.restaurants")
    .withColumn("as_of", F.to_timestamp(F.regexp_extract("_source_file", r"(\\d{4}-\\d{2}-\\d{2})", 1)))
    .withColumn("city", clean_city(F.col("city"))))

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {CAT}.rasoirun_silver.dim_restaurant (
  restaurant_id STRING, name STRING, city STRING, cuisine STRING,
  valid_from TIMESTAMP, valid_to TIMESTAMP, is_current BOOLEAN)
""")
dim = DeltaTable.forName(spark, f"{CAT}.rasoirun_silver.dim_restaurant")
DIM = f"{CAT}.rasoirun_silver.dim_restaurant"
done_up_to = spark.table(DIM).agg(F.max("valid_from")).first()[0]

for (as_of,) in snaps.select("as_of").distinct().orderBy("as_of").collect():
    if done_up_to is not None and as_of <= done_up_to:
        continue  # this snapshot is already in the table
    snap = snaps.where(F.col("as_of") == F.lit(as_of)).select("restaurant_id", "name", "city", "cuisine")
    cur = spark.table(DIM).where("is_current")  # re-read: the last loop may have changed it
    changed = (snap.alias("s")
        .join(cur.alias("c"), F.col("s.restaurant_id") == F.col("c.restaurant_id"))
        .where("s.name <> c.name OR s.city <> c.city OR s.cuisine <> c.cuisine")
        .select("s.*"))
    staged = (snap.withColumn("merge_key", F.col("restaurant_id"))
        .unionByName(changed.withColumn("merge_key", F.lit(None).cast("string"))))
    (dim.alias("t")
        .merge(staged.alias("s"), "t.restaurant_id = s.merge_key AND t.is_current")
        .whenMatchedUpdate(
            condition="t.name <> s.name OR t.city <> s.city OR t.cuisine <> s.cuisine",
            set={"is_current": F.lit(False), "valid_to": F.lit(as_of)})
        .whenNotMatchedInsert(values={
            "restaurant_id": "s.restaurant_id", "name": "s.name",
            "city": "s.city", "cuisine": "s.cuisine",
            "valid_from": F.lit(as_of),
            "valid_to": F.lit(None).cast("timestamp"),
            "is_current": F.lit(True)})
        .execute())
\`\`\`

**Interview line:** "SCD2 lets every order join the restaurant as it was at order time, so last month's revenue doesn't move when a restaurant changes city today."`,
      check: `\`SELECT count(*), count_if(is_current) FROM workspace.rasoirun_silver.dim_restaurant\` returns **${E.dimRows}** and **${E.dimCurrent}**. r007 has two rows: Pune (closed) and Mumbai (current).`,
    },
    {
      id: 'gold',
      title: 'Gold: the two tables your lead asked for',
      time: '1 hour',
      ask: `Build **rasoirun_gold.daily_city_revenue**: delivered orders, revenue and average order value by order date and city.

Build **rasoirun_gold.daily_city_delivery**: delivered orders, average minutes from order to doorstep, and on-time % (45 minutes or less) by order date and city.

Each order must use the restaurant's city **at order time**. Remember that late files change past days, so rebuild the gold tables fully each run.`,
      hint: 'Join on restaurant_id AND order_ts >= valid_from AND (valid_to IS NULL OR order_ts < valid_to). deliveries.csv has a few duplicate rows, so collapse it to one row per order before you join.',
      solution: `\`\`\`sql
CREATE OR REPLACE TABLE workspace.rasoirun_gold.daily_city_revenue AS
SELECT to_date(o.order_ts) AS order_date,
       r.city,
       count(*)                AS delivered_orders,
       sum(o.amount)           AS revenue,
       round(avg(o.amount), 2) AS avg_order_value
FROM workspace.rasoirun_silver.orders o
JOIN workspace.rasoirun_silver.dim_restaurant r
  ON o.restaurant_id = r.restaurant_id
 AND o.order_ts >= r.valid_from
 AND (r.valid_to IS NULL OR o.order_ts < r.valid_to)
WHERE o.status = 'delivered'
GROUP BY ALL;

CREATE OR REPLACE TABLE workspace.rasoirun_gold.daily_city_delivery AS
WITH d AS (
  SELECT order_id, max(to_timestamp(delivered_ts)) AS delivered_ts
  FROM workspace.rasoirun_bronze.deliveries
  GROUP BY order_id
),
x AS (
  SELECT to_date(o.order_ts) AS order_date, r.city,
         (unix_timestamp(d.delivered_ts) - unix_timestamp(o.order_ts)) / 60 AS minutes
  FROM workspace.rasoirun_silver.orders o
  JOIN d ON d.order_id = o.order_id
  JOIN workspace.rasoirun_silver.dim_restaurant r
    ON o.restaurant_id = r.restaurant_id
   AND o.order_ts >= r.valid_from
   AND (r.valid_to IS NULL OR o.order_ts < r.valid_to)
  WHERE o.status = 'delivered'
)
SELECT order_date, city,
       count(*)                                                   AS delivered_orders,
       round(avg(minutes), 1)                                     AS avg_minutes,
       round(100 * avg(CASE WHEN minutes <= 45 THEN 1 ELSE 0 END), 1) AS on_time_pct
FROM x
GROUP BY ALL;
\`\`\``,
      check: `Bengaluru on 2026-10-01 has revenue **₹${m(E.revenueBlr1)}**. Pune on 2026-10-03 has **₹${m(E.revenuePuneDay3)}** (r007 has already moved to Mumbai). Total revenue across all days is **₹${m(E.revenueTotal)}**, from **${n(E.deliveredOrders)}** delivered orders. Across all cities and days, **${E.onTimePct}%** of deliveries are on time.`,
    },
    {
      id: 'quality',
      title: 'Quality checks that fail the job',
      time: '45 min',
      ask: `Write a checks notebook that **fails** when the data is wrong, so a bad day turns into an alert instead of a wrong dashboard:

- no duplicate order_id in silver
- no negative or NULL amounts in silver
- every silver order finds exactly one restaurant version at order time
- gold revenue equals the delivered revenue in silver
- the quarantine is under 2% of bronze, because more than that means the source broke`,
      hint: 'Each check is a query that should return 0. Collect the failures and raise one error listing all of them, so the job log tells you everything at once.',
      solution: `\`\`\`python
S, G, B = f"{CAT}.rasoirun_silver", f"{CAT}.rasoirun_gold", f"{CAT}.rasoirun_bronze"
checks = {
    "duplicate order_id in silver":
        f"SELECT count(*) - count(DISTINCT order_id) FROM {S}.orders",
    "negative or null amount":
        f"SELECT count(*) FROM {S}.orders WHERE amount IS NULL OR amount < 0",
    "orders without exactly one restaurant version": f"""
        SELECT count(*) FROM (
          SELECT o.order_id, count(r.restaurant_id) AS n
          FROM {S}.orders o LEFT JOIN {S}.dim_restaurant r
            ON o.restaurant_id = r.restaurant_id AND o.order_ts >= r.valid_from
           AND (r.valid_to IS NULL OR o.order_ts < r.valid_to)
          GROUP BY o.order_id) WHERE n <> 1""",
    "gold revenue does not match silver": f"""
        SELECT CASE WHEN (SELECT sum(revenue) FROM {G}.daily_city_revenue) =
                         (SELECT sum(amount) FROM {S}.orders WHERE status = 'delivered')
               THEN 0 ELSE 1 END""",
    "quarantine above 2% of bronze": f"""
        SELECT CASE WHEN (SELECT count(*) FROM {S}.orders_quarantine) >
                         0.02 * (SELECT count(*) FROM {B}.orders) THEN 1 ELSE 0 END""",
}
failed = [f"{name}: {v}" for name, q in checks.items() if (v := spark.sql(q).first()[0]) != 0]
if failed:
    raise Exception("Data quality failed:\\n" + "\\n".join(failed))
print(f"All {len(checks)} checks passed")
\`\`\``,
      check: `All 5 checks pass. Then try breaking it: run \`UPDATE workspace.rasoirun_silver.orders SET amount = -1 WHERE order_id = 'RR000001'\` and watch the check fail. Rerunning silver won't undo it, because the MERGE only accepts newer events. Use Delta time travel instead: find the version before your update with \`DESCRIBE HISTORY workspace.rasoirun_silver.orders\`, then run \`RESTORE TABLE workspace.rasoirun_silver.orders TO VERSION AS OF <that version>\`.`,
    },
    {
      id: 'job',
      title: 'Schedule it and prove reruns are safe',
      time: '45 min',
      ask: `Create a **Lakeflow Job** (Jobs & Pipelines → Create job) with five tasks: bronze → silver orders and dim_restaurant (run in parallel) → gold → checks. Schedule it daily at 6:00 AM IST, and email yourself on failure.

Then prove it is idempotent: run the whole job twice in a row. Every checkpoint number above must stay exactly the same.`,
      hint: 'Put each step in its own notebook and add the notebooks as tasks. "Depends on" sets the order. Silver and the dimension both depend only on bronze, so they run side by side.',
      solution: `**Task graph**

| Task | Notebook | Depends on |
|---|---|---|
| bronze | 01_bronze | — |
| silver_orders | 02_silver_orders | bronze |
| dim_restaurant | 03_dim_restaurant | bronze |
| gold | 04_gold | silver_orders, dim_restaurant |
| checks | 05_checks | gold |

**Why a rerun is safe:** Auto Loader skips files it has seen. The MERGE only updates when updated_at is newer. The dimension skips snapshots it already applied. Gold is fully rebuilt from silver. So running the job twice gives the same tables, which is exactly what an on-call engineer needs at 3 AM.

**Go further:** swap the schedule for a *file arrival* trigger on the raw/orders volume, so the job runs the moment a new file lands.`,
      check: 'Two runs in a row both go green, and every number from steps 2 to 5 is unchanged.',
    },
  ]
}

export const README = `# RasoiRun orders lakehouse

Daily revenue and delivery SLA for a food-delivery app, built on Databricks with a medallion architecture.

## Problem
Finance and ops read raw order events directly and got different numbers. They were double counting replays, missing late orders, and disagreeing about restaurant cities.

## Architecture
raw JSON/CSV (volume) → **bronze** (Auto Loader, schema rescue) → **silver** (typed, deduplicated with MERGE, quarantine, SCD2 restaurants) → **gold** (revenue and on-time by city and day) → quality checks → Lakeflow Job at 6 AM.

## What makes it production-grade
- Incremental: Auto Loader only reads new files.
- Idempotent: the MERGE only applies newer updates, the dimension skips applied snapshots, and gold is rebuilt. Reruns change nothing.
- Honest: bad rows go to a quarantine table with a reason, and a job fails if quarantine goes above 2%.
- Correct history: SCD Type 2, so every order joins the restaurant version valid at order time.

## Results
- 7,254 raw events → 3,630 clean orders, 48 quarantined.
- Revenue reconciles exactly between silver and gold. 5 automated checks run on every load.

## Run it
1. Upload the raw files to /Volumes/workspace/rasoirun_bronze/raw/.
2. Run notebooks 01 to 05, or the job definition in /jobs.
`

export const TALKING = [
  ['Why bronze at all?', 'So you can replay. When a bug in silver shows up, you fix the code and rebuild from bronze, without asking the source team to resend files.'],
  ['How did you handle duplicates?', 'Two kinds. Exact replays, and many status events per order. Both collapse with row_number over order_id ordered by updated_at, and the MERGE only accepts a newer updated_at, so an old replay can never overwrite a newer status.'],
  ['What happens with late data?', 'Late orders land in silver through the MERGE like any other. Gold is rebuilt from silver, so past days correct themselves. At real scale I would only rebuild the affected dates with replaceWhere.'],
  ['What if the schema changes?', 'Auto Loader in rescue mode puts unknown fields in _rescued_data, so the stream never stops. Silver picks up coupon_code from either place, and I get a quality signal if the rescued column suddenly fills up.'],
  ['Why SCD2 and not just overwrite?', 'Because the business asks "what did Pune earn last month?". If r007\'s move to Mumbai overwrote its city, Pune\'s past revenue would silently drop.'],
]

export const RESUME = [
  'Built a medallion lakehouse on Databricks (Auto Loader, Delta MERGE, SCD Type 2) that turned 7K raw order events into reconciled daily revenue and delivery-SLA tables.',
  'Made the pipeline idempotent and self-checking: quarantine with reasons, 5 automated quality gates and a scheduled Lakeflow Job that reruns with zero drift.',
]
