import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as api from '../api/client'
import { setProfileIdGetter } from '../api/profileStore'
import * as github from '../api/github'

const STORAGE_KEY = 'ptes_active_profile_id'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileIdState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(true)

  const refreshProfiles = useCallback(async () => {
    const list = await api.listProfiles()
    setProfiles(list)
    if (!list.length) {
      setActiveProfileIdState(null)
      localStorage.removeItem(STORAGE_KEY)
      setProfileIdGetter(() => null)
      return list
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    const storedId = stored ? Number(stored) : null
    const valid = list.some((p) => p.id === storedId)
    const nextId = valid ? storedId : list[0].id
    setActiveProfileIdState(nextId)
    localStorage.setItem(STORAGE_KEY, String(nextId))
    setProfileIdGetter(() => nextId)
    return list
  }, [])

  useEffect(() => {
    setProfileIdGetter(() => activeProfileId)
  }, [activeProfileId])

  useEffect(() => {
    refreshProfiles()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshProfiles])

  const switchProfile = useCallback((id) => {
    setActiveProfileIdState(id)
    localStorage.setItem(STORAGE_KEY, String(id))
    setProfileIdGetter(() => id)
  }, [])

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || null,
    [profiles, activeProfileId],
  )

  const connectGitHub = useCallback(async () => {
    await github.startGitHubLogin()
  }, [])

  const addProfileFromGitHub = useCallback(
    async (username) => {
      const profile = await api.createProfileFromGitHub(username)
      await refreshProfiles()
      switchProfile(profile.id)
      return profile
    },
    [refreshProfiles, switchProfile],
  )

  const value = useMemo(
    () => ({
      profiles,
      activeProfileId,
      activeProfile,
      loading,
      switchProfile,
      refreshProfiles,
      connectGitHub,
      addProfileFromGitHub,
    }),
    [
      profiles,
      activeProfileId,
      activeProfile,
      loading,
      switchProfile,
      refreshProfiles,
      connectGitHub,
      addProfileFromGitHub,
    ],
  )

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
