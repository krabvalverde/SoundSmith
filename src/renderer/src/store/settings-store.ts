// src/renderer/src/store/settings-store.ts
import { useState, useEffect, useCallback } from 'react'

const DEFAULTS: Record<string, string> = {
  accent_color: '#8b5cf6',
  crossfade_loops: 'false',
  host_port: '7842',
  sync_buffer_ms: '120',
  vpn_provider: ''
}

function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `${r}, ${g}, ${b}`
}

function applyAccent(hex: string) {
  const el = document.documentElement
  const rgb = hexToRgbStr(hex)
  el.style.setProperty('--color-accent', hex)
  el.style.setProperty('--color-accent-alpha-10', `rgba(${rgb}, 0.10)`)
  el.style.setProperty('--color-accent-alpha-20', `rgba(${rgb}, 0.20)`)
  el.style.setProperty('--color-accent-alpha-30', `rgba(${rgb}, 0.30)`)
}

export function useSettingsStore() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.soundsmith.settings.getAll().then(all => {
      const merged = { ...DEFAULTS, ...all }
      setSettings(merged)
      applyAccent(merged['accent_color'])
      setLoaded(true)
    })
  }, [])

  const setSetting = useCallback(async (key: string, value: string) => {
    await window.soundsmith.settings.set(key, value)
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'accent_color') applyAccent(value)
  }, [])

  return { settings, setSetting, loaded }
}
