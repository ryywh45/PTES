import { useEffect, useRef, useState } from 'react'
import * as github from '../api/github'
import { useProfile } from '../context/ProfileContext'

// SRS §2.5.2: public GitHub user or OAuth → pick repos → import.
export default function GitHubImportModal({ profileName, onClose, onImported }) {
  const { activeProfile } = useProfile()
  const [status, setStatus] = useState(null)
  const [repos, setRepos] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function loadStatus() {
    setLoading(true)
    setError('')
    try {
      if (!activeProfile?.github_login) {
        setStatus({ connected: false })
        setRepos([])
        return
      }
      const s = await github.getGitHubStatus()
      setStatus(s)
      if (s.connected) {
        const list = await github.listGitHubRepos()
        setRepos(list)
      } else {
        setRepos([])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, activeProfile?.github_login])

  function toggleRepo(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const allSelected = repos.length > 0 && selected.length === repos.length
  const someSelected = selected.length > 0 && selected.length < repos.length
  const selectAllRef = useRef(null)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([])
    } else {
      setSelected(repos.map((r) => r.id))
    }
  }

  async function handleConnect() {
    setError('')
    try {
      if (github.GITHUB_USE_MOCK) {
        await github.startGitHubLogin()
        await loadStatus()
      } else {
        await github.startGitHubLogin()
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDisconnect() {
    setError('')
    try {
      await github.disconnectGitHub()
      setSelected([])
      setResult(null)
      await loadStatus()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleImport() {
    if (selected.length === 0) {
      setError('請至少選擇 1 個 repository')
      return
    }
    setImporting(true)
    setError('')
    try {
      const r = await github.importGitHubRepos({
        repo_ids: selected,
        default_tag_ids: [],
      })
      setResult(r)
      onImported?.(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  const needsSidebarUser = !activeProfile?.github_login

  return (
    <div className="github-import">
      {loading ? (
        <div className="empty">載入中…</div>
      ) : needsSidebarUser ? (
        <>
          <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
            請先在 sidebar 的「目前使用者」輸入 GitHub username（如 <strong>torvalds</strong>）並加入使用者，再回來匯入 public repositories。
          </p>
        </>
      ) : !status?.connected ? (
        <>
          <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
            {profileName
              ? `正在為「${profileName}」連結 GitHub OAuth 並匯入 repositories。`
              : '連結 GitHub OAuth 後，可選擇 repositories 匯入為專案紀錄。'}
          </p>
          <button className="primary" onClick={handleConnect}>
            OAuth 連結 GitHub
          </button>
        </>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="banner info" style={{ flex: 1, margin: 0 }}>
              {profileName ? `${profileName} · ` : ''}
              已連結 <strong>@{status.login}</strong>
              {status.public_only ? '（公開資料）' : '（OAuth）'}
            </span>
            {!status.public_only && (
              <button className="ghost" onClick={handleDisconnect}>
                中斷 OAuth
              </button>
            )}
          </div>

          {!result && (
            <>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '0 0 12px' }}>
                匯入時會依 GitHub 語言統計（占比 ≥ 1%）自動附加對應標籤；若標籤不存在，會建立於「Languages」下。
              </p>

              <div className="field">
                <label>Public repositories</label>
                {repos.length === 0 ? (
                  <div className="empty">沒有可匯入的 public repository</div>
                ) : (
                  <div className="github-repo-list">
                    <label className="github-repo-select-all">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                      <span>全選（{selected.length}/{repos.length}）</span>
                    </label>
                    {repos.map((repo) => (
                      <label key={repo.id} className="github-repo-item">
                        <input
                          type="checkbox"
                          checked={selected.includes(repo.id)}
                          onChange={() => toggleRepo(repo.id)}
                        />
                        <div>
                          <strong>{repo.full_name}</strong>
                          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                            {repo.description || '（無描述）'}
                          </div>
                          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                            建立 {repo.created_at.slice(0, 10)} · 更新{' '}
                            {repo.updated_at.slice(0, 10)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="actions"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
              >
                <button onClick={onClose}>取消</button>
                <button
                  className="primary"
                  onClick={handleImport}
                  disabled={importing || repos.length === 0}
                >
                  {importing ? '匯入中…' : `匯入 ${selected.length || 0} 個專案`}
                </button>
              </div>
            </>
          )}

          {result && (
            <>
              <div className="banner info">
                已成功匯入 {result.imported} 筆
                {result.skipped > 0
                  ? `，略過 ${result.skipped} 筆（已存在）`
                  : ''}
              </div>
              {result.sync_warning && (
                <div className="err" style={{ marginTop: 8 }}>
                  活動同步：{result.sync_warning}
                </div>
              )}
              {result.skipped_repos?.length > 0 && (
                <ul style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                  {result.skipped_repos.map((r) => (
                    <li key={r.id}>{r.full_name}</li>
                  ))}
                </ul>
              )}
              <div
                className="actions"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
              >
                <button className="primary" onClick={onClose}>
                  完成
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  )
}
