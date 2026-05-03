import { useMemo, useState } from 'react'

// Per-SRS US-03 the heatmap unit is one week (Mon~Sun). We render each week as
// a single tall cell with W-numbered labels above so the column labelling lines
// up clearly. Tooltip shows that week's project activity.
export default function Heatmap({ cells, projects, tags }) {
  const [tooltip, setTooltip] = useState(null)
  const max = useMemo(
    () => Math.max(1, ...cells.map((c) => c.count)),
    [cells],
  )

  function level(count) {
    if (count === 0) return 0
    const ratio = count / max
    if (ratio < 0.25) return 1
    if (ratio < 0.5) return 2
    if (ratio < 0.75) return 3
    return 4
  }

  function onEnter(ev, cell) {
    const projs = (cell.project_ids || [])
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean)
    setTooltip({
      x: ev.clientX,
      y: ev.clientY,
      cell,
      projects: projs.slice(0, 6),
      tags,
    })
  }

  // Show W-label every N columns plus the first and last.
  const labelStep = cells.length > 40 ? 4 : 2

  return (
    <div className="heatmap-wrap" onMouseLeave={() => setTooltip(null)}>
      <div
        className="heatmap-week-labels"
        style={{ gridTemplateColumns: `repeat(${cells.length}, 18px)` }}
      >
        {cells.map((c, i) => (
          <span key={c.week_start} className="heatmap-week-label">
            {i === 0 || i === cells.length - 1 || (i + 1) % labelStep === 0
              ? `W${c.week_index}`
              : ''}
          </span>
        ))}
      </div>
      <div
        className="heatmap"
        style={{ gridTemplateColumns: `repeat(${cells.length}, 18px)` }}
      >
        {cells.map((c) => (
          <div
            key={c.week_start}
            className={`cell l${level(c.count)}`}
            onMouseEnter={(ev) => onEnter(ev, c)}
            onMouseMove={(ev) => onEnter(ev, c)}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>共 {cells.length} 週</span>
        <span style={{ flex: 1 }} />
        <span>較少</span>
        <span className="cell" style={{ background: 'var(--heatmap-0)' }} />
        <span className="cell" style={{ background: 'var(--heatmap-1)' }} />
        <span className="cell" style={{ background: 'var(--heatmap-2)' }} />
        <span className="cell" style={{ background: 'var(--heatmap-3)' }} />
        <span className="cell" style={{ background: 'var(--heatmap-4)' }} />
        <span>較多</span>
      </div>
      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 320),
            top: tooltip.y + 14,
          }}
        >
          <div className="ttl">
            W{tooltip.cell.week_index} · 起始 {tooltip.cell.week_start}
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            活動次數 {tooltip.cell.count}
          </div>
          {tooltip.projects.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {tooltip.projects.map((p) => {
                const tagNames = p.tag_ids
                  .slice(0, 3)
                  .map((id) => tooltip.tags.find((t) => t.id === id)?.name)
                  .filter(Boolean)
                return (
                  <div key={p.id} className="proj">
                    · {p.name}
                    {tagNames.length ? ` [${tagNames.join(', ')}]` : ''}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
