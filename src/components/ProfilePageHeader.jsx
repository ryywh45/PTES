function ProfileAvatar({ profile, size = 24 }) {
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

export default function ProfilePageHeader({ profile, hint }) {
  if (!profile) return null

  const subtitle = profile.github_login
    ? `@${profile.github_login}`
    : '本機示範'

  return (
    <div className="profile-page-badge">
      <ProfileAvatar profile={profile} size={24} />
      <span className="profile-page-name">{profile.display_name}</span>
      <span className="profile-page-meta">{subtitle}</span>
      {hint && <span className="profile-page-hint">{hint}</span>}
    </div>
  )
}
