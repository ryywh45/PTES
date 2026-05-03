import { useMemo, useState } from 'react'

// Multi-select tag picker presented as a tree of checkboxes. Used by both the
// project form and filter toolbars.
export default function TagPicker({ tags, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const tree = useMemo(() => buildTree(tags), [tags])
  const selectedNames = tags.filter((t) => value.includes(t.id)).map((t) => t.name)

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          minHeight: 32,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {selectedNames.length === 0 && (
          <span style={{ color: 'var(--text-dim)' }}>
            {placeholder || '選擇標籤…'}
          </span>
        )}
        {selectedNames.map((n) => (
          <span key={n} className="tag-pill">{n}</span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>▾</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            zIndex: 20,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <TreeOptions nodes={tree} value={value} toggle={toggle} depth={0} />
        </div>
      )}
    </div>
  )
}

function TreeOptions({ nodes, value, toggle, depth }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: depth * 14,
              padding: '3px 4px',
              cursor: 'pointer',
              margin: 0,
              color: 'var(--text)',
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={value.includes(n.id)}
              onChange={() => toggle(n.id)}
            />
            {n.name}
          </label>
          {n.children.length > 0 && (
            <TreeOptions
              nodes={n.children}
              value={value}
              toggle={toggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  )
}

function buildTree(tags) {
  const byParent = new Map()
  tags.forEach((t) => {
    const arr = byParent.get(t.parent_id) || []
    arr.push(t)
    byParent.set(t.parent_id, arr)
  })
  const build = (parentId) =>
    (byParent.get(parentId) || []).map((t) => ({
      ...t,
      children: build(t.id),
    }))
  return build(null)
}
