// Runs Python in a Web Worker so infinite loops can be stopped.
let pyodide = null

async function init(base) {
  if (pyodide) return pyodide
  const mod = await import(/* @vite-ignore */ base + 'pyodide.mjs')
  pyodide = await mod.loadPyodide({ indexURL: base })
  return pyodide
}

self.onmessage = async (e) => {
  const { id, code, base, check } = e.data
  let out = ''
  try {
    const py = await init(base)
    py.setStdout({ batched: (s) => { out += s + '\n' } })
    py.setStderr({ batched: (s) => { out += s + '\n' } })
    if (check) {
      py.globals.set('__user_code', code)
      py.globals.set('__ref_code', check.ref)
      py.globals.set('__fn', check.fn)
      py.globals.set('__args', check.args)
      const verdict = await py.runPythonAsync(`
import copy, json
def __run(src, fn, args_src):
    ns = {}
    exec(src, ns)
    f = ns.get(fn)
    if f is None:
        raise NameError(f"define a function named {fn}()")
    a, k = eval(f"(lambda *a, **k: (a, k))({args_src})", {})
    a2, k2 = copy.deepcopy(a), copy.deepcopy(k)
    res = f(*a2, **k2)
    if hasattr(res, '__next__') or hasattr(res, 'send'):
        res = list(res)
    return res, a2
__u = __run(__user_code, __fn, __args)
__r = __run(__ref_code, __fn, __args)
json.dumps({"ok": __u == __r, "got": repr(__u[0]), "want": repr(__r[0])})
`)
      self.postMessage({ id, out, verdict: JSON.parse(verdict) })
    } else {
      await py.runPythonAsync(code)
      self.postMessage({ id, out })
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err)
    const lines = msg.split('\n').filter((l) => !l.includes('/lib/python') && !l.includes('pyodide') && !l.includes('_pyodide'))
    self.postMessage({ id, out, error: lines.join('\n').trim() })
  }
}
