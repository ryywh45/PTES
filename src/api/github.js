// GitHub OAuth + import API (SRS §2.5.2). Mirrors backend endpoints in
// /api/v1/github/* with mock fallbacks when USE_MOCK is enabled.
import {
  languageNamesAboveThreshold,
  registerMockImportedProjects,
  resolveMockLanguageTagIds,
  syncMockGithubProjectsActivity,
} from './client'
import { getProfileId, mockProfilesList } from './profileStore'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = '/api/v1/github'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

const mockTokens = new Map([
  [2, 'demo-user'],
])
const mockImportedRepoIds = new Map()

const mockReposByLogin = {
  'demo-user': [
    {
      id: 900001,
      name: 'ptes-demo',
      full_name: 'demo-user/ptes-demo',
      description: 'Personal tech-stack tracker demo repository',
      created_at: '2024-06-01T08:00:00Z',
      updated_at: '2025-12-15T10:30:00Z',
      html_url: 'https://github.com/demo-user/ptes-demo',
      private: false,
    },
    {
      id: 900002,
      name: 'embedded-lab',
      full_name: 'demo-user/embedded-lab',
      description: 'STM32 lab exercises and firmware samples',
      created_at: '2023-09-10T12:00:00Z',
      updated_at: '2024-03-20T16:45:00Z',
      html_url: 'https://github.com/demo-user/embedded-lab',
      private: false,
    },
  ],
  'torvalds': [
    {
      id: 900201,
      name: 'linux',
      full_name: 'torvalds/linux',
      description: 'Linux kernel source tree',
      created_at: '2011-09-04T22:01:45Z',
      updated_at: '2026-03-01T10:00:00Z',
      html_url: 'https://github.com/torvalds/linux',
      private: false,
    },
    {
      id: 900202,
      name: 'test-tlb',
      full_name: 'torvalds/test-tlb',
      description: 'Test repo',
      created_at: '2019-05-09T18:38:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      html_url: 'https://github.com/torvalds/test-tlb',
      private: false,
    },
  ],
  'alice-dev': [
    {
      id: 900101,
      name: 'sensor-fw',
      full_name: 'alice-dev/sensor-fw',
      description: 'STM32 firmware samples',
      created_at: '2024-01-10T09:00:00Z',
      updated_at: '2025-08-01T11:00:00Z',
      html_url: 'https://github.com/alice-dev/sensor-fw',
      private: false,
    },
  ],
}

const mockRepoLanguages = {
  900001: { JavaScript: 6000, TypeScript: 3500, CSS: 80 },
  900002: { C: 8500, Assembly: 1200, Makefile: 300 },
  900101: { C: 9200, Assembly: 800 },
  900201: { C: 97900, Assembly: 700, Rust: 400, Shell: 400, Python: 300, Makefile: 200 },
  900202: { C: 10000 },
}

function buildHeaders(body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const pid = getProfileId()
  if (pid) headers['X-PTES-Profile-Id'] = String(pid)
  return Object.keys(headers).length ? headers : undefined
}

async function http(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: buildHeaders(body),
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

function getMockProfile() {
  const pid = getProfileId()
  return mockProfilesList.find((p) => p.id === pid) || mockProfilesList[0]
}

export async function getGitHubStatus() {
  if (!USE_MOCK) return http('GET', `${BASE}/status`)
  await delay()
  const profile = getMockProfile()
  if (!profile.github_login) {
    return { connected: false, login: null, profile_id: profile.id, public_only: false }
  }
  const hasToken = mockTokens.has(profile.id)
  return {
    connected: true,
    login: profile.github_login,
    profile_id: profile.id,
    public_only: !hasToken,
  }
}

export async function startGitHubLogin() {
  if (!USE_MOCK) {
    const { authorize_url } = await http('GET', `${BASE}/login`)
    window.location.href = authorize_url
    return
  }
  await delay()
  const profile = getMockProfile()
  if (profile.github_login) {
    mockTokens.set(profile.id, profile.github_login)
  } else {
    mockTokens.set(profile.id, 'linked-user')
  }
}

export async function disconnectGitHub() {
  if (!USE_MOCK) return http('DELETE', `${BASE}/disconnect`)
  await delay()
  const profile = getMockProfile()
  mockTokens.delete(profile.id)
  return { ok: true }
}

export async function listGitHubRepos() {
  if (!USE_MOCK) return http('GET', `${BASE}/repos`)
  await delay()
  const profile = getMockProfile()
  const login = mockTokens.get(profile.id) || profile.github_login
  if (!login) throw new Error('尚未連結 GitHub')
  return [...(mockReposByLogin[login] || mockReposByLogin['demo-user'] || [])]
}

export async function importGitHubRepos({ repo_ids, default_tag_ids }) {
  if (!USE_MOCK) {
    return http('POST', `${BASE}/import`, { repo_ids, default_tag_ids })
  }
  await delay(300)
  const profile = getMockProfile()
  const login = mockTokens.get(profile.id) || profile.github_login
  if (!login) throw new Error('尚未連結 GitHub')
  const repos = mockReposByLogin[login] || mockReposByLogin['demo-user'] || []
  if (!mockImportedRepoIds.has(profile.id)) {
    mockImportedRepoIds.set(profile.id, new Set())
  }
  const existingIds = mockImportedRepoIds.get(profile.id)
  const imported = []
  const skipped_repos = []
  let nextId = 900000 + profile.id * 1000

  for (const repoId of repo_ids) {
    const repo = repos.find((r) => r.id === repoId)
    if (!repo) continue
    if (existingIds.has(repoId)) {
      skipped_repos.push(repo)
      continue
    }
    const languages = mockRepoLanguages[repoId] || {}
    const langTagIds = resolveMockLanguageTagIds(
      languageNamesAboveThreshold(languages),
    )
    const tag_ids = [...new Set([...default_tag_ids, ...langTagIds])]
    const project = {
      id: nextId++,
      profile_id: profile.id,
      name: repo.name,
      description: repo.description,
      start_date: repo.created_at.slice(0, 10),
      end_date: null,
      tag_ids,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      activity_dates: [repo.created_at.slice(0, 10), repo.updated_at.slice(0, 10)],
      github_repo_id: repo.id,
      github_full_name: repo.full_name,
    }
    existingIds.add(repoId)
    imported.push(project)
  }

  if (imported.length) registerMockImportedProjects(imported)

  return {
    imported: imported.length,
    skipped: skipped_repos.length,
    projects: imported,
    skipped_repos,
  }
}

export async function syncGitHubActivity({ force = false } = {}) {
  if (!USE_MOCK) {
    const qs = force ? '?force=true' : ''
    return http('POST', `${BASE}/sync-activity${qs}`)
  }
  await delay(200)
  return syncMockGithubProjectsActivity(force)
}

export { USE_MOCK as GITHUB_USE_MOCK }
