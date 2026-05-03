import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/client'
import Heatmap from '../components/Heatmap'
import TagPicker from '../components/TagPicker'
import { startOfWeek } from '../api/mockData'

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

export default function Dashboard() {
  const [tags, setTags] = useState([])
  const [projects, setProjects] = useState([])
  const [cells, setCells] = useState([])
  const [tagFilter, setTagFilter] = useState([])
  const [rangeId, setRangeId] = useState('rolling')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listTags(), api.listProjects()]).then(([t, p]) => {
      setTags(t)
      setProjects(p)
    })
  }, [])

  useEffect(() => {
    const { from, to } = rangeFor(rangeId)
    setLoading(true)
    api
      .getHeatmap({
        tag_ids: tagFilter,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      })
      .then((c) => {
        setCells(c)
        setLoading(false)
      })
  }, [tagFilter, rangeId])

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

  return (
    <>
      <div className="page-header">
        <div>
          <h2>儀表板</h2>
          <div className="desc">
            技能投入熱點圖 · 顏色深淺依當週新建/更新專案數計算
          </div>
        </div>
        <div className="row">
          <span className="badge">US-03</span>
        </div>
      </div>

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
          <div className="empty">載入熱點圖…</div>
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
