// src/renderer/src/screens/Configuracoes.tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2, FolderOpen } from 'lucide-react'
import { Profile } from '../types/soundsmith'
import { useSettingsStore } from '../store/settings-store'
import './Configuracoes.css'

const ACCENT_OPTIONS = [
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Âmbar' },
  { value: '#ec4899', label: 'Rosa' }
]

interface Props {
  profile: Profile
  onUpdateProfile: (name: string) => Promise<Profile>
}

interface LibraryPathEntry { id: number; path: string; file_count: number }

export function Configuracoes({ profile, onUpdateProfile }: Props) {
  const { settings, setSetting, loaded } = useSettingsStore()
  const [editName, setEditName] = useState(profile.name)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [sampleRate, setSampleRate] = useState<number | null>(null)
  const [netIfaces, setNetIfaces] = useState<{ name: string; address: string }[]>([])
  const [libPaths, setLibPaths] = useState<LibraryPathEntry[]>([])
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    setEditName(profile.name)
  }, [profile.name])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(ds => setAudioDevices(ds.filter(d => d.kind === 'audiooutput')))

    const ctx = new AudioContext()
    setSampleRate(ctx.sampleRate)
    ctx.close()

    window.soundsmith.system.getNetworkInterfaces().then(setNetIfaces)
    window.soundsmith.system.getAppVersion().then(setAppVersion)

    window.soundsmith.libraryPaths.list().then(async paths => {
      const results = await Promise.allSettled(
        paths.map(async p => ({
          id: p.id, path: p.path,
          file_count: await window.soundsmith.libraryPaths.countAudioFiles(p.path)
        }))
      )
      setLibPaths(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []))
    })
  }, [])

  async function addLibraryPath() {
    const path = await window.soundsmith.system.openDirectoryDialog()
    if (!path) return
    const added = await window.soundsmith.libraryPaths.add(path)
    const count = await window.soundsmith.libraryPaths.countAudioFiles(path)
    setLibPaths(prev => [...prev, { id: added.id, path: added.path, file_count: count }])
  }

  async function removeLibraryPath(id: number) {
    await window.soundsmith.libraryPaths.remove(id)
    setLibPaths(prev => prev.filter(p => p.id !== id))
  }

  if (!loaded) return <div className="config-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><span style={{ color: 'var(--color-text-tertiary)' }}>Carregando…</span></div>

  return (
    <div className="config-screen">
      <h1 className="section-title config-page-title">Configurações</h1>

      {/* Perfil */}
      <section className="config-section">
        <h2 className="config-section-title">Perfil</h2>
        <div className="label">Seu Nome</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <input className="input" value={editName} onChange={e => setEditName(e.target.value)} maxLength={60} style={{ maxWidth: 300 }} />
          <button className="btn btn-secondary"
            disabled={!editName.trim() || editName.trim() === profile.name}
            onClick={async () => { if (editName.trim()) await onUpdateProfile(editName.trim()) }}>
            Salvar
          </button>
        </div>
      </section>

      {/* Áudio */}
      <section className="config-section">
        <h2 className="config-section-title">Áudio</h2>
        <div className="config-row">
          <div className="label">Dispositivo de Saída</div>
          <select className="input config-select"
            value={settings['output_device_id'] ?? ''}
            onChange={e => setSetting('output_device_id', e.target.value)}>
            <option value="">Padrão do sistema</option>
            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
          </select>
        </div>
        <div className="config-row">
          <div className="label">Taxa de Amostragem</div>
          <p className="config-readonly" style={{ fontFamily: 'var(--font-mono)' }}>
            {sampleRate ? `${sampleRate} Hz` : '—'}
          </p>
        </div>
        <div className="config-row config-inline">
          <div>
            <div className="label">Crossfade entre Loops</div>
            <p className="config-desc">Suaviza transições entre loops (SDD 03)</p>
          </div>
          <label className="toggle">
            <input type="checkbox"
              checked={settings['crossfade_loops'] === 'true'}
              onChange={e => setSetting('crossfade_loops', String(e.target.checked))} />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </section>

      {/* Rede */}
      <section className="config-section">
        <h2 className="config-section-title">Rede</h2>
        <div className="config-row">
          <div className="label">Porta do Host</div>
          <input className="input config-input-sm" type="number" min={1024} max={65535}
            value={settings['host_port'] ?? '7842'}
            onChange={e => setSetting('host_port', e.target.value)}
            style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <div className="config-row">
          <div className="label">Buffer de Sync (ms)</div>
          <input className="input config-input-sm" type="number" min={0} max={2000}
            value={settings['sync_buffer_ms'] ?? '120'}
            onChange={e => setSetting('sync_buffer_ms', e.target.value)}
            style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <div className="config-row">
          <div className="label">Modo</div>
          <p className="config-readonly">Local</p>
        </div>
      </section>

      {/* VPN */}
      <section className="config-section">
        <h2 className="config-section-title">VPN</h2>
        <div className="config-row">
          <div className="label">Provedor</div>
          <input className="input" type="text" placeholder="Ex.: ZeroTier, Tailscale…"
            value={settings['vpn_provider'] ?? ''}
            onChange={e => setSetting('vpn_provider', e.target.value)}
            style={{ maxWidth: 300 }} />
        </div>
        <div className="config-row">
          <div className="label">Interface de Rede</div>
          {netIfaces.length === 0
            ? <p className="config-readonly" style={{ color: 'var(--color-text-tertiary)' }}>Nenhuma interface externa detectada</p>
            : <select className="input config-select"
                value={settings['vpn_ip'] ?? ''}
                onChange={e => setSetting('vpn_ip', e.target.value)}>
                <option value="">Selecionar…</option>
                {netIfaces.map(i => <option key={i.address} value={i.address}>{i.name} — {i.address}</option>)}
              </select>
          }
        </div>
      </section>

      {/* Tema */}
      <section className="config-section">
        <h2 className="config-section-title">Tema Visual</h2>
        <div className="label">Cor de Destaque</div>
        <div className="accent-swatches">
          {ACCENT_OPTIONS.map(({ value, label }) => (
            <button key={value}
              className={`accent-swatch${settings['accent_color'] === value ? ' accent-swatch--active' : ''}`}
              style={{ '--sw': value } as React.CSSProperties}
              onClick={() => setSetting('accent_color', value)}
              title={label} aria-label={label} />
          ))}
        </div>
      </section>

      {/* Bibliotecas */}
      <section className="config-section">
        <h2 className="config-section-title">Bibliotecas de Músicas</h2>
        <p className="config-desc" style={{ marginBottom: 12 }}>
          Pastas-fonte para importar áudios. Arquivos são copiados para a biblioteca interna (SDD 01).
        </p>
        <div className="lib-paths">
          {libPaths.map(lp => (
            <div key={lp.id} className="lib-path-item">
              <FolderOpen size={15} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <div className="lib-path-info">
                <span className="lib-path-text">{lp.path}</span>
                <span className="lib-path-count">{lp.file_count} arquivos de áudio</span>
              </div>
              <button className="btn btn-ghost" onClick={() => removeLibraryPath(lp.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={addLibraryPath}>
          <Plus size={16} /> Adicionar Pasta
        </button>
      </section>

      {/* Sobre */}
      <section className="config-section" style={{ borderBottom: 'none' }}>
        <h2 className="config-section-title">Sobre</h2>
        <p className="config-readonly">SoundSmith v{appVersion}</p>
        <button className="btn btn-secondary" style={{ marginTop: 12 }} disabled>
          Verificar Atualizações
        </button>
      </section>
    </div>
  )
}
