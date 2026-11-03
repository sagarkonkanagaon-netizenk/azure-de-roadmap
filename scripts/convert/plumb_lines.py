"""Extract styled lines from Type3-font PDFs with pdfplumber, dropping the rotated watermark."""
import sys, json, collections
import pdfplumber


def to_int(c):
    if not c:
        return 0
    if len(c) == 1:
        v = int(round(c[0] * 255))
        return (v << 16) | (v << 8) | v
    if len(c) == 3:
        r, g, b = (int(round(x * 255)) for x in c)
        return (r << 16) | (g << 8) | b
    return 0


def lines_of(path):
    out = []
    with pdfplumber.open(path) as pdf:
        for pn, p in enumerate(pdf.pages):
            q = p.filter(lambda o: o.get('object_type') != 'char' or (o.get('upright', True) and o.get('size', 0) < 40))
            dots = [r for r in p.rects + p.curves if (r['x1'] - r['x0']) < 8 and (r['bottom'] - r['top']) < 8]
            raw = []
            for ln in q.extract_text_lines(layout=False, x_tolerance=1.5, return_chars=True):
                chars = [c for c in ln['chars'] if c['text'].strip()]
                if chars:
                    raw.append(dict(top=ln['top'], bottom=ln['bottom'], chars=chars))
            raw.sort(key=lambda r: r['top'])
            def glyph(r):
                return all(not c['text'].isalnum() and c['text'] not in '"\'()[]{}#-*_=<>.,:;/' for c in r['chars']) and len(r['chars']) <= 3
            mains = [r for r in raw if not glyph(r)]
            merged = []
            for r in mains:
                if merged and abs(r['top'] - merged[-1]['top']) < 4.5:
                    merged[-1]['chars'] += r['chars']
                    merged[-1]['bottom'] = max(merged[-1]['bottom'], r['bottom'])
                else:
                    merged.append(r)
            for g in (r for r in raw if glyph(r)):
                gc = (g['top'] + g['bottom']) / 2
                best = min(merged, key=lambda m: abs((m['top'] + m['bottom']) / 2 - gc), default=None)
                if best is not None and abs((best['top'] + best['bottom']) / 2 - gc) < 10:
                    best['chars'] += g['chars']
                else:
                    merged.append(g)
            merged.sort(key=lambda r: r['top'])
            for ln in merged:
                chars = sorted(ln['chars'], key=lambda c: c['x0'])
                x0 = chars[0]['x0']
                cc = collections.Counter(to_int(c.get('non_stroking_color')) for c in chars)
                color = cc.most_common(1)[0][0]
                size = round(collections.Counter(round(c['size'], 1) for c in chars).most_common(1)[0][0], 1)
                bold = sum('Bold' in c['fontname'] for c in chars) > len(chars) / 2
                text = ''
                md = ''
                cur_b = None
                buf = ''
                prev = None
                for c in chars:
                    t = c['text']
                    gap = prev is not None and c['x0'] - prev['x1'] > c['size'] * 0.2
                    b = 'Bold' in c['fontname']
                    if cur_b is not None and b != cur_b:
                        md += (f'**{buf.strip()}**' if cur_b and buf.strip() else buf)
                        if gap:
                            md += ' '
                        buf = ''
                    elif gap:
                        buf += ' '
                    if gap:
                        text += ' '
                    text += t
                    buf += t
                    cur_b = b
                    prev = c
                md += (f'**{buf.strip()}**' if cur_b and buf.strip() else buf)
                bullet = any(d['x1'] <= x0 + 1 and d['x0'] > x0 - 20 and d['top'] >= ln['top'] - 3 and d['bottom'] <= ln['bottom'] + 3 for d in dots)
                lig = lambda z: z.replace('\ufb01\ufb01', 'fi').replace('\ufb02\ufb02', 'fl').replace('\ufb01', 'fi').replace('\ufb02', 'fl')
                text, md = lig(text), lig(md)
                out.append(dict(page=pn, x=round(x0, 1), y=round(ln['top'], 1), size=size, bold=bold,
                                color=color, text=text, md=md.strip(), bullet=bullet))
    return out


if __name__ == '__main__':
    ls = lines_of(sys.argv[1])
    json.dump(ls, open(sys.argv[2], 'w'), ensure_ascii=False)
    print(sys.argv[2], len(ls))
