import { useState } from 'react'
import { useProfile } from '../context/ProfileContext'

function ProfileAvatar({ profile, size = 32 }) {
  if (!profile?.avatar_url) {
    return (
      <span
        className="profile-avatar profile-avatar-fallback"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {(profile?.display_name || '?').slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      className="profile-avatar"
      src={profile.avatar_url}
      alt={profile.display_name}
      width={size}
      height={size}
    />
  )
}

export default function ProfileSwitcher() {
  const {
    profiles,
    activeProfileId,
    activeProfile,
    switchProfile,
    connectGitHub,
    addProfileFromGitHub,
  } = useProfile()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  if (!profiles.length) return null

  async function handleAddUser(ev) {
    ev.preventDefault()
    const value = username.trim()
    if (!value) {
      setError('請輸入 GitHub username')
      return
    }
    setAdding(true)
    setError('')
    try {
      await addProfileFromGitHub(value)
      setUsername('')
      setOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="profile-switcher">
      <button
        className="profile-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ProfileAvatar profile={activeProfile} size={36} />
        <span className="profile-trigger-text">
          <span className="profile-label">目前使用者</span>
          <strong>{activeProfile?.display_name || '—'}</strong>
          <span className="profile-meta">
            {activeProfile?.github_login
              ? `@${activeProfile.github_login}`
              : '本機'}
          </span>
        </span>
        <span className="twirl">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="profile-menu">
          {profiles.map((p) => (
            <button
              key={p.id}
              className={`profile-option ${p.id === activeProfileId ? 'active' : ''}`}
              onClick={() => {
                switchProfile(p.id)
                setOpen(false)
              }}
            >
              <ProfileAvatar profile={p} size={28} />
              <span className="profile-option-text">
                <span>{p.display_name}</span>
                <span className="profile-meta">
                  {p.github_login ? `@${p.github_login}` : '本機'}
                </span>
              </span>
            </button>
          ))}

          <form className="profile-add-form" onSubmit={handleAddUser}>
            <input
              type="text"
              placeholder="GitHub username（如 torvalds）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={adding}
            />
            <button type="submit" className="primary" disabled={adding}>
              {adding ? '加入中…' : '加入使用者'}
            </button>
          </form>

          <button
            className="profile-option connect"
            onClick={() => {
              setOpen(false)
              connectGitHub()
            }}
          >
            OAuth 連結自己的帳號
          </button>

          {error && <div className="err profile-menu-error">{error}</div>}
        </div>
      )}
    </div>
  )
}
