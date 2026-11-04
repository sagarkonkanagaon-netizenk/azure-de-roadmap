// A tiny ustar writer, so a project's raw files download as one archive with their folders.
// Windows 11, macOS and Linux open .tar files without extra software.
const enc = new TextEncoder()
function header(name, size) {
  const h = new Uint8Array(512)
  const put = (s, off, len) => h.set(enc.encode(s).slice(0, len), off)
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0'
  put(name, 0, 100)
  put(oct(0o644, 8), 100, 8); put(oct(0, 8), 108, 8); put(oct(0, 8), 116, 8)
  put(oct(size, 12), 124, 12); put(oct(Math.floor(Date.UTC(2026, 9, 3) / 1000), 12), 136, 12)
  put('        ', 148, 8) // checksum is computed with this field as spaces
  put('0', 156, 1); put('ustar\0', 257, 6); put('00', 263, 2)
  let sum = 0; for (const b of h) sum += b
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
  return h
}
export function makeTar(files) {
  const parts = []
  for (const [name, text] of Object.entries(files)) {
    const data = enc.encode(text)
    parts.push(header(name, data.length), data)
    const padLen = (512 - (data.length % 512)) % 512
    if (padLen) parts.push(new Uint8Array(padLen))
  }
  parts.push(new Uint8Array(1024))
  return new Blob(parts, { type: 'application/x-tar' })
}
export function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
