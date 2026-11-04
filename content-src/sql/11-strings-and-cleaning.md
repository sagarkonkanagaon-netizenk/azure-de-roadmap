# String functions and cleaning

By the end of this chapter you can clean messy text into joinable keys, parse values out of strings with patterns, and standardise categories, which is most of what a silver layer does to text columns.

## Why text needs cleaning

Sources are typed by people and stitched together by systems. The same city arrives as `Bengaluru`, ` bengaluru `, `BENGALURU` and `Bangalore`. Joins on uncleaned text silently miss rows, and group-bys split one city into four. Cleaning text into a standard form is one of the first jobs of the silver layer.

## The everyday functions

```sql
SELECT full_name,
       upper(full_name)                    AS up,
       lower(email)                        AS email_lower,
       length(full_name)                   AS len,
       split_part(email, '@', 1)           AS local_part,
       split_part(email, '@', 2)           AS domain,
       left(full_name, 3)                  AS first3,
       full_name || ' (' || city || ')'    AS label,
       concat_ws(', ', full_name, city, country) AS label_skip_nulls
FROM shop_customers
LIMIT 5;
```

Note the last two. `||` returns NULL if any part is NULL, so a customer with no city gets a NULL label. `concat_ws` skips NULLs. In Spark, `concat` behaves like `||` and `concat_ws` skips NULLs too.

## Clean a messy column

```sql
WITH raw(city_raw) AS (
    VALUES ('  Bengaluru'), ('bengaluru '), ('BENGALURU'), ('Bangalore'),
           ('Mumbai'), ('mumbai'), ('Bombay'), (''), (NULL), ('N/A')
)
SELECT city_raw,
       CASE
           WHEN NULLIF(trim(city_raw), '') IS NULL       THEN NULL
           WHEN upper(trim(city_raw)) IN ('N/A', 'NA', '-') THEN NULL
           WHEN lower(trim(city_raw)) = 'bangalore'      THEN 'Bengaluru'
           WHEN lower(trim(city_raw)) = 'bombay'         THEN 'Mumbai'
           ELSE upper(left(trim(city_raw), 1)) || lower(substr(trim(city_raw), 2))
       END AS city_clean
FROM raw;
```

DuckDB has no `initcap`, so the last line capitalises by hand; Spark, Postgres and Snowflake have `initcap`. The order matters: trim first, turn empty strings and placeholders like `N/A` into real NULLs, map known aliases, then standardise the case. In a real pipeline the alias list lives in a small mapping table you join to, so analysts can add `Gurgaon → Gurugram` without a code change.

## Pattern matching

```sql
SELECT email,
       email LIKE '%@example.com'                         AS like_match,
       regexp_matches(email, '^[a-z]+\.[0-9]+@')           AS regex_match,
       regexp_extract(email, '\.([0-9]+)@', 1)             AS number_in_email,
       regexp_replace(full_name, '[aeiou]', '*', 'g')      AS masked
FROM shop_customers
LIMIT 5;
```

| Tool | Use for |
|---|---|
| `LIKE` / `ILIKE` | simple prefix, suffix or contains checks, fast |
| `regexp_matches` (`RLIKE` in Spark) | validating a format |
| `regexp_extract` | pulling a part out of a string |
| `regexp_replace` | removing or masking characters |

Regex is powerful but slow on billions of rows and hard to review. Use LIKE when it's enough and comment every regex.

## Validate before you trust

```sql
WITH phones(raw) AS (
    VALUES ('+91 98765 43210'), ('098765-43210'), ('9876543210'), ('12345'), ('call me')
)
SELECT raw,
       regexp_replace(raw, '[^0-9]', '', 'g')                    AS digits,
       right(regexp_replace(raw, '[^0-9]', '', 'g'), 10)        AS last10,
       length(regexp_replace(raw, '[^0-9]', '', 'g')) >= 10     AS looks_valid
FROM phones;
```

Strip to digits, keep a standard length, and flag what doesn't fit instead of guessing. Bad rows go to a quarantine table with a reason, not into silver (chapter 18).

## Keys and hashing

Text keys are often normalised before joining or hashing:

```sql
SELECT email,
       md5(lower(trim(email)))  AS email_key,
       hash(lower(trim(email))) AS email_hash64
FROM shop_customers
WHERE email IS NOT NULL
LIMIT 5;
```

Hashing a normalised value gives a stable key for joins and deduplication across systems. A hash also hides the raw email in shared tables, though a plain MD5 of an email can be reversed by guessing, so treat it as pseudonymous, not anonymous. Spark has `md5`, `sha2(col, 256)` and `xxhash64`.

## Common mistakes

- **Joining on raw text** with stray spaces or mixed case.
- **Empty string versus NULL.** They are different values; `COUNT(col)` counts empty strings. Convert one to the other early and consistently.
- **`||` with a nullable column.** The whole result becomes NULL.
- **Collation surprises.** Some warehouses compare case-insensitively by default and others don't. Don't depend on it; normalise.
- **Unicode.** `Müller` and `Muller` don't match, and some lengths count bytes rather than characters. Test with real names.

## In the interview

**"Find duplicate emails."** Group by `lower(trim(email))` having count > 1, and say that you normalised first, because `A@x.com` and `a@x.com ` are the same person. That one sentence shows you've cleaned real data.

**"How would you standardise city names from five sources?"** Trim, normalise case, map aliases through a maintained mapping table, send unknowns to a review queue, and track the unmapped rate as a quality metric.

```quiz
`SELECT 'Asha' || NULL` returns what?
- 'Asha'
* NULL
- An error
> `||` propagates NULL. Use concat_ws or COALESCE when parts can be missing.
---
Which step should come first when cleaning a city column?
* Trim spaces and turn empty strings and placeholders into NULL
- Map aliases like Bombay to Mumbai
- Group by city
> Alias matching only works on trimmed, normalised text.
---
Is an MD5 hash of an email address anonymous?
- Yes, MD5 can't be reversed
* No, someone can hash likely emails and compare, so it's only pseudonymous
- Only if it's uppercase
> Use a secret salt or a keyed hash if the data must not be re-identified.
```

```practice
sql 5
sql 22
sql 66
```
