"""Derive auto-checks for the Python questions: function name + first example args, validated against the reference answer."""
import json, re, sys, copy, signal

path = sys.argv[1]
d = json.load(open(path))
ok = 0
for q in d['questions']:
    q.pop('check', None)
    if q['section'] != 'Python':
        continue
    m = re.search(r'^def (\w+)\(', q['answer'], re.M)
    if not m or '→' not in q['given']:
        continue
    fn = m.group(1)
    args = q['given'].split('→')[0].strip().rstrip(',').strip()
    args = re.sub(r'^(e\.g\.|eg|Input)\s*', '', args)
    args = re.sub(r'^N=', '', args)
    try:
        ns = {}
        signal.alarm(3)
        exec(q['answer'], ns)
        a, k = eval(f"(lambda *a, **k: (a, k))({args})", {})
        res = ns[fn](*copy.deepcopy(a), **copy.deepcopy(k))
        if hasattr(res, '__next__'):
            res = list(res)
        signal.alarm(0)
        q['check'] = {'fn': fn, 'args': args}
        ok += 1
        print('OK ', q['n'], fn, args[:50], '->', repr(res)[:60])
    except Exception as e:
        signal.alarm(0)
        print('NO ', q['n'], fn, args[:60], '|', type(e).__name__, str(e)[:60])
json.dump(d, open(path, 'w'), ensure_ascii=False)
print('checkable', ok)
