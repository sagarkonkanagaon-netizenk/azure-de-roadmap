# Runs every runnable ```sql block in the SQL handbook against the Playground tables,
# each block in a fresh database, and fails if any block errors.
# Usage: node scripts/dump_big_setup.mjs > /tmp/big.json && python scripts/check_sql_blocks.py /tmp/big.json
import json, re, sys
import duckdb

setup = json.load(open(sys.argv[1]))
base = duckdb.connect('/tmp/dd-big.duckdb')
for s in setup:
    base.execute(s)
base.close()

book = json.load(open('src/content/books/sql.json'))
bad = n = 0
for ch in book:
    for m in re.finditer(r'```sql([^\n]*)\n(.*?)```', ch['md'], re.S):
        if 'norun' in m.group(1):
            continue
        n += 1
        con = duckdb.connect()
        con.execute("ATTACH '/tmp/dd-big.duckdb' AS big (READ_ONLY)")
        con.execute("SET search_path = 'memory.main,big.main'")
        try:
            for stmt in duckdb.extract_statements(m.group(2)):
                con.execute(stmt)
        except Exception as e:
            bad += 1
            print(f"FAIL chapter {ch['num']}: {str(e).splitlines()[0]}\n{m.group(2)[:300]}\n")
        con.close()
print(f'{n} SQL blocks checked, {bad} failed')
sys.exit(1 if bad else 0)
