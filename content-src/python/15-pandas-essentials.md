# pandas essentials

By the end of this chapter you can load, filter, reshape, group and join data with pandas, and you'll know the handful of behaviours that cause most pandas bugs.

The first run of a pandas example takes a few seconds while pandas loads in your browser. After that it is fast.

## Series and DataFrame

A `DataFrame` is a table. Each column is a `Series`: one typed array plus an index (row labels).

```python
import pandas as pd
import numpy as np

orders = pd.DataFrame({
    "order_id":    [101, 102, 103, 104, 105, 106],
    "customer_id": ["c1", "c2", "c1", "c3", "c2", None],
    "city":        ["Pune", "Mumbai", "Pune", "Delhi", "Mumbai", "Pune"],
    "amount":      [250.0, 1200.5, 80.0, None, 640.0, 99.0],
    "order_date":  ["2025-12-01", "2025-12-01", "2025-12-02", "2025-12-02", "2025-12-03", "2025-12-03"],
})
orders["order_date"] = pd.to_datetime(orders["order_date"])
print(orders.dtypes, "\n")
orders.head()
```

Your first three calls on any new data: `df.head()`, `df.dtypes` (or `df.info()`), and `df.describe()`.

## Selecting rows and columns

```python
print(orders[["order_id", "amount"]].head(2), "\n")       # columns
print(orders.loc[orders["amount"] > 200, ["order_id", "city", "amount"]], "\n")  # filter + columns
print(orders.query("city == 'Pune' and amount < 200"))
```

- `df.loc[rows, cols]` selects by label or boolean mask.
- `df.iloc[0:3, 1]` selects by position.
- Combine conditions with `&` and `|`, each wrapped in brackets: `(df.a > 1) & (df.b == "x")`. Python's `and` raises an error here.

## Adding and changing columns

```python
orders["amount_gst"] = (orders["amount"] * 1.18).round(2)
orders["size"] = np.where(orders["amount"] >= 500, "large", "small")
orders["day"] = orders["order_date"].dt.day_name()
orders = orders.assign(is_pune=orders["city"].eq("Pune"))
orders[["order_id", "amount", "amount_gst", "size", "day", "is_pune"]]
```

Prefer whole-column operations like these to `apply` or loops. They run in compiled code and are often 100x faster.

## Missing values

`NaN` (or `None`, `NaT`) means missing. It is not equal to anything, including itself.

```python
print(orders.isna().sum(), "\n")
filled = orders.fillna({"amount": orders["amount"].median(), "customer_id": "unknown"})
print(filled[["order_id", "customer_id", "amount"]])
print("rows without customer:", orders["customer_id"].isna().sum())
```

Notice row 104 had no amount, yet its `size` came out "small", because `NaN >= 500` is False. Decide how to handle missing values *before* deriving columns from them.

## groupby: split, apply, combine

```python
by_city = (orders
           .groupby("city", as_index=False)
           .agg(orders=("order_id", "count"),
                revenue=("amount", "sum"),
                avg_order=("amount", "mean"),
                customers=("customer_id", "nunique"))
           .sort_values("revenue", ascending=False))
by_city
```

Named aggregations (`new_name=(column, function)`) give clean column names and read like SQL's `SELECT city, COUNT(*) AS orders ...`.

### transform: a group value on every row

Like a SQL window function, `transform` returns one value per original row.

```python
orders["city_total"] = orders.groupby("city")["amount"].transform("sum")
orders["share_of_city"] = (orders["amount"] / orders["city_total"]).round(3)
orders["rank_in_city"] = orders.groupby("city")["amount"].rank(ascending=False, method="dense")
orders[["order_id", "city", "amount", "city_total", "share_of_city", "rank_in_city"]]
```

## Joining

```python
customers = pd.DataFrame({
    "customer_id": ["c1", "c2", "c4"],
    "name": ["Asha", "Ravi", "Meera"],
    "tier": ["gold", "silver", "gold"],
})
joined = orders.merge(customers, on="customer_id", how="left", validate="many_to_one", indicator=True)
print(joined[["order_id", "customer_id", "name", "_merge"]])
print(joined["_merge"].value_counts())
```

Two arguments that save careers:

- `validate="many_to_one"` raises if the right table has duplicate keys, instead of silently multiplying your rows.
- `indicator=True` adds `_merge`, so you can count orders that found no customer.

## Reshaping: pivot and melt

```python
daily = orders.pivot_table(index="order_date", columns="city", values="amount",
                           aggfunc="sum", fill_value=0)
print(daily, "\n")
long = daily.reset_index().melt(id_vars="order_date", var_name="city", value_name="amount")
print(long.head())
```

`pivot_table` goes long to wide (for reports). `melt` goes wide to long (for storage and joins).

## The copy warning, explained

```python
pune = orders[orders["city"] == "Pune"].copy()     # .copy() makes it independent
pune["note"] = "west"                              # safe, no warning
print(len(pune), "Pune rows;", "note" in orders.columns)
```

Without `.copy()`, pandas may not know whether you meant to change the original table, and warns with `SettingWithCopyWarning`. To change the original, use one `loc`: `orders.loc[mask, "note"] = "west"`.

## Common mistakes

- Using `and`/`or` instead of `&`/`|` in filters, or forgetting the brackets.
- Looping with `iterrows()` over millions of rows.
- Dates left as strings, so sorting and filtering by date are wrong.
- A join with duplicate keys on the right that quietly doubles the rows.
- `NaN == NaN` is False, so `df[df.x == np.nan]` returns nothing. Use `isna()`.
- Chained assignment like `df[df.a > 1]["b"] = 0`, which may change nothing.

## In the interview

- *"Difference between loc and iloc?"* `loc` uses labels and boolean masks, `iloc` uses integer positions.
- *"groupby agg vs transform?"* `agg` returns one row per group. `transform` returns a value for every original row, like a window function.
- *"Your merge returned more rows than the left table. Why?"* Duplicate keys on the right. Check with `validate=` or `df.duplicated(key).sum()`.

```quiz
Which filter is correct in pandas?
- df[df.a > 1 and df.b < 5]
* df[(df.a > 1) & (df.b < 5)]
- df[df.a > 1 & df.b < 5]
> Use & with each condition in brackets. "and" fails, and without brackets & binds before >.
---
You need each order's share of its city's total, on every row. Which do you use?
- groupby().agg()
* groupby().transform("sum")
- pivot_table
> transform keeps the original shape, like SUM() OVER (PARTITION BY city).
---
A left merge returned more rows than the left table had. Most likely cause?
* Duplicate keys in the right table
- Missing values in the left table
- The wrong how= argument
> Each duplicate on the right multiplies the matching left rows. validate="many_to_one" catches it.
```

```practice
py 40
page /practice/python Python practice
```
