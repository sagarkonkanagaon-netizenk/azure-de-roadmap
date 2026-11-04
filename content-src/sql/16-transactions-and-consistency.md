# Transactions and consistency

By the end of this chapter you can explain ACID in plain words, group statements into a transaction, describe isolation levels and the anomalies they prevent, and explain how lakehouse formats like Delta Lake bring transactions to files.

## Why a DE cares

A load that deletes yesterday's rows and then crashes before inserting the new ones leaves a hole in every report. A reader that sees half of a big update shows numbers that never existed. Transactions are how databases stop that, and table formats like Delta Lake and Iceberg exist largely to bring the same guarantees to files in cloud storage.

## ACID in plain words

| Letter | Promise | Without it |
|---|---|---|
| Atomicity | all of a transaction happens, or none of it | half-finished loads |
| Consistency | constraints hold before and after | orphan rows, duplicate keys |
| Isolation | concurrent transactions don't see each other's half-done work | reports reading partial data |
| Durability | once committed, it survives a crash | "successful" loads that vanish |

## A transaction

```sql
CREATE TABLE accounts(id INTEGER PRIMARY KEY, owner VARCHAR, balance DECIMAL(12, 2));
INSERT INTO accounts VALUES (1, 'Asha', 5000), (2, 'Ravi', 1000);

BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 700 WHERE id = 1;
UPDATE accounts SET balance = balance + 700 WHERE id = 2;
COMMIT;

SELECT * FROM accounts ORDER BY id;
```

Both updates commit together. Now a failure:

```sql
CREATE TABLE accounts(id INTEGER PRIMARY KEY, owner VARCHAR, balance DECIMAL(12, 2));
INSERT INTO accounts VALUES (1, 'Asha', 5000), (2, 'Ravi', 1000);

BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 700 WHERE id = 1;
-- something goes wrong here, so we undo everything since BEGIN
ROLLBACK;

SELECT * FROM accounts ORDER BY id;
```

Asha keeps her ₹5,000. In application code, the pattern is: begin, do the work, commit if everything succeeded, roll back on any error.

## Isolation levels and anomalies

When two transactions run at the same time, these things can go wrong:

- **Dirty read:** reading another transaction's uncommitted change, which may be rolled back.
- **Non-repeatable read:** reading the same row twice in one transaction and getting different values.
- **Phantom read:** running the same query twice and getting extra rows that someone inserted in between.
- **Lost update:** two transactions read a value, both change it, and one overwrites the other.

| Level | Prevents | Common default in |
|---|---|---|
| Read uncommitted | nothing | rarely used |
| Read committed | dirty reads | Postgres, SQL Server, Oracle |
| Repeatable read | + non-repeatable reads | MySQL InnoDB |
| Serializable | everything: as if run one at a time | strictest, slowest |
| Snapshot isolation | readers see a consistent snapshot as of their start | Delta Lake, Iceberg, Snowflake, DuckDB |

Most analytics engines use snapshot isolation through **multi-version concurrency control (MVCC)**: writers create new versions, readers keep reading the version that was current when they started. Readers never block writers and never see half a load.

## Transactions on a lakehouse

Plain Parquet files in a folder have no transactions. If a Spark job writing 200 files dies after 120, readers see 120 files. Delta Lake fixes this with a transaction log (`_delta_log`): a write adds files and then records one commit entry listing them. Readers only trust files named in committed log entries, so a half-finished write is invisible.

That log also gives you:

- **Time travel:** `SELECT * FROM t VERSION AS OF 12` or `TIMESTAMP AS OF '2025-06-01'`.
- **Rollback:** `RESTORE TABLE t TO VERSION AS OF 12` after a bad load.
- **Concurrent writers:** optimistic concurrency. Two jobs writing to different partitions both succeed; two changing the same files conflict, and one retries.

```sql norun
DESCRIBE HISTORY silver.orders;                       -- who changed what, when
SELECT COUNT(*) FROM silver.orders VERSION AS OF 41;  -- the table before the bad load
RESTORE TABLE silver.orders TO VERSION AS OF 41;      -- undo it
```

These run on Databricks and on Spark with Delta. Iceberg has the same ideas with snapshots.

## Constraints

Constraints let the database refuse bad data:

```sql
CREATE TABLE orders_clean (
    order_id    INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    quantity    INTEGER CHECK (quantity > 0),
    status      VARCHAR CHECK (status IN ('placed', 'shipped', 'delivered', 'cancelled', 'returned'))
);
INSERT INTO orders_clean VALUES (1, 10, 2, 'delivered');
SELECT * FROM orders_clean;
```

Try inserting `(2, 10, 0, 'delivered')` and it's rejected. Many warehouses (Snowflake, BigQuery, Databricks) accept PRIMARY KEY and FOREIGN KEY declarations but don't enforce them; they're hints for the optimiser and for documentation. Delta Lake enforces NOT NULL and CHECK constraints. So on a warehouse, uniqueness is your pipeline's job: test it (chapter 18).

## Common mistakes

- **Delete and insert outside a transaction.** A crash in between leaves a gap.
- **Assuming the warehouse enforces primary keys.** Usually it doesn't.
- **Long transactions** holding locks in an OLTP source while you extract. Read from a replica or use CDC.
- **Writing plain Parquet** from several jobs into one folder. Use a table format.

## In the interview

**"Explain ACID."** One plain sentence per letter, with a pipeline example for atomicity: "if my load fails halfway, readers still see yesterday's complete table."

**"How does Delta Lake give ACID on cloud storage?"** A transaction log of ordered commits. Readers only see files in committed entries; writers use optimistic concurrency; the log enables time travel and RESTORE.

```quiz
A load deletes old rows, then crashes before inserting new ones. Which ACID property would have prevented the gap?
* Atomicity
- Durability
- Consistency
> Inside one transaction, the delete and insert commit together or not at all.
---
What does snapshot isolation guarantee a reader?
- It sees every change as soon as it is written
* It sees a consistent version of the data as of when it started, never half a write
- It blocks all writers
> MVCC keeps old versions for readers while writers create new ones.
---
On most cloud warehouses, what does a declared PRIMARY KEY do?
- Rejects duplicate rows
* Documents the key and helps the optimiser, but duplicates are still accepted
- Creates an index that sorts the table
> Test uniqueness in the pipeline instead of trusting the constraint.
```

```practice
sql 76
sql 65
```
