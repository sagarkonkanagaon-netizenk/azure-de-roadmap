<p align="center"><img src=".github/banner.png" alt="Data Dhaba: on your highway to get hired" width="100%" /></p>

# Data Dhaba

**On your highway to get hired.** A free, hands-on path into data engineering. Learn by doing, in the browser:

- **12-week path** from SQL to production pipelines on Azure and Databricks
- **Four handbooks** (SQL, PySpark, Databricks, Streaming): 98 chapters
- **SQL lab**: 78 interview questions on a real DuckDB engine in your browser, auto-checked
- **Python lab**: Pyodide in a Web Worker, auto-checked
- **Incident drills**: fix a broken pipeline from a 3 AM page
- **Interview prep**: scenario questions with push-backs, PySpark questions, a playbook, flashcards and a 102-question quiz (Azure, AWS, GCP) where every wrong option is a real mistake
- Progress is saved in your browser. No account needed.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checks the quiz, then builds to dist/
```

## Deploy

- **GitHub Pages**: `.github/workflows/pages.yml` builds and deploys on every push to `main`. In repo **Settings → Pages**, set **Source** to **GitHub Actions** once.
- **Vercel**: import the repo. Framework preset Vite, build `npm run build`, output `dist`.

The SQL and Python engines load from jsDelivr on first use. Set `VITE_WASM_BASE` or `VITE_PYODIDE_BASE` to serve them yourself.

## Content

`src/content/*.json` is generated from the handbook PDFs by `scripts/build_content.py` and the converters in `scripts/convert/`. The quiz lives in `src/data/quiz.js`; `npm run check:quiz` fails if the right answer is too often the longest option.
