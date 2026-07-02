// src/renderer/src/screens/Sala.tsx
import { useState, useEffect } from 'react'
import { Copy, Check, Wifi, Radio, LogIn, X, Clock, Users } from 'lucide-react'
import { MasterAvatar } from '../components/MasterAvatar'
import { Profile, CampaignWithCount, RoomStateInfo, RoomPlayerInfo } from '../types/soundsmith'
import { useSettingsStore } from '../store/settings-store'
import { getAudioEngine } from '../audio/AudioEngine'
import './Sala.css'

interface Props {
  profile: Profile
  onEntrarNaSala: () => void
}

function statusLabel(s: RoomPlayerInfo['status']) {
  if (s === 'synced') return 'Sincronizado'
  if (s === 'syncing') return 'Sincronizando…'
  return 'Conectando…'
}

function statusClass(s: RoomPlayerInfo['status']) {
  if (s === 'synced') return 'synced'
  if (s === 'syncing') return 'syncing'
  return 'connecting'
}

export function Sala({ profile, onEntrarNaSala }: Props) {
  const { settings } = useSettingsStore()
  const [roomState, setRoomState] = useState<RoomStateInfo>({ active: false, code: '', port: 0, players: [] })
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    window.soundsmith.room.getState().then(setRoomState)
    window.soundsmith.campaigns.list().then(cs => setCampaigns(cs.slice(0, 3)))
    window.soundsmith.room.onStateChanged(s => setRoomState(s as RoomStateInfo))
    return () => { window.soundsmith.room.offStateChanged() }
  }, [])

  // Forja acesa (FORJ-RF-02): "AO VIVO" acende em brasa só quando há som tocando
  useEffect(() => {
    const id = setInterval(() => setPlaying(getAudioEngine().getState().playing), 300)
    return () => clearInterval(id)
  }, [])

  async function handleCreateRoom() {
    setError('')
    // Need an active campaign — read from player settings
    const campaignIdStr = await window.soundsmith.settings.get('player_campaign_id')
    if (!campaignIdStr) {
      setError('Abra o Player, selecione uma campanha e volte para criar a sala.')
      return
    }
    const campaignId = parseInt(campaignIdStr)
    const port = parseInt(settings['host_port'] ?? '7842')
    const syncBufferMs = parseInt(settings['sync_buffer_ms'] ?? '120')
    setLoading(true)
    try {
      const state = await window.soundsmith.room.create(campaignId, port, syncBufferMs)
      setRoomState(state)
    } catch (e) {
      setError(String((e as Error)?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  async function handleCloseRoom() {
    const state = await window.soundsmith.room.close()
    setRoomState(state)
  }

  async function handleCopy() {
    await window.soundsmith.room.copyInfo()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const vpnIp = settings['vpn_ip'] ?? '—'
  const playerCount = roomState.players.length

  return (
    <div className="sala-screen">
      {/* Greeting */}
      <div className="sala-header">
        <div className="sala-greeting">
          <MasterAvatar profile={profile} size={48} />
          <div>
            <p className="sala-welcome-label">BOM JOGO, MESTRE</p>
            <h1 className="sala-name">{profile.name}</h1>
          </div>
        </div>
      </div>

      <div className="sala-body">
        {/* Hero card */}
        <div className={`hero-card${roomState.active ? ' hero-card--live' : ''}`}>
          <div className="hero-left">
            <div className="hero-badge">
              <Radio size={12} />
              Sessão Multiplayer
            </div>

            {roomState.active ? (
              <>
                <div className={`live-badge${playing ? ' live-badge--hot' : ''}`}>
                  <span className={`live-dot${playing ? ' live-dot--hot' : ''}`} /> AO VIVO
                </div>
                <div className="session-tiles">
                  <div className="session-tile">
                    <span className="session-tile-label">CÓDIGO</span>
                    <span className="session-tile-value mono">{roomState.code}</span>
                  </div>
                  <div className="session-tile">
                    <span className="session-tile-label">IP DA VPN</span>
                    <span className="session-tile-value mono">{vpnIp}</span>
                  </div>
                  <div className="session-tile">
                    <span className="session-tile-label">JOGADORES</span>
                    <span className="session-tile-value mono">{playerCount} / 6</span>
                  </div>
                  <div className="session-tile">
                    <span className="session-tile-label">PORTA</span>
                    <span className="session-tile-value mono">{roomState.port}</span>
                  </div>
                </div>
                <div className="hero-actions">
                  <button className="btn btn-ghost" onClick={handleCopy}>
                    {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar Info</>}
                  </button>
                  <button className="btn btn-danger" onClick={handleCloseRoom}>
                    <X size={14} /> Encerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="hero-title">Criar Nova Sala</h2>
                <p className="hero-desc">Hospede uma sessão e compartilhe com seus jogadores.</p>
                {error && <p className="hero-error">{error}</p>}
                <div className="hero-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateRoom}
                    disabled={loading}
                  >
                    {loading ? 'Criando…' : <><Radio size={14} /> Criar Sala</>}
                  </button>
                  <button className="btn btn-ghost" onClick={onEntrarNaSala}>
                    <LogIn size={14} /> Entrar em Sala
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="hero-right">
            <Wifi size={64} className="hero-illustration" />
          </div>
        </div>

        <div className="sala-columns">
          {/* Campanhas recentes */}
          <div className="sala-section">
            <div className="sala-section-header">
              <span className="sala-section-title">CAMPANHAS RECENTES</span>
            </div>
            {campaigns.length === 0 ? (
              <p className="sala-empty">Nenhuma campanha criada ainda.</p>
            ) : (
              <div className="recent-campaigns">
                {campaigns.map(c => (
                  <div
                    key={c.id}
                    className="recent-campaign"
                    style={{ '--c-base': c.color_base, '--c-glow': c.color_glow } as React.CSSProperties}
                  >
                    <div className="rc-cover">
                      <span className="rc-initials">{c.initials}</span>
                    </div>
                    <div className="rc-info">
                      <span className="rc-name">{c.name}</span>
                      <span className="rc-count">{c.track_count} faixa{c.track_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jogadores conectados */}
          <div className="sala-section">
            <div className="sala-section-header">
              <span className="sala-section-title">JOGADORES CONECTADOS</span>
              {roomState.active && (
                <span className="sala-player-count">{playerCount} / 6</span>
              )}
            </div>

            {!roomState.active ? (
              <p className="sala-empty">Nenhuma sala ativa.</p>
            ) : roomState.players.length === 0 ? (
              <div className="sala-empty-state">
                <Users size={24} className="sala-empty-icon" />
                <p className="sala-empty-text">Compartilhe o código da sala para os jogadores entrarem.</p>
                <span className="sala-empty-code">{roomState.code}</span>
              </div>
            ) : (
              <div className="player-list">
                {roomState.players.map(p => (
                  <div key={p.id} className={`player-row player-row--${statusClass(p.status)}`}>
                    <div
                      className="player-avatar"
                      style={{ background: p.avatarColor }}
                    >
                      {p.initials}
                    </div>
                    <div className="player-info">
                      <span className="player-name">{p.name}</span>
                      <span className={`player-status player-status--${statusClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="player-latency">
                      {p.latencyMs !== null ? (
                        <span className="latency-value">
                          <Clock size={11} /> {p.latencyMs} ms
                        </span>
                      ) : (
                        <span className="latency-unknown">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
