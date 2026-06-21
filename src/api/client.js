// API client. While USE_MOCK is true, all calls resolve from in-memory mock
// data so the UI is fully interactive without a backend. Each method maps 1:1
// to the REST endpoints in SRS §2.5.3.
import {
  careerDirections,
  buildHeatmap,
  synthActivity,
} from './mockData'
import {
  mockProfilesList,
  buildMockProjectsForProfile,
  buildMockTagsForProfile,
  getProfileId,
} from './profileStore'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = '/api/v1'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

let mockProfiles = mockProfilesList
let projects = []
let tags = []
let nextProjectId = 10000
let nextTagId = 10000
let mockScopedProfileId = null

function ensureMockScope() {
  const pid = getProfileId() || mockProfilesList[0]?.id || 1
  if (mockScopedProfileId !== pid) {
    mockScopedProfileId = pid
    projects = buildMockProjectsForProfile(pid).map((p) => ({ ...p }))
    tags = buildMockTagsForProfile(pid).map((t) => ({ ...t }))
    nextProjectId = Math.max(10000, ...projects.map((p) => p.id)) + 1
    nextTagId = Math.max(10000, ...tags.map((t) => t.id)) + 1
  }
  return pid
}

export function registerMockImportedProjects(newProjects) {
  projects = [...newProjects, ...projects]
  nextProjectId = Math.max(nextProjectId, ...newProjects.map((p) => p.id)) + 1
}

const mockGithubSyncAt = new Map()
const MOCK_SYNC_THROTTLE_MS = 30 * 60 * 1000

export function syncMockGithubProjectsActivity(force = false) {
  ensureMockScope()
  const pid = getProfileId()
  const profile = mockProfiles.find((p) => p.id === pid)
  if (!profile?.github_login) {
    return {
      synced: 0,
      skipped: true,
      reason: 'no_github',
      errors: [],
      synced_at: null,
    }
  }

  const githubProjects = projects.filter(
    (p) => p.profile_id === pid && p.github_repo_id,
  )
  if (!githubProjects.length) {
    const syncedAt = new Date().toISOString()
    mockGithubSyncAt.set(pid, Date.now())
    return {
      synced: 0,
      skipped: false,
      reason: 'no_projects',
      errors: [],
      synced_at: syncedAt,
    }
  }

  const last = mockGithubSyncAt.get(pid)
  if (!force && last && Date.now() - last < MOCK_SYNC_THROTTLE_MS) {
    return {
      synced: 0,
      skipped: true,
      reason: 'throttled',
      errors: [],
      synced_at: new Date(last).toISOString(),
    }
  }

  let synced = 0
  for (const project of githubProjects) {
    project.activity_dates = synthActivity(
      project.github_repo_id,
      project.start_date,
      project.end_date,
      1.2,
    )
    synced += 1
  }

  const syncedAt = new Date().toISOString()
  mockGithubSyncAt.set(pid, Date.now())
  return {
    synced,
    skipped: false,
    reason: null,
    errors: [],
    synced_at: syncedAt,
  }
}

function buildQuery(params = {}) {
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

function buildHeaders(body, requireProfile = true) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (requireProfile) {
    const pid = getProfileId()
    if (pid) headers['X-PTES-Profile-Id'] = String(pid)
  }
  return Object.keys(headers).length ? headers : undefined
}

async function http(method, path, body, requireProfile = true) {
  const res = await fetch(path, {
    method,
    headers: buildHeaders(body, requireProfile),
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

// ---------- Profiles ----------

export async function listProfiles() {
  if (!USE_MOCK) return http('GET', `${BASE}/profiles`, undefined, false)
  await delay()
  return [...mockProfiles]
}

export async function createProfileFromGitHub(username) {
  if (!USE_MOCK) {
    return http('POST', `${BASE}/profiles/from-github`, { username: username.trim() }, false)
  }
  await delay(200)
  const login = username.trim().toLowerCase()
  if (!login) throw new Error('請輸入 GitHub username')
  let profile = mockProfilesList.find((p) => p.github_login === login)
  if (profile) return profile

  const known = {
    torvalds: {
      display_name: 'Linus Torvalds',
      avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
    },
    'demo-user': {
      display_name: 'demo-user',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
  }
  const meta = known[login] || {
    display_name: login,
    avatar_url: `https://github.com/${login}.png`,
  }
  profile = {
    id: Math.max(...mockProfilesList.map((p) => p.id)) + 1,
    github_login: login,
    display_name: meta.display_name,
    avatar_url: meta.avatar_url,
    has_token: false,
    created_at: new Date().toISOString(),
  }
  mockProfilesList.push(profile)
  return profile
}

export async function deleteProfile(id) {
  if (!USE_MOCK) return http('DELETE', `${BASE}/profiles/${id}`, undefined, false)
  await delay()
  mockProfiles = mockProfiles.filter((p) => p.id !== id)
  return { ok: true }
}

// ---------- Projects (US-01, US-05, US-06) ----------

export async function listProjects(params = {}) {
  if (!USE_MOCK) {
    return http('GET', `${BASE}/projects${buildQuery(params)}`)
  }
  await delay()
  ensureMockScope()
  let out = [...projects]
  if (params.q) {
    const q = params.q.toLowerCase()
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    )
  }
  if (params.tag_ids && params.tag_ids.length) {
    const expanded = expandTagIds(params.tag_ids)
    out = out.filter((p) => p.tag_ids.some((t) => expanded.includes(t)))
  }
  if (params.from) {
    out = out.filter((p) => p.start_date >= params.from)
  }
  if (params.to) {
    out = out.filter((p) => p.start_date <= params.to)
  }
  return out
}

export async function getProject(id) {
  if (!USE_MOCK) return http('GET', `${BASE}/projects/${id}`)
  await delay()
  ensureMockScope()
  const p = projects.find((p) => p.id === id)
  if (!p) throw new Error('Project not found')
  return p
}

export async function createProject(payload) {
  if (!USE_MOCK) return http('POST', `${BASE}/projects`, payload)
  await delay()
  const profileId = ensureMockScope()
  const now = new Date().toISOString()
  const project = {
    id: nextProjectId++,
    profile_id: profileId,
    created_at: now,
    updated_at: now,
    ...payload,
  }
  projects = [project, ...projects]
  return project
}

export async function updateProject(id, payload) {
  if (!USE_MOCK) return http('PUT', `${BASE}/projects/${id}`, payload)
  await delay()
  ensureMockScope()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error('Project not found')
  projects[idx] = {
    ...projects[idx],
    ...payload,
    updated_at: new Date().toISOString(),
  }
  return projects[idx]
}

export async function deleteProject(id) {
  if (!USE_MOCK) return http('DELETE', `${BASE}/projects/${id}`)
  await delay()
  ensureMockScope()
  projects = projects.filter((p) => p.id !== id)
  return { ok: true }
}

// ---------- Tags (US-02) ----------

export async function listTags() {
  if (!USE_MOCK) return http('GET', `/api/tags`)
  await delay()
  ensureMockScope()
  return [...tags]
}

export async function createTag(payload) {
  if (!USE_MOCK) return http('POST', `/api/tags`, payload)
  await delay()
  const profileId = ensureMockScope()
  const tag = { id: nextTagId++, profile_id: profileId, ...payload }
  tags = [...tags, tag]
  return tag
}

export async function updateTag(id, payload) {
  if (!USE_MOCK) return http('PUT', `/api/tags/${id}`, payload)
  await delay()
  ensureMockScope()
  const idx = tags.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error('Tag not found')
  tags[idx] = { ...tags[idx], ...payload }
  return tags[idx]
}

export async function deleteTag(id, options = {}) {
  if (!USE_MOCK) return http('DELETE', `/api/tags/${id}`, options)
  await delay()
  ensureMockScope()
  const tag = tags.find((t) => t.id === id)
  if (!tag) throw new Error('Tag not found')
  if (options.reassignToParent) {
    tags = tags.map((t) =>
      t.parent_id === id ? { ...t, parent_id: tag.parent_id } : t,
    )
  } else {
    const subtree = collectSubtree(id)
    tags = tags.filter((t) => !subtree.includes(t.id))
    projects = projects.map((p) => ({
      ...p,
      tag_ids: p.tag_ids.filter((tid) => !subtree.includes(tid)),
    }))
  }
  tags = tags.filter((t) => t.id !== id)
  projects = projects.map((p) => ({
    ...p,
    tag_ids: p.tag_ids.filter((tid) => tid !== id),
  }))
  return { ok: true }
}

// ---------- Heatmap (US-03) ----------

export async function getHeatmap(params = {}) {
  if (!USE_MOCK) {
    return http('GET', `/api/heatmap${buildQuery(params)}`)
  }
  await delay()
  ensureMockScope()
  let scope = projects
  if (params.tag_ids && params.tag_ids.length) {
    const expanded = expandTagIds(params.tag_ids)
    scope = scope.filter((p) => p.tag_ids.some((t) => expanded.includes(t)))
  }
  const to = params.to ? new Date(params.to) : new Date()
  const from = params.from
    ? new Date(params.from)
    : new Date(to.getTime() - 364 * 86400000)
  return buildHeatmap(scope, from, to)
}

// ---------- Reports (US-04) ----------

export async function getCareerDirections() {
  if (!USE_MOCK) return http('GET', `/api/reports/directions`, undefined, false)
  await delay()
  return careerDirections
}

export async function getReportStatus() {
  if (!USE_MOCK) return http('GET', `/api/reports/status`, undefined, false)
  await delay()
  return { ai_available: false, model: null }
}

export async function generateReport({ direction_id }) {
  if (!USE_MOCK)
    return http('POST', `/api/reports/generate`, { direction_id })
  await delay(400)
  ensureMockScope()
  const dir = careerDirections.find((d) => d.id === direction_id)
  if (!dir) throw new Error('Unknown direction')
  const targetTagIds = tags
    .filter((t) => dir.tags.includes(t.name))
    .map((t) => t.id)
  const expanded = expandTagIds(targetTagIds)
  const matched = projects
    .filter((p) => p.tag_ids.some((t) => expanded.includes(t)))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))

  const tagNames = (ids) =>
    ids.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean)

  const md = [
    `# 技術總結 — ${dir.label}`,
    '',
    '## 概述',
    `本總結針對「${dir.label}」方向，彙整與 ${dir.tags.join('、')} 相關之專案經歷。共納入 ${matched.length} 個專案。`,
    '',
    '## 關鍵技術',
    dir.tags.map((t) => `- ${t}`).join('\n'),
    '',
    '## 詳細專案描述',
    ...matched.map((p) => {
      const period = `${p.start_date} ~ ${p.end_date || '進行中'}`
      return [
        `### ${p.name}`,
        `- 期間：${period}`,
        `- 技術：${tagNames(p.tag_ids).join('、')}`,
        `- 描述：${p.description || ''}`,
        '',
      ].join('\n')
    }),
    '## 結語',
    `以上 ${matched.length} 個專案展現本人在「${dir.label}」方向之累積與發展。`,
  ].join('\n')

  return {
    markdown: md,
    project_count: matched.length,
    projects: matched,
    source: 'template',
    model: null,
    warning: null,
  }
}

// ---------- helpers ----------

const LANGUAGES_PARENT_NAME = 'Languages'

export function languageNamesAboveThreshold(languages, minPercent = 1.0) {
  if (!languages || typeof languages !== 'object') return []
  const entries = Object.entries(languages).filter(
    ([, nbytes]) => typeof nbytes === 'number' && nbytes > 0,
  )
  if (!entries.length) return []
  const total = entries.reduce((sum, [, nbytes]) => sum + nbytes, 0)
  if (total <= 0) return []
  return entries
    .sort((a, b) => b[1] - a[1])
    .filter(([, nbytes]) => (nbytes / total) * 100 >= minPercent)
    .map(([name]) => name)
}

export function resolveMockLanguageTagIds(languageNames) {
  ensureMockScope()
  if (!languageNames?.length) return []

  const byNameLower = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]))
  const resolved = []
  const seen = new Set()

  for (const languageName of languageNames) {
    const existing = byNameLower.get(languageName.toLowerCase())
    if (existing) {
      if (!seen.has(existing.id)) {
        resolved.push(existing.id)
        seen.add(existing.id)
      }
      continue
    }

    let parent = tags.find(
      (tag) => tag.parent_id == null && tag.name.toLowerCase() === LANGUAGES_PARENT_NAME.toLowerCase(),
    )
    if (!parent) {
      parent = {
        id: nextTagId++,
        profile_id: getProfileId(),
        name: LANGUAGES_PARENT_NAME,
        parent_id: null,
      }
      tags = [...tags, parent]
      byNameLower.set(parent.name.toLowerCase(), parent)
    }

    const tag = {
      id: nextTagId++,
      profile_id: getProfileId(),
      name: languageName,
      parent_id: parent.id,
    }
    tags = [...tags, tag]
    byNameLower.set(tag.name.toLowerCase(), tag)
    if (!seen.has(tag.id)) {
      resolved.push(tag.id)
      seen.add(tag.id)
    }
  }

  return resolved
}

function collectSubtree(rootId) {
  const out = [rootId]
  const queue = [rootId]
  while (queue.length) {
    const head = queue.shift()
    for (const t of tags) {
      if (t.parent_id === head) {
        out.push(t.id)
        queue.push(t.id)
      }
    }
  }
  return out
}

export function expandTagIds(ids) {
  const set = new Set()
  for (const id of ids) collectSubtree(id).forEach((x) => set.add(x))
  return [...set]
}

export { USE_MOCK }
