import { useEffect, useState } from 'react'
import * as api from '../api/client'
import { useProfileScope } from '../hooks/useProfileScope'
import ProfilePageHeader from '../components/ProfilePageHeader'

// US-04: pick a career direction → preview filtered projects → generate
// Markdown summary via Gemini AI (POST /api/reports/generate).
export default function Reports() {
  const { ready, activeProfile } = useProfileScope()
  const [directions, setDirections] = useState([])
  const [selected, setSelected] = useState('')
  const [report, setReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)

  useEffect(() => {
    api.getCareerDirections().then((d) => {
      setDirections(d)
      if (d[0]) setSelected(d[0].id)
    })
    api.getReportStatus().then(setAiStatus).catch(() => setAiStatus(null))
  }, [])

  async function generate() {
    if (!ready) return
    setGenerating(true)
    setReport(null)
    try {
      const t0 = performance.now()
      const r = await api.generateReport({ direction_id: selected })
      const elapsed = performance.now() - t0
      setReport({ ...r, elapsed })
    } finally {
      setGenerating(false)
    }
  }

  function download() {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tech-summary-${selected}-${new Date()
      .toISOString()
      .slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dir = directions.find((d) => d.id === selected)
  const generatingLabel = aiStatus?.ai_available ? 'AI 產生中…' : '產生中…'

  return (
    <>
      <div className="page-header">
        <div>
          <h2>技術總結</h2>
          <div className="desc">
            選擇職涯方向，由 Gemini AI 依專案資料產生 Markdown 結構化報告
          </div>
          <ProfilePageHeader
            profile={activeProfile}
            hint="報告將依目前使用者專案產生"
          />
        </div>
        <div className="row">
          <span className="badge">US-04</span>
        </div>
      </div>

      <div className="card">
        <h3>1. 選擇目標職涯方向</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {directions.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={selected === d.id ? 'primary' : ''}
            >
              {d.label}
            </button>
          ))}
        </div>
        {dir && (
          <div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>
            <span>比對標籤：</span>
            {dir.tags.map((t) => (
              <span key={t} className="tag-pill">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>2. 產生報告</h3>
          <div className="spacer" />
          <button
            className="primary"
            onClick={generate}
            disabled={!selected || generating || !ready}
          >
            {generating ? generatingLabel : '產生技術總結'}
          </button>
        </div>

        {aiStatus && (
          <div
            className={`banner ${aiStatus.ai_available ? 'info' : ''}`}
            style={{ marginTop: 14 }}
          >
            {aiStatus.ai_available
              ? `✓ Gemini AI 已就緒（${aiStatus.model}）`
              : '未設定 GEMINI_API_KEY，將使用模板產生報告'}
          </div>
        )}

        {!report && !generating && (
          <div className="empty">尚未產生報告</div>
        )}

        {report && (
          <>
            {report.warning && (
              <div className="banner" style={{ marginTop: 14 }}>
                {report.warning}
              </div>
            )}
            <div className="banner info" style={{ marginTop: 14 }}>
              ✓ 已納入 {report.project_count} 個專案 · 耗時 {Math.round(report.elapsed)} ms
              · {report.source === 'ai'
                ? `Gemini AI 產生${report.model ? `（${report.model}）` : ''}`
                : '模板產生（未設定 API Key 或 AI 失敗）'}
              {report.source === 'ai'
                ? ' · AI 產生可能超過 3 秒'
                : ' · 效能需求：100 筆內 3 秒（NFR-03）'}
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                Markdown 預覽
              </span>
              <div className="spacer" />
              <button onClick={download}>下載 .md</button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(report.markdown)
                }
              >
                複製
              </button>
            </div>
            <div className="md-preview">{report.markdown}</div>
          </>
        )}
      </div>
    </>
  )
}
