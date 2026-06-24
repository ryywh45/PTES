import { useProfileScope } from '../hooks/useProfileScope'

export default function ProfileGate({ children }) {
  const { loading, ready } = useProfileScope()

  if (loading) {
    return <div className="empty profile-gate">載入使用者…</div>
  }

  if (!ready) {
    return (
      <div className="empty profile-gate">
        請在左側 sidebar 加入或選擇使用者
      </div>
    )
  }

  return children
}
