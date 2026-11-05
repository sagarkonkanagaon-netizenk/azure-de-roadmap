# APIs, pagination and retries

By the end of this chapter you can pull every page from a REST API without losing or duplicating rows, survive rate limits and flaky networks, and load only what changed since the last run.

Real APIs need the network, so the runnable examples here use a small fake API that behaves like real ones: pages, rate limits and random failures. The real `requests` code is shown alongside, and the logic is identical.

## What a real call looks like

```python norun
import requests

resp = requests.get(
    "https://api.example.com/v1/orders",
    params={"updated_since": "2025-12-01T00:00:00Z", "limit": 100},
    headers={"Authorization": f"Bearer {token}"},
    timeout=(5, 30),            # connect, read. Never leave this out.
)
resp.raise_for_status()         # turn 4xx/5xx into an exception
data = resp.json()
```

Two habits worth having from day one: always pass a `timeout` (the default waits forever), and always call `raise_for_status()` so a 500 doesn't get parsed as data.

## A fake API to practise against

```python
import random, time, json

random.seed(7)
ORDERS = [{"id": i, "amount": round(random.uniform(5, 500), 2),
           "updated_at": f"2025-12-{1 + i % 5:02d}T10:00:00Z"} for i in range(1, 248)]

class Response:
    def __init__(self, status, body=None, headers=None):
        self.status_code, self._body, self.headers = status, body, headers or {}
    def json(self):
        return self._body
    def raise_for_status(self):
        if self.status_code >= 400:
            raise HTTPError(self.status_code)

class HTTPError(Exception):
    def __init__(self, status):
        super().__init__(f"HTTP {status}")
        self.status = status

calls = {"n": 0}

def fake_get(path, params):
    """Behaves like a typical REST API: cursor pages, 429s and the odd 503."""
    calls["n"] += 1
    if calls["n"] % 7 == 0:
        return Response(429, headers={"Retry-After": "0.05"})
    if random.random() < 0.08:
        return Response(503)
    since = params.get("updated_since", "")
    rows = [o for o in ORDERS if o["updated_at"] > since]
    start = int(params.get("cursor") or 0)
    page = rows[start:start + params.get("limit", 50)]
    nxt = start + len(page)
    return Response(200, {"data": page, "next_cursor": str(nxt) if nxt < len(rows) else None})

print(fake_get("/orders", {"limit": 3}).json())
```

## Pagination styles

APIs split results into pages in one of three ways:

| Style | You send | Watch out for |
|---|---|---|
| Page number | `page=3&per_page=100` | Rows shift between pages if data changes mid-pull |
| Offset | `offset=200&limit=100` | Same shifting problem, slow on big offsets |
| Cursor | `cursor=<token from last page>` | The safest. Stop when there's no next cursor |

Always loop until the API says there is no next page. Never assume a fixed number of pages.

## Retries with backoff and Retry-After

Retry only what is temporary: timeouts, connection errors, 429 (too many requests) and 5xx. A 400 or 401 will fail the same way every time.

```python
RETRYABLE = {429, 500, 502, 503, 504}

def get_with_retry(path, params, attempts=5, base=0.02):
    for attempt in range(1, attempts + 1):
        resp = fake_get(path, params)
        if resp.status_code < 400:
            return resp
        if resp.status_code not in RETRYABLE or attempt == attempts:
            resp.raise_for_status()
        # Respect the server's hint if it gives one, else exponential backoff with jitter.
        wait = float(resp.headers.get("Retry-After", base * 2 ** (attempt - 1)))
        wait += random.uniform(0, base)
        print(f"  {resp.status_code} on cursor={params.get('cursor')}, retry {attempt} in {wait:.2f}s")
        time.sleep(wait)
```

## Pulling every page

```python
def fetch_all(since=""):
    rows, cursor = [], None
    while True:
        params = {"limit": 50, "updated_since": since}
        if cursor:
            params["cursor"] = cursor
        body = get_with_retry("/orders", params).json()
        rows.extend(body["data"])
        cursor = body["next_cursor"]
        if not cursor:
            return rows

rows = fetch_all()
ids = [r["id"] for r in rows]
print(len(rows), "rows,", len(set(ids)), "unique, API calls:", calls["n"])
```

The unique count equals the row count, so no page was read twice even though some calls failed and were retried.

## Incremental loads with a watermark

Pulling everything every night doesn't scale. Save the highest `updated_at` you have loaded (the *watermark*) and ask only for newer rows next time.

```python
STATE_FILE = "orders_state.json"

def read_watermark():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)["updated_since"]
    except FileNotFoundError:
        return ""                         # first run: full load

def write_watermark(value):
    with open(STATE_FILE, "w") as f:
        json.dump({"updated_since": value}, f)

def run():
    since = read_watermark()
    new = fetch_all(since)
    if new:
        # Save the watermark only AFTER the rows are safely written somewhere.
        write_watermark(max(r["updated_at"] for r in new))
    print(f"since={since or '(full)'} -> {len(new)} rows")

run()        # first run loads everything
ORDERS.append({"id": 999, "amount": 42.0, "updated_at": "2025-12-09T08:00:00Z"})
run()        # second run loads only the new row
```

Two subtle points interviewers love:

- **Write the watermark last.** If the load fails after you saved it, those rows are skipped forever.
- **Use `>=` with dedupe, or overlap a little.** Rows with exactly the watermark timestamp can be missed with a strict `>`. Many teams re-read a small window (say the last hour) and dedupe on the primary key.

## Being a good API citizen

```python norun
session = requests.Session()                       # reuses TCP connections
session.headers["Authorization"] = f"Bearer {token}"
for page in pages:
    r = session.get(url, params=page, timeout=(5, 30))
```

A `Session` keeps connections open, which is much faster across hundreds of pages. Combine it with the retry loop above, or mount `urllib3`'s `Retry` on an `HTTPAdapter`.

## Common mistakes

- No `timeout`, so one stuck call hangs the job all night.
- Retrying 400 and 401 responses.
- Ignoring `Retry-After` and getting the API key banned.
- Stopping after a fixed number of pages.
- Saving the watermark before the data is written.
- Putting the token in the URL or in logs.

## In the interview

- *"How do you ingest from a paginated API reliably?"* Cursor pagination looped until there's no next cursor, retries with exponential backoff and jitter for 429/5xx only, respect `Retry-After`, timeouts on every call, and land raw JSON before transforming.
- *"How do you make it incremental?"* A watermark on `updated_at` stored after a successful load, a small overlap window, and dedupe on the primary key so re-runs are safe.

```quiz
Which response should you retry?
- 401 Unauthorized
- 400 Bad Request
* 429 Too Many Requests
> 429 and 5xx are temporary. 4xx errors like 400 and 401 fail the same way every time.
---
When should the pipeline save its new watermark?
- Before fetching
- After fetching, before writing
* After the rows are safely written
> Save it early and a failed load silently skips those rows forever.
---
Why pass timeout= to requests.get?
* Without it a stuck connection can wait forever
- It makes the request faster
- It's required for JSON
> The default is no timeout at all.
```

```practice
py 21
py 37
```
