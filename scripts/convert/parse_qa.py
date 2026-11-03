"""Parse question/answer interview PDFs (already extracted to styled lines) into JSON."""
import json, re, sys

CODE = 0x14213d
NOTE = 0x1e6b3f
GRAY = 0x555555
QNUM = re.compile(r'^(Q?)(\d+)\.\s*(.*)$')


def join(parts):
    s = ''
    for p in parts:
        p = p.strip()
        if s.endswith('-') and p[:1].islower():
            s += p
        else:
            s = (s + ' ' + p).strip()
    return s


def code_text(lines):
    minx = min(l['x'] for l in lines)
    out = []
    for l in lines:
        step = l['size'] * 0.405
        out.append(' ' * int(round((l['x'] - minx) / step)) + l['text'].rstrip())
    return '\n'.join(out)


def parse_coding(path):
    L = json.load(open(path))
    ans_i = next(i for i, l in enumerate(L) if l['text'].strip() == 'Answers' and l['size'] > 20)
    tips = [l['text'].strip() for l in L[:ans_i] if l['color'] == 0x1d2f6f and re.match(r'^\d\.', l['text'].strip())]
    qs = {}
    order = []
    section = None
    cur = None
    for l in L[:ans_i]:
        t = l['text'].strip()
        if l['size'] >= 17 and l['bold']:
            section = t
            continue
        m = QNUM.match(t)
        if l['bold'] and l['color'] == 0x141414 and m:
            cur = dict(n=int(m.group(2)), title=m.group(3).strip(), section=section, given=[])
            qs[cur['n']] = cur
            order.append(cur['n'])
            continue
        if cur and l['color'] == GRAY:
            cur['given'].append(t)
    # answers
    cur = None
    buf_code, buf_note = [], []

    def flush():
        if cur is None:
            return
        q = qs.get(cur)
        if q is None:
            return
        q['answer'] = code_text(buf_code) if buf_code else ''
        q['note'] = join([x.lstrip('▶').strip() for x in buf_note])
    for l in L[ans_i + 1:]:
        t = l['text'].strip()
        if l['size'] >= 17 and l['bold']:
            continue
        m = QNUM.match(t)
        if l['bold'] and l['color'] == 0x141414 and m and int(m.group(2)) in qs:
            flush()
            cur = int(m.group(2))
            buf_code, buf_note = [], []
            continue
        if cur is None:
            continue
        if l['color'] == CODE and not l['bold']:
            buf_code.append(l)
        elif l['color'] == NOTE or t.startswith('▶'):
            buf_note.append(t)
    flush()
    out = [qs[n] for n in order]
    for q in out:
        q['given'] = ' · '.join(q['given'])
    return dict(tips=tips, questions=out)


def parse_scenario(path):
    L = json.load(open(path))
    steps, sections = [], []
    cur = None
    mode = None
    for l in L:
        t = l['text'].strip()
        if l['size'] > 20:
            continue
        if l['size'] >= 17 and l['bold']:
            sections.append(dict(title=t, questions=[]))
            continue
        m = QNUM.match(t)
        if not sections:
            if re.match(r'^\d\.', t):
                steps.append(t)
            continue
        if l['bold'] and l['color'] == 0x141414 and m and m.group(1) == 'Q':
            cur = dict(n=int(m.group(2)), title=m.group(3), answer=[], summary='', pushbacks=[])
            sections[-1]['questions'].append(cur)
            mode = 'answer'
            continue
        if cur is None:
            continue
        if t.startswith('▶'):
            cur['summary'] = t.lstrip('▶').strip()
            mode = None
            continue
        if t.lower().startswith('if they push back'):
            mode = 'push'
            continue
        if t.startswith('↳'):
            cur['pushbacks'].append(dict(q=t.lstrip('↳').strip().strip('"“”'), a=[]))
            mode = 'pa'
            continue
        if mode == 'pa' and cur['pushbacks']:
            cur['pushbacks'][-1]['a'].append(t)
        elif mode == 'answer':
            cur['answer'].append(t)
    for s in sections:
        for q in s['questions']:
            q['answer'] = join(q['answer'])
            for p in q['pushbacks']:
                p['a'] = join(p['a'])
    return dict(steps=steps, sections=sections)


if __name__ == '__main__':
    kind, src, dst = sys.argv[1:4]
    data = parse_coding(src) if kind == 'coding' else parse_scenario(src)
    json.dump(data, open(dst, 'w'), indent=1, ensure_ascii=False)
    if kind == 'coding':
        qs = data['questions']
        print(dst, len(qs), 'questions', sum(1 for q in qs if q.get('answer')), 'with code', sum(1 for q in qs if q.get('note')), 'with notes')
    else:
        print(dst, sum(len(s['questions']) for s in data['sections']), 'questions')
