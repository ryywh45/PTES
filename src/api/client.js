// API client. While USE_MOCK is true, all calls resolve from in-memory mock
// data so the UI is fully interactive without a backend. Each method maps 1:1
// to the REST endpoints in SRS §2.5.3.
import {
  mockProjects,
  mockTags,
  careerDirections,
  buildHeatmap,
} from './mockData'

const USE_MOCK = true
const BASE = '/api/v1'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

let projects = [...mockProjects]
let tags = [...mockTags]
let nextProjectId = Math.max(...projects.map((p) => p.id)) + 1
let nextTagId = Math.max(...tags.map((t) => t.id)) + 1

async function http(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Request failed')
  }
  return res.json()
}

// ---------- Projects (US-01, US-05, US-06) ----------

export async function listProjects(params = {}) {
  if (!USE_MOCK) {
    const qs = new URLSearchParams(params).toString()
    return http('GET', `${BASE}/projects${qs ? `?${qs}` : ''}`)
  }
  await delay()
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
  const p = projects.find((p) => p.id === id)
  if (!p) throw new Error('Project not found')
  return p
}

export async function createProject(payload) {
  if (!USE_MOCK) return http('POST', `${BASE}/projects`, payload)
  await delay()
  const now = new Date().toISOString()
  const project = {
    id: nextProjectId++,
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
  projects = projects.filter((p) => p.id !== id)
  return { ok: true }
}

// ---------- Tags (US-02) ----------

export async function listTags() {
  if (!USE_MOCK) return http('GET', `/api/tags`)
  await delay()
  return [...tags]
}

export async function createTag(payload) {
  if (!USE_MOCK) return http('POST', `/api/tags`, payload)
  await delay()
  const tag = { id: nextTagId++, ...payload }
  tags = [...tags, tag]
  return tag
}

export async function updateTag(id, payload) {
  if (!USE_MOCK) return http('PUT', `/api/tags/${id}`, payload)
  await delay()
  const idx = tags.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error('Tag not found')
  tags[idx] = { ...tags[idx], ...payload }
  return tags[idx]
}

export async function deleteTag(id, options = {}) {
  if (!USE_MOCK) return http('DELETE', `/api/tags/${id}`, options)
  await delay()
  const tag = tags.find((t) => t.id === id)
  if (!tag) throw new Error('Tag not found')
  // US-02 AC-2: optional reassignment of children to parent
  if (options.reassignToParent) {
    tags = tags.map((t) =>
      t.parent_id === id ? { ...t, parent_id: tag.parent_id } : t,
    )
  } else {
    // cascade delete subtree
    const subtree = collectSubtree(id)
    tags = tags.filter((t) => !subtree.includes(t.id))
    projects = projects.map((p) => ({
      ...p,
      tag_ids: p.tag_ids.filter((tid) => !subtree.includes(tid)),
    }))
  }
  // remove the tag itself
  tags = tags.filter((t) => t.id !== id)
  // detach from projects (US-05 AC-3 style — keep project, drop tag link)
  projects = projects.map((p) => ({
    ...p,
    tag_ids: p.tag_ids.filter((tid) => tid !== id),
  }))
  return { ok: true }
}

// ---------- Heatmap (US-03) ----------

export async function getHeatmap(params = {}) {
  if (!USE_MOCK) {
    const qs = new URLSearchParams(params).toString()
    return http('GET', `/api/heatmap${qs ? `?${qs}` : ''}`)
  }
  await delay()
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
  if (!USE_MOCK) return http('GET', `/api/reports/directions`)
  await delay()
  return careerDirections
}

export async function generateReport({ direction_id }) {
  if (!USE_MOCK)
    return http('POST', `/api/reports/generate`, { direction_id })
  await delay(400)
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

  return { markdown: md, project_count: matched.length, projects: matched }
}

// ---------- helpers ----------

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

// US-03 AC-5 / US-06 AC-6: filter scope = selected node + all descendants
export function expandTagIds(ids) {
  const set = new Set()
  for (const id of ids) collectSubtree(id).forEach((x) => set.add(x))
  return [...set]
}
