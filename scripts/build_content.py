"""Assemble site content JSON from the converted handbook/interview sources.

Usage: python3 scripts/build_content.py <converted-content-dir> <til-dir>
"""
import json, os, re, shutil, sys

src, til_dir = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'src', 'content')

BOOKS = [
    ('sql', 'SQL for Data Engineering', 'From basics to modeling, loading patterns and performance', 'sql'),
    ('pyspark', 'PySpark', 'Architecture, DataFrames, joins, partitioning, internals and tuning', 'spark'),
    ('databricks', 'Databricks', 'Workspace, Unity Catalog, Delta Lake, Lakeflow, CI/CD and cost', 'lake'),
    ('streaming', 'Streaming', 'Time, windows, watermarks, state, exactly-once, Kafka and CDC', 'stream'),
]


def slugify(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')[:60]


def minutes(md):
    words = len(re.findall(r'\w+', md))
    return max(2, round(words / 200))


index = []
for slug, title, sub, icon in BOOKS:
    chapters = json.load(open(os.path.join(src, slug + '.json')))
    chs = []
    for c in chapters:
        md = c['md'].replace('](img/', '](./img/')
        chs.append(dict(num=c['num'], slug=f"{c['num']}-{slugify(c['title'])}", title=c['title'], minutes=minutes(md), md=md))
    json.dump(chs, open(os.path.join(out, 'books', slug + '.json'), 'w'), ensure_ascii=False)
    index.append(dict(slug=slug, title=title, subtitle=sub, icon=icon,
                      chapters=[{k: v for k, v in c.items() if k != 'md'} for c in chs],
                      minutes=sum(c['minutes'] for c in chs)))
json.dump(index, open(os.path.join(out, 'books-index.json'), 'w'), ensure_ascii=False, indent=1)

for f in os.listdir(os.path.join(src, 'img')):
    shutil.copy(os.path.join(src, 'img', f), os.path.join(root, 'public', 'img', f))

# SQL questions + runnable lab specs
qs = json.load(open(os.path.join(src, 'sql-questions.json')))
lab = {s['n']: s for s in json.load(open(os.path.join(src, 'sql-lab.json')))}
sql = []
for q in qs['questions']:
    s = lab[q['n']]
    sql.append(dict(n=q['n'], title=q['title'].rstrip('.'), section=q['section'], given=q['given'], answer=q['answer'], note=q['note'],
                    mode=s['mode'], setup=s.get('setup', ''), ref=s.get('ref', ''), check=s.get('check', ''), hint=s.get('hint', ''),
                    starter=s.get('starter', ''), tables=s.get('tables', [])))
json.dump(dict(tips=qs['tips'], questions=sql), open(os.path.join(out, 'sql-questions.json'), 'w'), ensure_ascii=False)

py = json.load(open(os.path.join(src, 'py-questions.json')))
for q in py['questions']:
    q['title'] = q['title'].rstrip('.')
json.dump(py, open(os.path.join(out, 'py-questions.json'), 'w'), ensure_ascii=False)

sc = json.load(open(os.path.join(src, 'scenarios.json')))
sc['sections'] = [s for s in sc['sections'] if s['questions']]
sc['do'] = ['Real numbers you can defend', '90 seconds to 2 minutes per answer', '"I" for your work, "we" for team wins', 'Name the exact tool or config', 'Always end with prevention']
sc['dont'] = ['Blaming a senior, teammate or client', '"I never had a conflict or a mistake"', '"I optimized it" with no cause and no number', 'Claims you can\'t explain two levels deeper']
json.dump(sc, open(os.path.join(out, 'scenarios.json'), 'w'), ensure_ascii=False)

old = json.load(open(os.path.join(src, 'old-guide.json')))
json.dump(old, open(os.path.join(out, 'guide.json'), 'w'), ensure_ascii=False)

til = []
for d in sorted(os.listdir(til_dir)):
    p = os.path.join(til_dir, d)
    if not os.path.isdir(p):
        continue
    for f in sorted(os.listdir(p)):
        if f.endswith('.md'):
            md = open(os.path.join(p, f)).read()
            title = md.split('\n', 1)[0].lstrip('# ').strip()
            body = md.split('\n', 1)[1].strip()
            til.append(dict(slug=f[:-3], topic=d, title=title, md=body))
json.dump(til, open(os.path.join(out, 'til.json'), 'w'), ensure_ascii=False)
print('books', [(b['slug'], len(b['chapters'])) for b in index], 'sql', len(sql), 'py', len(py['questions']), 'til', len(til))
