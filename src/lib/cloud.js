// Saves learning progress to the signed-in account, so it survives a cleared browser or a new device.
import { client } from './auth.js'
import { getProgress, mergeProgress, subscribe } from './progress.js'

let started = false
let timer = null

async function push(sb, uid) {
  const profile = (() => { try { return JSON.parse(localStorage.getItem('z2h:profile')) } catch (e) { return null } })()
  await sb.from('progress').upsert({ user_id: uid, data: { progress: getProgress(), profile }, updated_at: new Date().toISOString() })
}

export async function startCloudSync() {
  if (started) return
  const sb = await client()
  if (!sb) return
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return
  started = true
  const uid = session.user.id
  try {
    const { data } = await sb.from('progress').select('data').eq('user_id', uid).maybeSingle()
    if (data?.data?.progress) mergeProgress(data.data.progress)
    if (data?.data?.profile) { try { if (!localStorage.getItem('z2h:profile')) localStorage.setItem('z2h:profile', JSON.stringify(data.data.profile)) } catch (e) { /* ignore */ } }
    await push(sb, uid)
  } catch (e) { /* offline: try again on the next change */ }
  subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(() => { push(sb, uid).catch(() => {}) }, 4000)
  })
}

export function stopCloudSync() { started = false; clearTimeout(timer) }
