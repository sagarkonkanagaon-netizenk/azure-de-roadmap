const loaders = {
  sql: () => import('../content/books/sql.json'),
  pyspark: () => import('../content/books/pyspark.json'),
  databricks: () => import('../content/books/databricks.json'),
  streaming: () => import('../content/books/streaming.json'),
}
const cache = {}
export function loadBook(slug) {
  if (!cache[slug]) cache[slug] = loaders[slug]().then((m) => m.default)
  return cache[slug]
}
