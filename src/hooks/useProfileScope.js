import { useMemo } from 'react'
import { useProfile } from '../context/ProfileContext'

export function useProfileScope() {
  const {
    activeProfileId,
    activeProfile,
    loading,
    switchProfile,
    refreshProfiles,
    connectGitHub,
    addProfileFromGitHub,
    profiles,
  } = useProfile()

  const ready = !loading && !!activeProfileId

  return useMemo(
    () => ({
      ready,
      loading,
      activeProfileId,
      activeProfile,
      switchProfile,
      refreshProfiles,
      connectGitHub,
      addProfileFromGitHub,
      profiles,
    }),
    [
      ready,
      loading,
      activeProfileId,
      activeProfile,
      switchProfile,
      refreshProfiles,
      connectGitHub,
      addProfileFromGitHub,
      profiles,
    ],
  )
}
