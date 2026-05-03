import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/client'
import Modal from '../components/Modal'

// US-02: hierarchical tag manager. Supports add, rename, reparent (via dropdown
// in edit dialog), and delete-with-reassign-or-cascade prompt.
export default function Tags() {
  const [tags, setTags] = useState([])
  const [projects, setProjects] = useState([])
  const [collapsed, setCollapsed] = useState(new Set())
  const [editing, setEditing] = useState(null) // { id?, name, parent_id }
  const [deleting, setDeleting] = useState(null)

  async function reload() {
    const [t, p] = await Promise.all([api.listTags(), api.listProjects()])
    setTags(t)
    setProjects(p)
  }

  useEffect(() => {
    reload()
  }, [])

  const tree = useMemo(() => buildTree(tags), [tags])
  const linkedProjectCount = useMemo(() => {
    const m = new Map()
    projects.forEach((p) =>
      p.tag_ids.forEach((id) => m.set(id, (m.get(id) || 0) + 1)),
    )
    return m
  }, [projects])

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveTag(payload) {
    if (editing.id) await api.updateTag(editing.id, payload)
    else await api.createTag(payload)
    setEditing(null)
    reload()
  }

  async function confirmDelete(reassignToParent) {
    await api.deleteTag(deleting.id, { reassignToParent })
    setDeleting(null)
    reload()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>標籤管理</h2>
          <div className="desc">
            以樹狀結構組織技術標籤；支援新增、重新命名、變更父節點與刪除
          </div>
        </div>
        <div className="row">
          <span className="badge">US-02</span>
          <button
            className="primary"
            onClick={() =>
              setEditing({ name: '', parent_id: null })
            }
          >
            + 新增頂層標籤
          </button>
        </div>
      </div>

      <div className="card">
        {tags.length === 0 ? (
          <div className="empty">尚無標籤，先建立一個吧</div>
        ) : (
          <div className="tag-tree">
            {tree.map((n) => (
              <TreeRow
                key={n.id}
                node={n}
                depth={0}
                collapsed={collapsed}
                toggle={toggle}
                onAddChild={(parent) =>
                  setEditing({ name: '', parent_id: parent.id })
                }
                onEdit={(t) => setEditing({ ...t })}
                onDelete={(t) => setDeleting(t)}
                projectCount={linkedProjectCount}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing.id ? `編輯標籤 — ${editing.name}` : '新增標籤'}
          onClose={() => setEditing(null)}
          width={460}
        >
          <TagForm
            tags={tags}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={saveTag}
          />
        </Modal>
      )}

      {deleting && (
        <DeleteTagDialog
          tag={deleting}
          tags={tags}
          linkedCount={linkedProjectCount.get(deleting.id) || 0}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}

function TreeRow({
  node,
  depth,
  collapsed,
  toggle,
  onAddChild,
  onEdit,
  onDelete,
  projectCount,
}) {
  const isCollapsed = collapsed.has(node.id)
  const hasChildren = node.children.length > 0
  const count = projectCount.get(node.id) || 0
  return (
    <div>
      <div className="tag-node">
        <span className="twirl" onClick={() => hasChildren && toggle(node.id)}>
          {hasChildren ? (isCollapsed ? '▸' : '▾') : '·'}
        </span>
        <span className="name">{node.name}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          {count > 0 ? `${count} 個專案` : ''}
        </span>
        <div className="actions">
          <button className="ghost" onClick={() => onAddChild(node)}>
            + 子標籤
          </button>
          <button className="ghost" onClick={() => onEdit(node)}>
            編輯
          </button>
          <button
            className="ghost"
            style={{ color: 'var(--danger)' }}
            onClick={() => onDelete(node)}
          >
            刪除
          </button>
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <div className="tag-children">
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              collapsed={collapsed}
              toggle={toggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              projectCount={projectCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TagForm({ tags, initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || '')
  const [parentId, setParentId] = useState(initial.parent_id ?? '')
  const [err, setErr] = useState('')

  // Prevent picking self or descendant as parent
  const invalidParents = useMemo(() => {
    if (!initial.id) return new Set()
    const out = new Set([initial.id])
    const queue = [initial.id]
    while (queue.length) {
      const head = queue.shift()
      tags.forEach((t) => {
        if (t.parent_id === head) {
          out.add(t.id)
          queue.push(t.id)
        }
      })
    }
    return out
  }, [tags, initial])

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setErr('名稱為必填')
      return
    }
    onSubmit({
      name: name.trim(),
      parent_id: parentId === '' ? null : Number(parentId),
    })
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>標籤名稱</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          style={{ width: '100%' }}
        />
        {err && <div className="err">{err}</div>}
      </div>
      <div className="field">
        <label>父節點</label>
        <select
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="">— 頂層 —</option>
          {tags
            .filter((t) => !invalidParents.has(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {indentLabel(t, tags)}
              </option>
            ))}
        </select>
        <div className="help">
          變更父節點時，所有子標籤會一併移動（US-02 AC-3）
        </div>
      </div>
      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel}>取消</button>
        <button type="submit" className="primary">
          {initial.id ? '更新' : '建立'}
        </button>
      </div>
    </form>
  )
}

function DeleteTagDialog({ tag, tags, linkedCount, onCancel, onConfirm }) {
  const hasChildren = tags.some((t) => t.parent_id === tag.id)
  const canReassign = tag.parent_id !== null && hasChildren

  return (
    <Modal title="刪除標籤" onClose={onCancel} width={460}>
      <p>
        確定要刪除「<strong>{tag.name}</strong>」嗎？
      </p>
      {linkedCount > 0 && (
        <div className="banner warn">
          此標籤已被 {linkedCount} 個專案使用。刪除後關聯將被移除。
        </div>
      )}
      {hasChildren && (
        <div className="banner info">
          此標籤包含子標籤。請選擇處理方式：
        </div>
      )}
      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onCancel}>取消</button>
        {canReassign && (
          <button onClick={() => onConfirm(true)}>
            將子標籤改掛到父節點
          </button>
        )}
        <button className="danger" onClick={() => onConfirm(false)}>
          {hasChildren ? '連同子標籤一併刪除' : '刪除'}
        </button>
      </div>
    </Modal>
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
    (byParent.get(parentId) || [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ ...t, children: build(t.id) }))
  return build(null)
}

function indentLabel(tag, tags) {
  let depth = 0
  let cur = tag
  while (cur.parent_id !== null) {
    const parent = tags.find((t) => t.id === cur.parent_id)
    if (!parent) break
    depth++
    cur = parent
  }
  return `${'　'.repeat(depth)}${tag.name}`
}
