import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../api/client'
import * as github from '../api/github'
import { useProfileScope } from '../hooks/useProfileScope'
import ProfilePageHeader from '../components/ProfilePageHeader'
import Heatmap from '../components/Heatmap'
import TagPicker from '../components/TagPicker'
import { formatLocalDate, startOfWeek } from '../api/mockData'

// US-03: dashboard with skill heatmap. Tag filter scope follows AC-5
// (selected node + all descendants). Time range defaults to "rolling 12
// months" but can be switched to a specific calendar year.
const RANGE_OPTIONS = [
  { id: 'rolling', label: '近 12 個月' },
  { id: '2026', label: '2026' },
  { id: '2025', label: '2025' },
  { id: '2024', label: '2024' },
  { id: '2023', label: '2023' },
]

function rangeFor(id) {
  if (id === 'rolling') {
    const today = new Date()
    const to = today
    const fromBase = new Date(today)
    fromBase.setFullYear(fromBase.getFullYear() - 1)
    fromBase.setDate(fromBase.getDate() + 7) // 52 weeks back inclusive
    return { from: startOfWeek(fromBase), to }
  }
  const year = Number(id)
  return {
    from: new Date(`${year}-01-01T00:00:00`),
    to: new Date(`${year}-12-31T23:59:59`),
  }
}

function buildSyncMessage(result, projectList) {
  if (!result) return ''
  const parts = []
  if (result.reason === 'no_token') {
    parts.push(
      '請在 backend/.env 設定 GITHUB_PAT，或使用 OAuth 連結自己的 GitHub 帳號',
    )
  }
  if (result.reason === 'rate_limited') {
    parts.push(
      'GitHub API rate limit 已達上限；請設定 GITHUB_PAT 提高配額，或稍後再試',
    )
  }
  if (result.skipped && result.reason === 'throttled') {
    parts.push('GitHub 活動同步已節流（30 分鐘內不重複），可點「強制重新同步」')
  }
  if (result.errors?.length) {
    parts.push(...result.errors.slice(0, 3))
    if (result.errors.length > 3) {
      parts.push(`另有 ${result.errors.length - 3} 項錯誤`)
    }
  }
  const ghProjects = (projectList || []).filter((p) => p.github_repo_id)
  if (ghProjects.length && result.synced > 0 && !result.skipped) {
    const sparse = ghProjects.filter((p) => (p.activity_dates?.length || 0) <= 2)
    if (sparse.length) {
      parts.push(
        `${sparse.map((p) => p.name).join('、')} 活動日期極少；公開 username 模式請在 backend/.env 設定 GITHUB_PAT，或 OAuth 連結自己的帳號`,
      )
    }
  }
  if (result.synced === 0 && !result.skipped && ghProjects.length) {
    parts.push('未能同步任何 GitHub 專案活動')
  }
  return parts.join('；')
}

export default function Dashboard() {
  const { ready, activeProfileId, activeProfile } = useProfileScope()
  const [tags, setTags] = useState([])
  const [projects, setProjects] = useState([])
  const [cells, setCells] = useState([])
  const [tagFilter, setTagFilter] = useState([])
  const [rangeId, setRangeId] = useState('rolling')
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('載入熱點圖…')
  const [syncWarning, setSyncWarning] = useState('')
  const [githubSyncReady, setGithubSyncReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [heatmapVersion, setHeatmapVersion] = useState(0)

  const runGithubSync = useCallback(async (force = false) => {
    const result = await github.syncGitHubActivity({ force })
    const updated = await api.listProjects()
    setProjects(updated)
    setSyncWarning(buildSyncMessage(result, updated))
    setHeatmapVersion((v) => v + 1)
    return updated
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function bootstrap() {
      setGithubSyncReady(false)
      setSyncWarning('')
      try {
        const [t, p] = await Promise.all([api.listTags(), api.listProjects()])
        if (cancelled) return
        setTags(t)
        setProjects(p)
        setGithubSyncReady(true)

        if (activeProfile?.github_login) {
          setSyncing(true)
          try {
            const result = await github.syncGitHubActivity()
            if (cancelled) return
            const updated = await api.listProjects()
            if (cancelled) return
            setProjects(updated)
            setSyncWarning(buildSyncMessage(result, updated))
            setHeatmapVersion((v) => v + 1)
          } catch (err) {
            if (!cancelled) {
              setSyncWarning(err.message || 'GitHub 活動同步失敗，顯示快取資料')
            }
          } finally {
            if (!cancelled) setSyncing(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSyncWarning(err.message || '載入失敗')
          setGithubSyncReady(true)
        }
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [ready, activeProfileId, activeProfile?.github_login])

  useEffect(() => {
    if (!ready || !githubSyncReady) return
    const { from, to } = rangeFor(rangeId)
    setLoading(true)
    setLoadingMessage('載入熱點圖…')
    api
      .getHeatmap({
        tag_ids: tagFilter,
        from: formatLocalDate(from),
        to: formatLocalDate(to),
      })
      .then((c) => {
        setCells(c)
        setLoading(false)
      })
      .catch((err) => {
        setSyncWarning((prev) => prev || err.message || '熱點圖載入失敗')
        setLoading(false)
      })
  }, [tagFilter, rangeId, ready, activeProfileId, githubSyncReady, heatmapVersion])

  async function handleForceSync() {
    if (!activeProfile?.github_login || syncing) return
    setSyncing(true)
    setSyncWarning('')
    try {
      await runGithubSync(true)
    } catch (err) {
      setSyncWarning(err.message || 'GitHub 活動同步失敗')
    } finally {
      setSyncing(false)
    }
  }

  const stats = useMemo(() => {
    const total = cells.reduce((a, c) => a + c.count, 0)
    const activeWeeks = cells.filter((c) => c.count > 0).length
    const peak = cells.reduce((m, c) => Math.max(m, c.count), 0)
    return { total, activeWeeks, peak }
  }, [cells])

  const rangeLabel = useMemo(() => {
    if (!cells.length) return ''
    return `${cells[0].week_start} ~ ${cells[cells.length - 1].week_start}`
  }, [cells])

  const hasGithubProjects = projects.some((p) => p.github_repo_id)

  return (
    <>
      <div className="page-header">
        <div>
          <h2>儀表板</h2>
          <div className="desc">
            技能投入熱點圖 · 顏色深淺依當週 GitHub commit 活動計算
          </div>
          <ProfilePageHeader profile={activeProfile} />
        </div>
        <div className="row">
          {activeProfile?.github_login && hasGithubProjects && (
            <button
              onClick={handleForceSync}
              disabled={syncing || !githubSyncReady}
              title="略過 30 分鐘節流，重新從 GitHub 拉取 commit 活動"
            >
              {syncing ? '同步中…' : '強制重新同步'}
            </button>
          )}
          <span className="badge">US-03</span>
        </div>
      </div>

      {syncing && (
        <div className="card" style={{ marginBottom: 12, color: 'var(--text-dim)' }}>
          正在從 GitHub 同步 commit 活動（公開帳號可能需 1–2 分鐘），熱點圖會先顯示快取資料…
        </div>
      )}

      {syncWarning && (
        <div className="card" style={{ marginBottom: 12, color: 'var(--warn, #c9a227)' }}>
          {syncWarning}
        </div>
      )}

      {activeProfile?.github_login && !hasGithubProjects && githubSyncReady && (
        <div className="card" style={{ marginBottom: 12, color: 'var(--text-dim)' }}>
          尚未匯入 GitHub repositories。請至{' '}
          <a href="/projects">專案管理</a> 從 GitHub 匯入後，熱點圖才會顯示 commit 活動。
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <label>時間範圍</label>
            <div className="row" style={{ gap: 6 }}>
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRangeId(r.id)}
                  className={rangeId === r.id ? 'primary' : ''}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label>標籤篩選（含子孫節點）</label>
            <TagPicker
              tags={tags}
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="未篩選 — 顯示全部專案"
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={() => setTagFilter([])} disabled={!tagFilter.length}>
              清除篩選
            </button>
          </div>
        </div>

        {rangeLabel && (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 6 }}>
            {rangeLabel}
          </div>
        )}

        {loading ? (
          <div className="empty">{loadingMessage}</div>
        ) : (
          <Heatmap cells={cells} projects={projects} tags={tags} />
        )}
      </div>

      <div className="row" style={{ gap: 16 }}>
        <Stat label="範圍內活動次數" value={stats.total} />
        <Stat
          label="活躍週數"
          value={`${stats.activeWeeks} / ${cells.length || 0}`}
        />
        <Stat label="單週尖峰" value={stats.peak} />
        <Stat label="專案總數" value={projects.length} />
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, marginBottom: 0 }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  )
}
