"""Convert Sagar's styled handbook PDFs to structured JSON chapters (markdown bodies)."""
import sys, json, re, collections
import fitz

CODE_COLORS = {0x14213d, 0x24304a}
CALLOUT = 0x7a1f1f
KEYWORD = 0x8a1f4a


def esc(t):
    return t.replace('|', '\\|')


def span_md(spans):
    out = []
    for s in spans:
        t = s['text']
        if not t.strip():
            out.append(t)
            continue
        bold = 'Bold' in s['font']
        lead = t[:len(t) - len(t.lstrip())]
        trail = t[len(t.rstrip()):]
        core = t.strip()
        if bold and s['color'] == KEYWORD:
            core = '`' + core.replace('`', '') + '`'
        elif bold:
            core = '**' + core + '**'
        out.append(lead + core + trail)
    md = ''.join(out)
    md = md.replace('** **', ' ').replace('****', '')
    md = re.sub(r'`(\s+)`', r'\1', md)
    return md


def diagram_regions(page):
    rects = [dr['rect'] for dr in page.get_drawings() if dr['type'] == 'fs' and 20 < dr['rect'].width < 560 and dr['rect'].height > 10]
    clusters = []
    for r in sorted(rects, key=lambda r: r.y0):
        for c in clusters:
            if r.y0 <= c['bbox'].y1 + 75 and r.y1 >= c['bbox'].y0 - 75:
                c['bbox'] |= r
                c['n'] += 1
                break
        else:
            clusters.append(dict(bbox=fitz.Rect(r), n=1))
    return clusters


def convert(path, img_prefix=None, img_dir=None):
    doc = fitz.open(path)
    lines = []
    dcount = 0
    for pn, page in enumerate(doc):
        regions = diagram_regions(page)
        reg_lines = {}
        for b in page.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                if l['dir'] != (1.0, 0.0):
                    continue
                for ri, c in enumerate(regions):
                    if fitz.Rect(l['bbox']).intersects(c['bbox']) and fitz.Rect(l['bbox']).y0 >= c['bbox'].y0 - 2:
                        reg_lines.setdefault(ri, []).append(l)
        active = {}
        for ri, ls in reg_lines.items():
            xs = {round(l['bbox'][0] / 15) for l in ls}
            codeish = sum(1 for l in ls if l['spans'][0]['color'] in CODE_COLORS)
            if (regions[ri]['n'] >= 2 or len(xs) >= 3) and len(ls) >= 3 and codeish < len(ls) / 2:
                dcount += 1
                bb = regions[ri]['bbox']
                for l in ls:
                    bb |= fitz.Rect(l['bbox'])
                bb = (bb + (-8, -8, 8, 8)) & page.rect
                name = f'{img_prefix}-{dcount}.png'
                if img_dir:
                    page.get_pixmap(clip=bb, dpi=170).save(f'{img_dir}/{name}')
                active[ri] = dict(name=name, bbox=bb, emitted=False)
        dots = [dr['rect'] for dr in page.get_drawings() if dr['rect'].width < 8 and dr['rect'].height < 8]
        hrules = sorted({round(dr['rect'].y0) for dr in page.get_drawings() if dr['rect'].height < 2 and dr['rect'].width > 20})
        for b in page.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                if l['dir'] != (1.0, 0.0):
                    continue
                lb = fitz.Rect(l['bbox'])
                hit = next((a for a in active.values() if lb.intersects(a['bbox']) and lb.y0 >= a['bbox'].y0 - 2 and lb.y1 <= a['bbox'].y1 + 2), None)
                if hit:
                    if not hit['emitted']:
                        hit['emitted'] = True
                        lines.append(dict(page=pn, x=lb.x0, y=lb.y0, y1=lb.y1, size=0, bold=False, mono=False, color=-1, text='', md='', bullet=False, rules=[], image=hit['name']))
                    continue
                spans = [s for s in l['spans'] if s['text']]
                if not spans or not ''.join(s['text'] for s in spans).strip():
                    continue
                s0 = next(s for s in spans if s['text'].strip())
                cc = collections.Counter()
                for sp in spans:
                    cc[sp['color']] += len(sp['text'].strip())
                dom = cc.most_common(1)[0][0]
                x0, y0, x1, y1 = l['bbox']
                bullet = any(d.x1 <= x0 + 1 and d.x0 > x0 - 20 and d.y0 >= y0 - 2 and d.y1 <= y1 + 2 for d in dots)
                lines.append(dict(page=pn, x=x0, y=y0, y1=y1, size=round(s0['size'], 1),
                                  bold='Bold' in s0['font'], mono='Mono' in s0['font'], color=dom if dom in CODE_COLORS or dom == CALLOUT else s0['color'],
                                  text=''.join(s['text'] for s in spans), md=span_md(spans), bullet=bullet,
                                  rules=hrules))
    # infer sizes
    c = collections.Counter()
    for l in lines:
        l.setdefault('image', None)
    for l in lines:
        if l['color'] == 0x1d2f6f and not l['bold']:
            c[l['size']] += len(l['text'])
    tot = sum(c.values())
    body = max(sz for sz, v in c.items() if v > 0.1 * tot)
    multi = collections.Counter()
    for a in lines:
        if a['color'] in CODE_COLORS or a['size'] > body + 0.2:
            continue
        if any(b is not a and b['page'] == a['page'] and abs(b['y'] - a['y']) < 2 and abs(b['size'] - a['size']) < 0.15 and abs(b['x'] - a['x']) > 40 for b in lines[max(0, lines.index(a) - 8):lines.index(a) + 8]):
            multi[a['size']] += 1
    table_size = multi.most_common(1)[0][0] if multi else None
    heads = collections.Counter(l['size'] for l in lines if l['bold'] and l['size'] > body + 0.3)
    hsizes = sorted(heads, reverse=True)
    # chapter size: size of the big black bold headings used repeatedly
    cc = collections.Counter(l['size'] for l in lines if l['bold'] and l['color'] == 0x141414 and l['size'] > body + 2 and re.match(r'^\d+\.', l['text'].strip()))
    chap_size = cc.most_common(1)[0][0]
    hsizes = [h for h in hsizes if h <= chap_size]

    chapters = []
    cur = None
    out = []
    i = 0
    n = len(lines)

    def flush():
        if cur is not None:
            cur['md'] = '\n\n'.join(b for b in out if b.strip())
            chapters.append(cur)

    skipping = True  # skip cover + contents until first numbered chapter
    while i < n:
        l = lines[i]
        t = l['text'].strip()
        # chapter heading
        if l['bold'] and abs(l['size'] - chap_size) < 0.2 and l['color'] == 0x141414:
            # headings can wrap onto two lines
            title = t
            j = i + 1
            while j < n and abs(lines[j]['size'] - chap_size) < 0.2 and lines[j]['bold'] and lines[j]['page'] == l['page'] and lines[j]['y'] - lines[-1 if j == 0 else j - 1]['y'] < chap_size * 1.6:
                title += ' ' + lines[j]['text'].strip()
                j += 1
            m = re.match(r'^(\d+)\.\s*(.*)$', title)
            if m:
                flush()
                out = []
                cur = dict(num=int(m.group(1)), title=m.group(2).strip())
                skipping = False
            elif not skipping and cur is not None:
                out.append('## ' + title)
            else:
                skipping = True
            i = j
            continue
        if skipping:
            i += 1
            continue
        if l['image']:
            out.append(f'![diagram](img/{l["image"]})')
            i += 1
            continue
        # headings
        if l['bold'] and l['size'] > body + 0.3 and l['color'] not in CODE_COLORS and not (table_size and abs(l['size'] - table_size) < 0.15 and _is_table_row(lines, i, table_size)):
            level = '###' if l['size'] >= (hsizes[1] if len(hsizes) > 1 else 0) - 0.05 and l['size'] != chap_size else '####'
            # wrap
            title = l['md'].replace('**', '')
            j = i + 1
            while j < n and lines[j]['bold'] and lines[j]['size'] == l['size'] and lines[j]['page'] == l['page'] and 0 < lines[j]['y'] - lines[j-1]['y'] < l['size'] * 1.5 and abs(lines[j]['x'] - l['x']) < 3:
                title += ' ' + lines[j]['md'].replace('**', '')
                j += 1
            out.append(level + ' ' + title.strip())
            i = j
            continue
        # code block
        if l['color'] in CODE_COLORS:
            block = []
            j = i
            while j < n and lines[j]['color'] in CODE_COLORS:
                block.append(lines[j])
                j += 1
            minx = min(b['x'] for b in block)
            cw = block[0]['size'] * 0.6
            txt = []
            for b in block:
                ind = int(round((b['x'] - minx) / cw))
                txt.append(' ' * ind + b['text'].rstrip())
            body_txt = '\n'.join(txt)
            body_txt = body_txt.replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"')
            mono = all(b['mono'] for b in block)
            lang = 'text' if mono else guess_lang(body_txt)
            out.append('```' + lang + '\n' + body_txt + '\n```')
            i = j
            continue
        # callout
        if l['color'] == CALLOUT:
            block = []
            j = i
            while j < n and lines[j]['color'] == CALLOUT:
                block.append(lines[j]['md'].strip())
                j += 1
            out.append('> ' + join_lines(block))
            i = j
            continue
        # table
        if table_size and abs(l['size'] - table_size) < 0.15 and _is_table_row(lines, i, table_size):
            j = i
            rows = []
            while j < n and abs(lines[j]['size'] - table_size) < 0.15 and lines[j]['color'] not in CODE_COLORS | {CALLOUT}:
                rows.append(lines[j])
                j += 1
            out.append(build_table(rows))
            i = j
            continue
        # bullet / paragraph
        if l['bullet']:
            item = [l['md'].strip()]
            j = i + 1
            while j < n and not lines[j]['bullet'] and _same_style(lines[j], l) and abs(lines[j]['x'] - l['x']) < 4 and lines[j]['page'] == l['page'] and 0 < lines[j]['y'] - lines[j-1]['y'] < l['size'] * 2:
                item.append(lines[j]['md'].strip())
                j += 1
            entry = '- ' + join_lines(item)
            if out and out[-1].startswith('- ') and not out[-1].startswith('- -'):
                out[-1] += '\n' + entry
            else:
                out.append(entry)
            i = j
            continue
        para = [l['md'].strip()]
        j = i + 1
        numbered = re.match(r'^(\*\*)?\d+\.(\*\*)?\s', l['md'].strip()) is not None
        while j < n and not lines[j]['image'] and not lines[j]['bullet'] and _same_style(lines[j], l) and (abs(lines[j]['x'] - l['x']) < 4 or (numbered and 0 < lines[j]['x'] - l['x'] < 30)) and not re.match(r'^(\*\*)?\d+\.(\*\*)?\s', lines[j]['md'].strip()) and (lines[j]['page'] != l['page'] or 0 < lines[j]['y'] - lines[j-1]['y'] < l['size'] * 1.9):
            if lines[j]['bold'] and lines[j]['size'] > body + 0.3:
                break
            para.append(lines[j]['md'].strip())
            j += 1
        out.append(join_lines(para))
        i = j
    flush()
    return chapters


def _same_style(a, b):
    return abs(a['size'] - b['size']) < 0.15 and a['color'] not in CODE_COLORS and a['color'] != CALLOUT and not (a['bold'] and a['md'].startswith('**') and a['md'].endswith('**') and not b['bold'])


def _is_table_row(lines, i, ts):
    # table if there are >=2 lines of table size sharing this y (multiple columns)
    l = lines[i]
    same = [m for m in lines[max(0, i-6):i+8] if m['page'] == l['page'] and abs(m['y'] - l['y']) < 2 and abs(m['size'] - ts) < 0.15]
    return len(same) >= 2


def build_table(rows):
    # columns from header row (first y)
    y0 = rows[0]['y']
    header = sorted([r for r in rows if abs(r['y'] - y0) < 2 and r['page'] == rows[0]['page']], key=lambda r: r['x'])
    cols = [h['x'] for h in header]
    if len(cols) < 2:
        cols = sorted({round(r['x']) for r in rows})
    minx = min(r['x'] for r in rows)
    if minx < cols[0] - 10:
        cols = [minx] + cols

    def col_of(x):
        k = 0
        for ci, cx in enumerate(cols):
            if x >= cx - 4:
                k = ci
        return k
    # group into rows using horizontal rules when available else y gaps
    groups = []
    for r in rows:
        rules = r['rules']
        band = (r['page'], sum(1 for ry in rules if ry < r['y'] + (r['y1'] - r['y']) / 2)) if len(rules) >= 2 else None
        if groups and band is not None and groups[-1]['band'] == band:
            groups[-1]['lines'].append(r)
            continue
        if groups and band is None and r['page'] == groups[-1]['lines'][-1]['page'] and r['y'] - groups[-1]['lines'][-1]['y'] < r['size'] * 1.5 and col_of(r['x']) != 0:
            groups[-1]['lines'].append(r)
            continue
        if groups and band is None and r['page'] == groups[-1]['lines'][-1]['page'] and abs(r['y'] - groups[-1]['lines'][0]['y']) < 2:
            groups[-1]['lines'].append(r)
            continue
        groups.append(dict(band=band, lines=[r]))
    table = []
    for g in groups:
        cells = [''] * len(cols)
        for r in sorted(g['lines'], key=lambda r: (r['y'], r['x'])):
            k = col_of(r['x'])
            cells[k] = re.sub(r'`(\s+)`', r'\1', (cells[k] + ' ' + r['md'].strip()).strip())
        table.append(cells)
    hdr = [c.replace('**', '') for c in table[0]]
    md = '| ' + ' | '.join(esc(c) for c in hdr) + ' |\n|' + '---|' * len(hdr)
    for row in table[1:]:
        md += '\n| ' + ' | '.join(esc(c) for c in row) + ' |'
    return md


def join_lines(parts):
    s = ''
    for p in parts:
        if s.endswith('-') and not s.endswith(' -') and p[:1].islower():
            s = s + p
        else:
            s = (s + ' ' + p).strip()
    s = s.replace('** **', ' ').replace('`` ', '')
    return s


def guess_lang(t):
    if re.search(r'\b(import |from pyspark|spark\.|df\.|def |\.withColumn|print\()', t):
        return 'python'
    if re.search(r'\b(SELECT|CREATE|INSERT|MERGE|UPDATE|DELETE|WITH|ALTER|DROP|OPTIMIZE|VACUUM|DESCRIBE)\b', t):
        return 'sql'
    if re.search(r'^\s*(\$|databricks |pip |spark-submit|curl )', t, re.M):
        return 'bash'
    return 'text'


if __name__ == '__main__':
    ch = convert(sys.argv[1], sys.argv[3], sys.argv[4])
    json.dump(ch, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
    print(sys.argv[2], len(ch), 'chapters', sum(len(c['md']) for c in ch), 'chars')
