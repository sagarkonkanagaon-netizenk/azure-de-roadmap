# Databases from Python

By the end of this chapter you can connect to a database, run safe parameterised queries, load thousands of rows in batches inside a transaction, write idempotent upserts, and move data between SQL and pandas.

The examples use `sqlite3`, which ships with Python. The same DB-API pattern (connect, cursor, execute, commit) works for PostgreSQL with `psycopg`, for MySQL, for Snowflake and for most warehouse drivers.

## Connect, create, insert, query

```python
import sqlite3

conn = sqlite3.connect(":memory:")          # a file path in real life
conn.execute("""
    CREATE TABLE customers (
        customer_id TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        city        TEXT,
        updated_at  TEXT NOT NULL
    )
""")
conn.execute("INSERT INTO customers VALUES (?, ?, ?, ?)",
             ("c1", "Asha", "Pune", "2025-12-01"))
conn.commit()

for row in conn.execute("SELECT * FROM customers"):
    print(row)
```

## Never build SQL with f-strings

```python
user_input = "Pune' OR '1'='1"

unsafe = f"SELECT count(*) FROM customers WHERE city = '{user_input}'"
print("f-string query returns:", conn.execute(unsafe).fetchone()[0], "row(s): the whole table leaked")

safe = conn.execute("SELECT count(*) FROM customers WHERE city = ?", (user_input,)).fetchone()[0]
print("parameterised query returns:", safe)
```

With `?` placeholders the driver sends the value separately from the SQL, so it can never be run as code. This is SQL injection, and it's an instant interview fail if you write the f-string version. (Placeholders are `?` in sqlite and `%s` in psycopg; table and column names can't be parameters, so whitelist those.)

## Bulk loads: executemany and one transaction

```python
import time, random

rows = [(f"c{i}", f"Customer {i}", random.choice(["Pune", "Delhi", "Goa"]), "2025-12-01")
        for i in range(2, 20_002)]

t0 = time.perf_counter()
with conn:                                   # one transaction: commit on success, rollback on error
    conn.executemany("INSERT INTO customers VALUES (?, ?, ?, ?)", rows)
print(f"{len(rows):,} rows in {time.perf_counter() - t0:.2f}s")
print(conn.execute("SELECT city, count(*) FROM customers GROUP BY city ORDER BY 2 DESC").fetchall())
```

If you run this block twice you'll get a UNIQUE error, because the rows already exist. Run the first example again to start fresh.

Committing once per row would be hundreds of times slower. For very large loads, insert in batches (say 10,000 rows) per transaction, and for warehouses prefer their bulk path: `COPY` in Postgres, `COPY INTO` in Snowflake, or staging files.

## A failed batch leaves nothing behind

```python
bad_batch = [("n1", "New One", "Pune", "2025-12-02"),
             ("n2", None, "Delhi", "2025-12-02")]      # NOT NULL violation
try:
    with conn:
        conn.executemany("INSERT INTO customers VALUES (?, ?, ?, ?)", bad_batch)
except sqlite3.IntegrityError as e:
    print("rolled back:", e)
print("n1 present?", conn.execute("SELECT count(*) FROM customers WHERE customer_id='n1'").fetchone()[0])
```

## Idempotent upserts

Pipelines get re-run. A plain `INSERT` fails on the primary key (or worse, duplicates rows in a table without one). An *upsert* inserts new keys and updates existing ones, so running it twice gives the same result.

```python
changes = [("c1", "Asha K", "Mumbai", "2025-12-05"),     # changed
           ("c2", "Customer 2", "Goa", "2025-11-01"),     # older than what we have
           ("z9", "Zoya", "Goa", "2025-12-05")]           # brand new

upsert = """
INSERT INTO customers (customer_id, name, city, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT (customer_id) DO UPDATE SET
    name = excluded.name,
    city = excluded.city,
    updated_at = excluded.updated_at
WHERE excluded.updated_at > customers.updated_at       -- never overwrite newer data
"""
for _ in range(2):                                     # run it twice: same result
    with conn:
        conn.executemany(upsert, changes)

print(conn.execute("SELECT * FROM customers WHERE customer_id IN ('c1','c2','z9')").fetchall())
print("total:", conn.execute("SELECT count(*) FROM customers").fetchone()[0])
```

The `WHERE` clause matters: late-arriving old data must not overwrite newer data. In warehouses the same idea is `MERGE INTO ... WHEN MATCHED AND src.updated_at > tgt.updated_at`.

## Reading large results without loading them all

```python
cur = conn.execute("SELECT customer_id, city FROM customers ORDER BY customer_id")
seen = 0
while batch := cur.fetchmany(5_000):
    seen += len(batch)                 # process one batch at a time
print("streamed", seen, "rows")
```

## pandas and SQL together

```python
import pandas as pd

df = pd.read_sql_query(
    "SELECT city, count(*) AS customers FROM customers WHERE updated_at >= ? GROUP BY city",
    conn, params=("2025-12-01",))
print(df, "\n")

summary = df.assign(snapshot_date="2025-12-05")
summary.to_sql("city_summary", conn, if_exists="replace", index=False)
print(conn.execute("SELECT * FROM city_summary").fetchall())
```

With other databases you pass an SQLAlchemy engine instead of the raw connection: `pd.read_sql(sql, engine)`.

```python norun
from sqlalchemy import create_engine
engine = create_engine(os.environ["WAREHOUSE_URL"], pool_pre_ping=True)
df.to_sql("staging_orders", engine, if_exists="append", index=False, chunksize=10_000, method="multi")
```

## Common mistakes

- f-strings or `+` to build SQL with values in it.
- Committing after every row.
- Forgetting to commit at all, then wondering why the table is empty.
- Plain `INSERT` in a job that gets re-run, creating duplicates.
- Upserts that let old data overwrite new data.
- `fetchall()` on a 50-million-row query.
- Connection strings with passwords committed to git.

## In the interview

- *"How do you prevent SQL injection?"* Parameterised queries with placeholders; never format values into SQL. Whitelist identifiers like table names.
- *"How do you make a load idempotent?"* Upsert or MERGE on the business key with a recency check, or delete-and-insert the partition inside one transaction.
- *"How do you load a million rows fast?"* Batches in one transaction with `executemany`, or better, the database's bulk loader (`COPY`), with indexes and constraints considered.

```quiz
Which is the safe way to filter by a user-supplied city?
- f"... WHERE city = '{city}'"
* execute("... WHERE city = ?", (city,))
- "... WHERE city = '" + city + "'"
> Placeholders send the value separately, so it can't be run as SQL.
---
A job runs twice by accident. Which load keeps the table correct?
- INSERT
* INSERT ... ON CONFLICT DO UPDATE (an upsert)
- INSERT with a bigger batch size
> An upsert on the key gives the same result however many times it runs.
---
Why load 20,000 rows inside one "with conn:" block?
* One commit is much faster, and a failure rolls back the whole batch
- sqlite needs it
- It makes the rows smaller
> Per-row commits are slow and leave half-loaded tables when something fails.
```

```practice
py 34
page /playground Try the same SQL in the Playground
```
