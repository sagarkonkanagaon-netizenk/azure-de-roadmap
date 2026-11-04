// Which pages a visitor can open before signing in. Everything else asks for a free account.
// Only active when accounts are switched on (see lib/auth.js).
const OPEN = [
  /^\/$/, /^\/account$/, /^\/privacy$/, /^\/terms$/, /^\/about$/, /^\/pro$/,
  /^\/learn$/, /^\/learn\/[^/]+$/, /^\/learn\/[^/]+\/1-[^/]+$/,       // handbook covers and chapter 1 of each
  /^\/path$/, /^\/path\/1$/,                                           // the plan and week 1
  /^\/practice$/, /^\/practice\/sql$/, /^\/practice\/sql\/[1-5]$/,     // first 5 SQL problems
  /^\/practice\/python$/, /^\/practice\/python\/[1-3]$/,               // first 3 Python problems
  /^\/daily$/, /^\/interview$/, /^\/pro\/projects\/food-delivery-lakehouse$/, /^\/pro\/cheatsheets$/,
]
export const isOpen = (path) => OPEN.some((r) => r.test(path.replace(/\/+$/, '') || '/'))
