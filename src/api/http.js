const STORAGE_KEY = 'ptes_user_id'

let currentUserId = Number(localStorage.getItem(STORAGE_KEY)) || 1

export function getCurrentUserId() {
  return currentUserId
}

export function setCurrentUserId(id) {
  currentUserId = id
  localStorage.setItem(STORAGE_KEY, String(id))
  window.dispatchEvent(
    new CustomEvent('ptes:user-changed', { detail: { userId: id } }),
  )
}

export function buildQuery(params = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) qs.set(key, value.join(','))
    } else {
      qs.set(key, String(value))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function http(method, path, body) {
  const headers = {
    'X-PTES-User-Id': String(currentUserId),
  }
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const msg = err.message || err.detail || 'Request failed'
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  if (res.status === 204) return null
  return res.json()
}

export async function httpNoUser(method, path, body) {
  const headers = body ? { 'Content-Type': 'application/json' } : undefined
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const msg = err.message || err.detail || 'Request failed'
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  if (res.status === 204) return null
  return res.json()
}
