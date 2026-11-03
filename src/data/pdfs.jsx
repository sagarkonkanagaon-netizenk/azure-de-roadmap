// Sagar's original notes as downloadable PDFs (served from public/notes).
const base = import.meta.env.BASE_URL + 'notes/'
export const PDFS = [
  { file: 'sql-handbook.pdf', title: 'SQL Handbook for Data Engineering', pages: 30, mb: 2.9, book: 'sql', kind: 'Handbook' },
  { file: 'pyspark-handbook.pdf', title: 'PySpark Handbook', pages: 77, mb: 3.5, book: 'pyspark', kind: 'Handbook' },
  { file: 'databricks-handbook.pdf', title: 'Databricks Handbook', pages: 31, mb: 1.3, book: 'databricks', kind: 'Handbook' },
  { file: 'streaming-handbook.pdf', title: 'Streaming Handbook', pages: 53, mb: 2.2, book: 'streaming', kind: 'Handbook' },
  { file: 'sql-interview-questions.pdf', title: 'SQL Interview Questions', pages: 24, mb: 9.2, kind: 'Interview' },
  { file: 'python-pyspark-coding-questions.pdf', title: 'Python & PySpark Coding Questions', pages: 24, mb: 9.0, kind: 'Interview' },
  { file: 'de-scenario-interview-notes.pdf', title: 'DE Scenario Interview Notes', pages: 10, mb: 3.6, kind: 'Interview' },
].map((p) => ({ ...p, url: base + p.file }))
export const pdfFor = (book) => PDFS.find((p) => p.book === book)

export function PdfGrid() {
  return (
    <div className="pdf-grid">
      {PDFS.map((p) => (
        <a key={p.file} className="pdf card" href={p.url} download target="_blank" rel="noreferrer">
          <span className="pdf-ico" aria-hidden="true">PDF</span>
          <span className="pdf-body"><span className="tile-k">{p.kind}</span><b>{p.title}</b><span className="small muted">{p.pages} pages · {p.mb} MB</span></span>
          <span className="pdf-dl" aria-hidden="true">↓</span>
        </a>
      ))}
    </div>
  )
}
