import json, re
from bs4 import BeautifulSoup

def fix(t):
    return (t.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"'))

def code_fix(t):
    t = fix(t)
    t = re.sub(r'^(\s*)\u2013 ', r'\1-- ', t, flags=re.M)
    return t.strip('\n')

soup = BeautifulSoup(open('old.html').read(), 'html.parser')
phases = []
for i in range(1, 8):
    p = soup.select_one(f'#panel-p{i}')
    title = p.select_one('.panel-header h2').get_text(strip=True)
    md = []
    for el in p.find_all(recursive=False):
        cls = el.get('class') or []
        if 'panel-header' in cls:
            continue
        if 'code-box' in cls:
            txt = code_fix(el.get_text())
            lang = 'python' if re.search(r'^\s*(#|from |import |df|spark)', txt, re.M) and 'SELECT' not in txt.split('\n')[0] else 'sql'
            if re.search(r'"name"|\{|pipeline', txt) and 'SELECT' not in txt and 'spark' not in txt: lang = 'json' if txt.strip().startswith('{') else lang
            md.append(f'```{lang}\n{txt}\n```')
            continue
        for box in ([el] if ('ibox' in cls or 'iq' in cls or 'say' in cls) else el.find_all(['div'], recursive=False)):
            bc = box.get('class') or []
            h = box.find('h4')
            if 'ibox' in bc:
                md.append('### ' + fix(h.get_text(strip=True)))
                md.append('\n'.join('- ' + fix(li.get_text(' ', strip=True)) for li in box.find_all('li')))
            elif 'iq' in bc:
                md.append('### Must-know interview questions')
                for qi in box.select('.qi'):
                    t = fix(qi.get_text(' ', strip=True))
                    t = re.sub(r'^Q:\s*', '', t)
                    if '→' in t:
                        q, a = t.split('→', 1)
                        md.append(f'**Q: {q.strip()}**  \n{a.strip()}')
                    else:
                        md.append('**Q:** ' + t)
            elif 'say' in bc:
                txt = fix(box.get_text(' ', strip=True))
                txt = re.sub(r'^💬\s*What to Say in Interviews\s*', '', txt)
                md.append('### What to say in interviews\n\n> ' + txt)
            elif box.find('ul'):
                if h: md.append('### ' + fix(h.get_text(strip=True)))
                md.append('\n'.join('- ' + fix(li.get_text(' ', strip=True)) for li in box.find_all('li')))
            elif box.get_text(strip=True):
                if h:
                    md.append('### ' + fix(h.get_text(strip=True)))
                    h.extract()
                md.append(fix(box.get_text(' ', strip=True)))
    phases.append(dict(n=i, title=title, md='\n\n'.join(md)))

projects = []
for c in soup.select('.proj-card'):
    projects.append(dict(title=fix(c.find('h3').get_text(strip=True)), tags=[s.get_text(strip=True) for s in c.select('.proj-meta span')],
                         why=fix(c.find('p').get_text(strip=True)), steps=[fix(li.get_text(' ', strip=True)) for li in c.select('.proj-steps li')]))
res = []
for c in soup.select('.res-card'):
    a = c.find('a')
    res.append(dict(kind=[k for k in c.get('class') if k != 'res-card'][0], title=fix(c.find('h3').get_text(strip=True)),
                    by=fix(c.select_one('.by').get_text(' ', strip=True)) if c.select_one('.by') else '', desc=fix(c.find('p').get_text(strip=True)), href=a.get('href') if a else ''))
qa = []
for c in soup.select('.qa'):
    head = c.find('summary')
    for item in c.select('.qa-content li'):
        t = fix(item.get_text(' ', strip=True))
        st = item.find('strong')
        if st:
            k = fix(st.get_text(' ', strip=True)).rstrip(':')
            v = t[len(fix(st.get_text(' ', strip=True))):].strip()
            qa.append(dict(topic=fix(head.get_text(' ', strip=True)) if head else '', q=k.strip(), a=v.strip()))
json.dump(dict(phases=phases, projects=projects, resources=res, qa=qa), open('content/old-guide.json', 'w'), indent=1, ensure_ascii=False)
print(len(phases), len(projects), len(res), len(qa))
print(phases[2]['md'][:2500]); print(qa[:3]); print(res[0])
