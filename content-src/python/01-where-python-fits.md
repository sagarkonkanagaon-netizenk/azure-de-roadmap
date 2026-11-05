# Where Python fits in data engineering

By the end of this chapter you know what data engineers actually use Python for, where SQL or Spark is the better tool, and how to run every example in this handbook without installing anything.

## What the job looks like

SQL moves and reshapes data that already sits in a warehouse. Python does everything around it:

- **Ingestion.** Call an API, page through the results, land the raw JSON in storage.
- **Glue.** Read a file from S3 or ADLS, check it, rename it, trigger the next step.
- **Orchestration.** Airflow DAGs, Databricks jobs and Prefect flows are Python files.
- **Transformation at scale.** PySpark is Python on top of a cluster. The syntax you learn here carries straight over.
- **Quality and testing.** Validate rows, compare row counts, unit test a transform before it touches production.
- **Tooling.** Small command-line tools, backfill scripts and one-off fixes that save a team hours.

A useful rule: **if the data is already in a database, push the work to SQL. If you need to fetch, loop, branch, retry or call something, use Python.** Most real pipelines use both.

## Python versus the alternatives

| Task | Best tool | Why |
| --- | --- | --- |
| Aggregate 500 million rows in a warehouse | SQL | The engine is built for it and the data never leaves |
| Call a paginated REST API every hour | Python | Loops, retries and auth are natural |
| Join two 2 TB datasets | PySpark or Spark SQL | Needs a cluster |
| Clean a 200 MB CSV once | pandas | Fast to write, fits in memory |
| Validate every file that lands in a folder | Python | Branching logic and good error messages |

## Running code in this handbook

Every Python block with a **Run it** button runs right here, in your browser, using a real Python 3 interpreter (Pyodide). The first run takes a few seconds to start; after that it is instant. You can **edit any block** before running it. Blocks on a page share one Python session, like cells in a notebook, so run them top to bottom.

Try it. Change the name and run it again:

```python
name = "Asha"
orders = [1200, 450, 3100]
print(f"{name} placed {len(orders)} orders worth ₹{sum(orders):,}")
```

The last line of a block is shown automatically if it is a value, exactly like a notebook:

```python
max(orders) - min(orders)
```

Blocks marked without a Run button show code that needs a real machine, such as a cloud SDK or a scheduler.

## What a small pipeline looks like

Here is the shape you will build in the final chapter of this handbook: extract, validate, transform, load. Read it now and come back to it at the end.

```python
raw = [
    {"order_id": "1", "amount": "1200", "city": " pune "},
    {"order_id": "2", "amount": "abc",  "city": "Delhi"},
    {"order_id": "3", "amount": "300",  "city": "goa"},
]

def clean(row):
    return {"order_id": int(row["order_id"]),
            "amount": float(row["amount"]),
            "city": row["city"].strip().title()}

good, bad = [], []
for row in raw:
    try:
        good.append(clean(row))
    except ValueError as e:
        bad.append({**row, "error": str(e)})

print("loaded:", good)
print("rejected:", bad)
```

Notice what a pipeline cares about that a coding puzzle doesn't: **bad rows are kept, not lost**, and the error says why. That habit is the difference between a script and a pipeline.

## How this handbook is organised

1. The language, fast: types, data structures, functions, strings, errors.
2. Working with data: files, CSV, JSON, dates, big files with generators.
3. Writing code a team can run: classes, decorators, logging, config, APIs.
4. pandas and databases.
5. Testing, concurrency and packaging.
6. A complete mini pipeline, then an interview playbook.

## In the interview

- *"When would you use Python instead of SQL?"* Say: SQL for set-based work on data that is already in a database; Python for fetching, branching, retrying, calling services and orchestration. Then give one example from your own work.
- *"Which Python libraries do you use as a data engineer?"* A strong short list: `pandas`, `pyarrow`, `requests`, `boto3` or `azure-storage-blob`, `sqlalchemy`, `pytest`, and `pyspark`.

```quiz
Which job is a better fit for Python than for SQL?
- Summing sales per month in a warehouse table
* Calling a paginated API every hour and landing the JSON
- Joining two tables that are already in the warehouse
> Loops, retries and authentication are where Python shines. Set-based work on data in a database belongs to SQL.
---
In this handbook, what happens when you run two blocks on the same page?
* They share one Python session, so the second can use variables from the first
- Each block starts a fresh Python, so nothing carries over
- Only the last block on the page can be run
> Blocks on a page work like notebook cells. Run them top to bottom.
---
What separates a pipeline from a quick script in the example above?
- It uses a for loop
* Bad rows are kept with the reason they failed, instead of disappearing
- It prints its output
> Pipelines are judged on what happens to bad data. Silently dropping rows is the classic bug.
```

```practice
page /practice/python Open the Python lab
py 1
py 3
```
