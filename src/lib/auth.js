// Accounts for Pro, with one active device per account.
// Off until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time.
// The Supabase library is loaded only when someone opens the account page or is signed in.
const URL_ = import.meta.env.VITE_SUPABASE_URL || ''
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const AUTH_ENABLED = Boolean(URL_ && KEY)

let clientPromise = null
export function client() {
  if (!AUTH_ENABLED) return Promise.resolve(null)
  if (!clientPromise) {
    // A sign-in link or Google lands here with ?code=. Note it before the library swaps it for a session.
    const fromRedirect = /[?&]code=/.test(window.location.search)
    clientPromise = import('@supabase/supabase-js').then(async ({ createClient }) => {
      const sb = createClient(URL_, KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, storageKey: 'dd:auth' } })
      const { data: { session } } = await sb.auth.getSession()
      if (fromRedirect) {
        if (session) await sb.rpc('claim_device', { p_device: deviceId(), p_label: deviceLabel() })
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
      return sb
    })
  }
  return clientPromise
}

// A random id for this browser. It identifies the device, not the person.
export function deviceId() {
  try {
    let id = localStorage.getItem('dd:device')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('dd:device', id) }
    return id
  } catch (e) { return 'no-storage' }
}

export function deviceLabel() {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown device'
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${br} on ${os}`
}

const redirectTo = () => window.location.origin + window.location.pathname

export async function sendEmailLink(email) {
  const sb = await client()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
  if (error) throw error
}

export async function verifyCode(email, token) {
  const sb = await client()
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  await claimDevice()
}

export async function signInWithGoogle() {
  const sb = await client()
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  if (error) throw error
}

export async function signOut() {
  const sb = await client()
  if (sb) await sb.auth.signOut({ scope: 'local' })
}

// Make this browser the account's one active device. Any other device is signed out at its next check.
export async function claimDevice() {
  const sb = await client()
  const { error } = await sb.rpc('claim_device', { p_device: deviceId(), p_label: deviceLabel() })
  if (error) throw error
}

// Returns the profile, or { kicked: true } when another device has taken over the account.
export async function loadProfile() {
  const sb = await client()
  if (!sb) return null
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return null
  const { data, error } = await sb.from('profiles').select('active_device, device_label, plan, pro_until').eq('user_id', session.user.id).maybeSingle()
  if (error) throw error
  if (!data || !data.active_device) { await claimDevice(); return { email: session.user.email, plan: data?.plan || 'free', pro_until: data?.pro_until || null, device_label: deviceLabel() } }
  if (data.active_device !== deviceId()) {
    await sb.auth.signOut({ scope: 'local' })
    return { kicked: true, other: data.device_label }
  }
  return { email: session.user.email, ...data }
}

// True when this browser may hold a session, so the background check is worth loading the library for.
export function mightBeSignedIn() {
  if (!AUTH_ENABLED) return false
  try { return /[?&]code=/.test(window.location.search) || Boolean(localStorage.getItem('dd:auth')) } catch (e) { return false }
}
