// src/renderer/src/store/profile-store.ts
import { useState, useEffect, useCallback } from 'react'
import { Profile } from '../types/soundsmith'

export function useProfileStore() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)

  useEffect(() => {
    window.soundsmith.profile.get().then(p => setProfile(p))
  }, [])

  const createProfile = useCallback(async (name: string) => {
    const p = await window.soundsmith.profile.create(name)
    setProfile(p)
    return p
  }, [])

  const updateProfile = useCallback(async (name: string) => {
    const p = await window.soundsmith.profile.update(name)
    setProfile(p)
    return p
  }, [])

  return { profile, createProfile, updateProfile }
}
