# pandas in real pipelines

By the end of this chapter you can take messy source data through cleaning, typing, deduplication and validation, process files bigger than memory in chunks, and write columnar output. This is the gap between "knows pandas" and "can ship a pipeline with pandas".

## A messy source, like the real ones

```python
import pandas as pd
import numpy as np, io

raw_csv = """order_id,customer,amount,currency,order_ts,status
1001, Asha ,250.00,INR,2025-12-01 09:15:00,PAID
1002,Ravi,"1,200.50",inr,2025-12-01 10:02:00,paid
1003,asha,80,INR,2025/12/02 11:00,PAID
1003,asha,80,INR,2025/12/02 11:00,PAID
1004,Meera,,INR,2025-12-02 12:30:00,CANCELLED
1005,Kabir,640,USD,not a date,PAID
1006,,99,INR,2025-12-03 08:00:00,Paid
"""
df = pd.read_csv(io.StringIO(raw_csv), dtype=str)    # read everything as text first
df
```

Reading as `dtype=str` first is a deliberate habit: nothing gets silently guessed, and you convert each column on purpose.

## Clean and type each column

```python
clean = df.assign(
    customer=df["customer"].str.strip().str.title(),
    currency=df["currency"].str.upper(),
    status=df["status"].str.upper(),
    amount=pd.to_numeric(df["amount"].str.replace(",", ""), errors="coerce"),
    order_ts=pd.to_datetime(df["order_ts"], errors="coerce", format="mixed"),
    order_id=pd.to_numeric(df["order_id"], errors="coerce").astype("Int64"),
)
print(clean.dtypes, "\n")
clean
```

`errors="coerce"` turns anything unparseable into `NaN`/`NaT` instead of crashing. That's only safe if you then *count and quarantine* those rows, which is next.

## Validate and quarantine

Never drop bad rows silently. Split them out with a reason, so someone can fix the source.

```python
rules = {
    "missing_customer": clean["customer"].isna() | clean["customer"].eq(""),
    "bad_amount":       clean["amount"].isna() & clean["status"].ne("CANCELLED"),
    "bad_timestamp":    clean["order_ts"].isna(),
    "bad_currency":     ~clean["currency"].isin(["INR", "USD", "EUR"]),
}
reasons = pd.DataFrame(rules)
clean["reject_reason"] = reasons.apply(lambda r: ",".join(r.index[r]), axis=1)

good = clean[clean["reject_reason"] == ""].drop(columns="reject_reason")
bad = clean[clean["reject_reason"] != ""]
print(f"good={len(good)} bad={len(bad)}")
bad[["order_id", "customer", "amount", "order_ts", "reject_reason"]]
```

## Deduplicate on the business key

```python
before = len(good)
good = (good.sort_values("order_ts")
            .drop_duplicates(subset="order_id", keep="last"))
print(f"removed {before - len(good)} duplicate(s)")
assert good["order_id"].is_unique
```

Deduplicate on the key that defines "the same record", not on every column. Sort first so `keep="last"` keeps the newest version.

## Memory: dtypes matter

```python
n = 200_000
big = pd.DataFrame({
    "city": np.random.choice(["Pune", "Mumbai", "Delhi", "Chennai"], n),
    "qty": np.random.randint(1, 10, n),
    "price": np.random.uniform(10, 999, n),
})
def mb(frame):
    return round(frame.memory_usage(deep=True).sum() / 1e6, 1)

print("before:", mb(big), "MB")
small = big.astype({"city": "category", "qty": "int8", "price": "float32"})
print("after: ", mb(small), "MB")
```

A text column with few distinct values becomes `category`, small integers become `int8`. That's often 5 to 10x less memory, which decides whether a job fits on the machine at all.

## Files bigger than memory: chunks

`chunksize` gives you an iterator of DataFrames. Aggregate each chunk and combine the partial results.

```python
big.to_csv("sales.csv", index=False)

totals = None
for i, chunk in enumerate(pd.read_csv("sales.csv", chunksize=50_000,
                                      dtype={"city": "category", "qty": "int8"})):
    chunk["revenue"] = chunk["qty"] * chunk["price"]
    part = chunk.groupby("city", observed=True)["revenue"].sum()
    totals = part if totals is None else totals.add(part, fill_value=0)
print("chunks:", i + 1)
totals.round(0).sort_values(ascending=False)
```

This works for sums, counts, min and max. For an average, keep sums and counts separately and divide at the end. Averaging the chunk averages gives the wrong answer.

## Writing columnar output

Parquet stores types, compresses well, and lets readers load only the columns they need. In a real pipeline:

```python norun
good.to_parquet(
    "silver/orders/",
    engine="pyarrow",
    partition_cols=["order_date"],      # one folder per day
    index=False,
)
back = pd.read_parquet("silver/orders/", columns=["order_id", "amount"],
                       filters=[("order_date", ">=", "2025-12-02")])
```

`partition_cols` writes one folder per value, and `filters` lets readers skip whole folders. The same idea powers Spark, Delta Lake and Iceberg.

## A pipeline as small, testable functions

```python
def extract(text):
    return pd.read_csv(io.StringIO(text), dtype=str)

def transform(df):
    out = df.assign(
        customer=df["customer"].str.strip().str.title(),
        amount=pd.to_numeric(df["amount"].str.replace(",", ""), errors="coerce"),
        order_ts=pd.to_datetime(df["order_ts"], errors="coerce", format="mixed"),
    )
    bad_mask = out["customer"].isna() | out["order_ts"].isna()
    good = out[~bad_mask].drop_duplicates("order_id", keep="last")
    return good, out[bad_mask]

def check(good):
    assert good["order_id"].is_unique, "duplicate order ids"
    assert (good["amount"].dropna() >= 0).all(), "negative amounts"
    return good

good, bad = transform(extract(raw_csv))
check(good)
print(f"loaded {len(good)}, quarantined {len(bad)}")
```

Each step takes a DataFrame and returns one, so each can be tested on a three-row example. That's the subject of the testing chapter.

## Common mistakes

- Letting `read_csv` guess types, so `"007"` becomes `7` and IDs lose leading zeros.
- `errors="coerce"` without counting the new nulls, which hides bad data.
- Deduplicating on all columns when a changed field makes "duplicates" look different.
- Averaging per-chunk averages.
- Writing CSV between pipeline stages, losing types every time.

## In the interview

- *"How would you process a 20 GB CSV on a 16 GB laptop with pandas?"* Read in chunks with explicit, small dtypes and only the needed `usecols`, aggregate per chunk and combine, or convert once to Parquet. If it keeps growing, move to DuckDB, Polars or Spark.
- *"How do you handle bad records?"* Validate with explicit rules, quarantine rows with a reason, count them in the logs, alert above a threshold, and never drop silently.

```quiz
Why read a raw CSV with dtype=str first?
* So nothing is silently guessed, like IDs losing leading zeros
- Because it's faster
- Because pandas can't read numbers
> You then convert each column on purpose and catch the rows that fail.
---
You average a column across 10 chunks. What's correct?
- Average the 10 chunk averages
* Keep total sum and total count, divide at the end
- Use only the largest chunk
> Chunks have different sizes, so averaging averages is wrong.
---
Which turns a repeated text column like city into a far smaller one?
- object
* category
- float32
> category stores each distinct value once plus small integer codes.
```

```practice
py 34
py 40
```
