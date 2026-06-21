import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as api from '../api/client'
import { useProfileScope } from '../hooks/useProfileScope'
import ProfilePageHeader from '../components/ProfilePageHeader'
import ProjectForm from '../components/ProjectForm'
import TagPicker from '../components/TagPicker'
import Modal from '../components/Modal'
import GitHubImportModal from '../components/GitHubImportModal'

// US-01 / US-05 / US-06: project list with search, tag + date filters,
// inline edit & delete-with-confirmation.
export default function Projects() {
  const {
    ready,
    activeProfileId,
    activeProfile,
    switchProfile,
    refreshProfiles,
  } = useProfileScope()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tags, setTags] = useState([])
  const [projects, setProjects] = useState([])
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  async function reload() {
    setLoading(true)
    const data = await api.listProjects({
      q: q || undefined,
      tag_ids: tagFilter.length ? tagFilter : undefined,
      from: from || undefined,
      to: to || undefined,
    })
    setProjects(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!ready) return
    api.listTags().then(setTags)
  }, [ready, activeProfileId])

  useEffect(() => {
    if (searchParams.get('github') === 'connected') {
      const profileParam = searchParams.get('profile')
      if (profileParam) {
        switchProfile(Number(profileParam))
        refreshProfiles()
      }
      setShowGitHub(true)
      searchParams.delete('github')
      searchParams.delete('profile')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, switchProfile, refreshProfiles])

  useEffect(() => {
    if (!ready) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tagFilter, from, to, ready, activeProfileId])

  const tagMap = useMemo(() => {
    const m = new Map()
    tags.forEach((t) => m.set(t.id, t))
    return m
  }, [tags])

  async function onCreate(payload) {
    await api.createProject(payload)
    setShowForm(false)
    reload()
  }

  async function onEdit(payload) {
    await api.updateProject(editing.id, payload)
    setEditing(null)
    reload()
  }

  async function onDelete() {
    await api.deleteProject(confirmDel.id)
    setConfirmDel(null)
    reload()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>專案管理</h2>
          <div className="desc">
            新增、編輯、刪除專案，並以名稱、標籤與日期範圍快速篩選
          </div>
          <ProfilePageHeader profile={activeProfile} />
        </div>
        <div className="row">
          <span className="badge">US-01 · US-05 · US-06</span>
          <button className="ghost" onClick={() => setShowGitHub(true)}>
            從 GitHub 匯入
          </button>
          <button className="primary" onClick={() => setShowForm(true)}>
            + 新增專案
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            type="search"
            placeholder="🔍 依名稱或描述搜尋…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <div style={{ width: 280 }}>
            <TagPicker
              tags={tags}
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="標籤篩選…"
            />
          </div>
          <div className="row" style={{ gap: 4 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>從</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>至</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {(q || tagFilter.length || from || to) && (
            <button
              className="ghost"
              onClick={() => {
                setQ('')
                setTagFilter([])
                setFrom('')
                setTo('')
              }}
            >
              清除
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty">載入中…</div>
        ) : projects.length === 0 ? (
          <div className="empty">沒有符合條件的專案</div>
        ) : (
          <table className="projects">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>名稱</th>
                <th>描述</th>
                <th style={{ width: 180 }}>期間</th>
                <th style={{ width: 220 }}>標籤</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>{p.description}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {p.start_date}
                    <br />~ {p.end_date || '進行中'}
                  </td>
                  <td>
                    {p.tag_ids.map((id) => (
                      <span key={id} className="tag-pill">
                        {tagMap.get(id)?.name || `#${id}`}
                      </span>
                    ))}
                  </td>
                  <td className="actions">
                    <button className="ghost" onClick={() => setEditing(p)}>
                      編輯
                    </button>
                    <button
                      className="ghost"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setConfirmDel(p)}
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showGitHub && (
        <Modal title="從 GitHub 匯入" onClose={() => setShowGitHub(false)} width={640}>
          <GitHubImportModal
            profileName={activeProfile?.display_name}
            onClose={() => setShowGitHub(false)}
            onImported={() => reload()}
          />
        </Modal>
      )}

      {showForm && (
        <Modal title="新增專案" onClose={() => setShowForm(false)}>
          <ProjectForm
            tags={tags}
            onSubmit={onCreate}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`編輯專案 — ${editing.name}`} onClose={() => setEditing(null)}>
          <ProjectForm
            tags={tags}
            initial={editing}
            onSubmit={onEdit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {confirmDel && (
        <Modal title="確認刪除" onClose={() => setConfirmDel(null)} width={420}>
          <p>
            確定要刪除「<strong>{confirmDel.name}</strong>」嗎？
            此操作無法復原。
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            標籤關聯將被移除，但標籤本身會保留（US-05 AC-3）。
          </p>
          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setConfirmDel(null)}>取消</button>
            <button className="danger" onClick={onDelete}>
              刪除
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
