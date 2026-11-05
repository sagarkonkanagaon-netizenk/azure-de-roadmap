# Files, paths and CSV

By the end of this chapter you read and write files safely with `with` and `pathlib`, handle CSV files the way real sources send them (quotes, commas inside values, odd encodings), and land output atomically so a crash never leaves a half-written file.

The examples write small files into the in-browser file system, so you can run them freely.

## Paths with pathlib

`pathlib.Path` replaces string juggling with `os.path`. Paths join with `/` and know their own parts.

```python
from pathlib import Path

base = Path("data")
landing = base / "landing" / "2025-12-03"
landing.mkdir(parents=True, exist_ok=True)

f = landing / "orders_001.csv"
print(f)
print(f.name, f.stem, f.suffix, f.parent.name)
print(f.with_suffix(".parquet").name)
```

## Reading and writing text

Always open files with `with`. It closes the file even if an error happens halfway.

```python
f.write_text("order_id,city,amount\n1,Pune,250\n2,Goa,1200\n", encoding="utf-8")

with open(f, encoding="utf-8") as fh:
    for line_no, line in enumerate(fh, start=1):
        print(line_no, line.rstrip("\n"))
```

Iterating over the file object reads one line at a time, so even a 20 GB file uses almost no memory. `fh.read()` loads the whole file; only do that for small files.

Always pass `encoding="utf-8"`. Without it, Python uses the machine's default, which differs between Windows and Linux, and a job that works on your laptop fails on the server.

## Listing files

```python
for i in range(3):
    (landing / f"orders_{i:03}.csv").write_text("order_id,amount\n1,10\n", encoding="utf-8")
(landing / "_SUCCESS").write_text("", encoding="utf-8")

csvs = sorted(landing.glob("*.csv"))
print([p.name for p in csvs])
print("ready to load:", (landing / "_SUCCESS").exists())
```

Many systems write a `_SUCCESS` marker when a folder is complete. Check for it before loading, or you may read a folder that is still being written.

## CSV: never split on commas yourself

Real CSV files have commas inside quoted values, quotes inside values, and line breaks inside cells. `line.split(",")` breaks on all of them. The `csv` module handles them correctly.

```python
import csv

messy = Path("data/messy.csv")
messy.write_text(
    'order_id,customer,address,amount\n'
    '1,"Rao, Asha","12 MG Road, Pune",250\n'
    '2,"Khan ""Bunty"" Imran","Flat 4\nBandra",1200\n'
    '3,Meera,Goa,\n',
    encoding="utf-8",
)

with open(messy, newline="", encoding="utf-8") as fh:
    for row in csv.DictReader(fh):
        print(row)
```

Two details matter: `newline=""` lets the `csv` module handle line endings inside quoted cells, and `DictReader` gives each row as a dict keyed by the header. Notice row 3: a missing value arrives as an empty string `''`, not `None`. Convert it yourself.

## Writing CSV

```python
rows = [
    {"order_id": 1, "city": "Pune", "note": 'said "call first"'},
    {"order_id": 2, "city": "Navi Mumbai, MH", "note": ""},
]
out = Path("data/out.csv")
with open(out, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["order_id", "city", "note"])
    w.writeheader()
    w.writerows(rows)

print(out.read_text(encoding="utf-8"))
```

The writer quotes values that contain commas or quotes for you.

## Encodings and the Excel BOM

Files exported from Excel often start with an invisible byte-order mark, so your first column is called `'﻿order_id'` instead of `'order_id'`, and lookups fail. Read such files with `encoding="utf-8-sig"`, which drops the BOM:

```python
bom = Path("data/excel_export.csv")
bom.write_bytes("﻿order_id,amount\n1,10\n".encode("utf-8"))

with open(bom, newline="", encoding="utf-8") as fh:
    print(next(csv.reader(fh)))
with open(bom, newline="", encoding="utf-8-sig") as fh:
    print(next(csv.reader(fh)))
```

Older Indian government and bank files sometimes arrive in `cp1252` or `latin-1`. If a UTF-8 read fails with `UnicodeDecodeError`, ask the source for the encoding rather than guessing; `errors="replace"` hides the problem by turning bad bytes into `�`.

## Write atomically

If a job crashes while writing `report.csv`, readers may pick up a half-written file. Write to a temporary name in the same folder, then rename. A rename within one file system is atomic: readers see the old file or the new one, never half.

```python
import os, tempfile

def write_atomic(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp_", suffix=path.suffix)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)          # atomic swap
    except BaseException:
        os.remove(tmp)
        raise

write_atomic(Path("data/gold/daily_sales.csv"), "day,revenue\n2025-12-03,48210\n")
print(Path("data/gold/daily_sales.csv").read_text())
```

Object stores like S3 and ADLS don't have a real rename, but the same idea applies: write to a staging prefix, then publish by writing a manifest or `_SUCCESS` marker last.

## Common mistakes

- `line.split(",")` on CSV. Use the `csv` module.
- Opening without `encoding="utf-8"`.
- Forgetting `newline=""` with the `csv` module.
- Reading a landing folder before its `_SUCCESS` marker exists.
- Writing the final file directly, so a crash leaves a partial file.

## In the interview

- *"How would you read a 30 GB CSV on a laptop with 8 GB RAM?"* Stream it: iterate over the file or `csv.reader` row by row, or read in chunks with pandas `chunksize`, and aggregate as you go. Never load it whole.
- *"How do you make sure downstream jobs don't read a half-written file?"* Write to a temp name and rename atomically, or publish a `_SUCCESS` marker or manifest last, and have readers wait for it.

```quiz
Why use the csv module instead of line.split(",")?
* Quoted values can contain commas, quotes and line breaks
- split() is slower
- csv.reader converts types automatically
> The csv module follows the quoting rules. It does not convert types; every value is a string.
---
Your first column comes back as '﻿order_id'. What fixes it?
- strip() on every row
* Open the file with encoding="utf-8-sig"
- Open with errors="ignore"
> That's a byte-order mark from Excel. utf-8-sig removes it.
---
Why write to a temp file and then os.replace() it?
- It is faster
* Readers never see a half-written file
- It compresses the file
> A rename within one file system is atomic.
```

```practice
py 22
py 33
py 34
```
