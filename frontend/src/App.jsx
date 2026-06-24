import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Tags from './pages/Tags'
import Reports from './pages/Reports'
import ProfileSwitcher from './components/ProfileSwitcher'
import ProfileGate from './components/ProfileGate'
import { useProfileScope } from './hooks/useProfileScope'

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h1>PTES</h1>
          <div className="sub">個人技術棧演進圖譜</div>
        </div>
        <nav>
          <NavItem to="/dashboard" icon="▦" label="儀表板" />
          <NavItem to="/projects" icon="▤" label="專案管理" />
          <NavItem to="/tags" icon="❖" label="標籤管理" />
          <NavItem to="/reports" icon="✎" label="技術總結" />
        </nav>
        <ProfileSwitcher />
      </aside>
      <main className="main">
        <ProfileGate>
          <ProfileRoutes />
        </ProfileGate>
      </main>
    </div>
  )
}

function ProfileRoutes() {
  const { activeProfileId } = useProfileScope()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={<Dashboard key={activeProfileId} />}
      />
      <Route path="/projects" element={<Projects key={activeProfileId} />} />
      <Route path="/tags" element={<Tags key={activeProfileId} />} />
      <Route path="/reports" element={<Reports key={activeProfileId} />} />
    </Routes>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
    >
      <span className="icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
