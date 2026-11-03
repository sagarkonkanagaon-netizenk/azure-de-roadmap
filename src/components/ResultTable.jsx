export default function ResultTable({ result, max = 200 }) {
  if (!result) return null
  if (!result.cols.length) return <div className="out">Statement ran. No rows returned.</div>
  const rows = result.rows.slice(0, max)
  return (
    <div className="result-body">
      <table className="rtable">
        <thead><tr>{result.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => v === null ? <td key={j} className="null">NULL</td> : <td key={j}>{typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v * 10000) / 10000) : String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > max && <div className="out muted">Showing {max} of {result.rows.length} rows.</div>}
    </div>
  )
}
