// src/renderer/src/modals/CampanhaModal.tsx
import { useState, useEffect, useCallback } from 'react'
import { X, Upload, Music, GripVertical } from 'lucide-react'
import { CampaignWithCount, Track, AudioFileInfo } from '../types/soundsmith'
import './CampanhaModal.css'

const SUPPORTED_EXTS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'])
const SUPPORTED_FORMATS = 'MP3 · WAV · FLAC · OGG · M4A'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface StagedFile {
  key: string
  path: string
  name: string
  size: number
}

interface Props {
  editId: number | null
  onClose: (refreshed?: CampaignWithCount[]) => void
}

export function CampanhaModal({ editId, onClose }: Props) {
  const isEdit = editId !== null

  const [name, setName] = useState('')
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [existingTracks, setExistingTracks] = useState<Track[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [rejected, setRejected] = useState<string[]>([])

  // Track management in edit mode
  const [dragTrackId, setDragTrackId] = useState<number | null>(null)
  const [dragOverTrackId, setDragOverTrackId] = useState<number | null>(null)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [removeConfirmId, setRemoveConfirmId] = useState<number | null>(null)

  useEffect(() => {
    if (isEdit && editId) {
      window.soundsmith.campaigns.list().then((cs) => {
        const c = cs.find((x) => x.id === editId)
        if (c) setName(c.name)
      })
      window.soundsmith.campaigns.getTracks(editId).then(setExistingTracks)
    }

    window.soundsmith.campaigns.onImportProgress((p) => {
      setProgress({ current: p.current, total: p.total })
    })

    return () => {
      window.soundsmith.campaigns.offImportProgress()
    }
  }, [editId, isEdit])

  const addFileInfos = useCallback(
    (infos: AudioFileInfo[]) => {
      const accepted: StagedFile[] = []
      const rej: string[] = []

      for (const info of infos) {
        const dot = info.name.lastIndexOf('.')
        const ext = dot >= 0 ? info.name.slice(dot).toLowerCase() : ''
        if (!SUPPORTED_EXTS.has(ext)) {
          rej.push(info.name)
        } else if (info.path && !staged.some((s) => s.path === info.path)) {
          accepted.push({ key: info.path, path: info.path, name: info.name, size: info.size })
        }
      }

      if (accepted.length) setStaged((prev) => [...prev, ...accepted])
      setRejected(rej)
    },
    [staged]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const infos: AudioFileInfo[] = Array.from(e.dataTransfer.files)
      .map((f) => ({
        // Electron exposes .path on File objects in the renderer
        path: (f as File & { path?: string }).path ?? '',
        name: f.name,
        size: f.size,
      }))
      .filter((f) => f.path)
    addFileInfos(infos)
  }

  async function handleBrowse() {
    const infos = await window.soundsmith.campaigns.openFilesDialog()
    if (infos.length) addFileInfos(infos)
  }

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    setProgress(null)

    const campaignName = name.trim() || 'Nova Campanha'
    const filePaths = staged.map((s) => s.path)

    if (isEdit && editId) {
      await window.soundsmith.campaigns.update(editId, campaignName)
      if (filePaths.length > 0) {
        await window.soundsmith.campaigns.addTracks(editId, filePaths)
      }
    } else {
      await window.soundsmith.campaigns.create(campaignName, filePaths)
    }

    const refreshed = await window.soundsmith.campaigns.list()
    onClose(refreshed)
  }

  // Track drag-to-reorder
  function handleTrackDragStart(id: number) {
    setDragTrackId(id)
  }

  function handleTrackDragOver(e: React.DragEvent, id: number) {
    e.preventDefault()
    if (dragTrackId !== null && dragTrackId !== id) setDragOverTrackId(id)
  }

  function handleTrackDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault()
    if (dragTrackId === null || dragTrackId === targetId) return
    const reordered = [...existingTracks]
    const from = reordered.findIndex((t) => t.id === dragTrackId)
    const to = reordered.findIndex((t) => t.id === targetId)
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setExistingTracks(reordered)
    setDragTrackId(null)
    setDragOverTrackId(null)
    window.soundsmith.campaigns.reorderTracks(
      editId!,
      reordered.map((t) => t.id)
    )
  }

  async function handleRemoveTrack(trackId: number) {
    await window.soundsmith.campaigns.removeTrack(trackId)
    setExistingTracks((prev) => prev.filter((t) => t.id !== trackId))
    setRemoveConfirmId(null)
  }

  async function handleRenameTrack(trackId: number) {
    const title = renameValue.trim()
    if (!title) return
    const updated = await window.soundsmith.campaigns.renameTrack(trackId, title)
    setExistingTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: updated.title } : t)))
    setRenameId(null)
    setRenameValue('')
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div className="modal campanha-modal">
        {/* Header */}
        <div className="cm-header">
          <h2 className="cm-title">{isEdit ? 'Editar Campanha' : 'Nova Campanha'}</h2>
          <button
            className="cm-close"
            onClick={() => !loading && onClose()}
            disabled={loading}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cm-body">
          {/* Name input */}
          <div className="cm-field">
            <label className="label">Nome da Campanha</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: As Ruínas de Eldoria"
              maxLength={80}
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Existing tracks (edit mode) */}
          {isEdit && existingTracks.length > 0 && (
            <div className="cm-field">
              <label className="label">
                Faixas da Campanha ({existingTracks.length})
              </label>
              <div className="track-list">
                {existingTracks.map((t) => (
                  <div
                    key={t.id}
                    className={`track-item${dragOverTrackId === t.id ? ' track-item--drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleTrackDragStart(t.id)}
                    onDragOver={(e) => handleTrackDragOver(e, t.id)}
                    onDrop={(e) => handleTrackDrop(e, t.id)}
                    onDragEnd={() => {
                      setDragTrackId(null)
                      setDragOverTrackId(null)
                    }}
                  >
                    <GripVertical size={13} className="track-grip" />
                    <Music size={13} className="track-icon" />

                    {renameId === t.id ? (
                      <div className="track-rename-row">
                        <input
                          className="input track-rename-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTrack(t.id)
                            if (e.key === 'Escape') {
                              setRenameId(null)
                              setRenameValue('')
                            }
                          }}
                          autoFocus
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleRenameTrack(t.id)}
                        >
                          OK
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setRenameId(null)
                            setRenameValue('')
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className="track-name"
                          onDoubleClick={() => {
                            setRenameId(t.id)
                            setRenameValue(t.title)
                          }}
                          title={t.title}
                        >
                          {t.title}
                        </span>
                        <div className="track-actions">
                          <button
                            className="track-btn"
                            onClick={() => {
                              setRenameId(t.id)
                              setRenameValue(t.title)
                            }}
                            title="Renomear"
                          >
                            ✎
                          </button>
                          {removeConfirmId === t.id ? (
                            <>
                              <button
                                className="track-btn track-btn--danger"
                                onClick={() => handleRemoveTrack(t.id)}
                                title="Confirmar remoção"
                              >
                                ✓
                              </button>
                              <button
                                className="track-btn"
                                onClick={() => setRemoveConfirmId(null)}
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              className="track-btn track-btn--danger"
                              onClick={() => setRemoveConfirmId(t.id)}
                              title="Remover faixa"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`upload-zone${dragOver ? ' upload-zone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleBrowse}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
          >
            <Upload size={22} className="upload-icon" />
            <span className="upload-text">Arraste arquivos aqui</span>
            <span className="upload-sub">ou clique para procurar</span>
            <span className="upload-formats">{SUPPORTED_FORMATS}</span>
          </div>

          {rejected.length > 0 && (
            <div className="cm-warning">
              {rejected.length} arquivo(s) ignorado(s) — formato não suportado
            </div>
          )}

          {/* Staged files */}
          {staged.length > 0 && (
            <div className="cm-field" style={{ marginTop: 10 }}>
              <div className="staged-header">
                <label className="label" style={{ marginBottom: 0 }}>
                  {staged.length} {staged.length === 1 ? 'arquivo' : 'arquivos'} para importar
                </label>
              </div>
              <div className="staged-list">
                {staged.map((f) => (
                  <div key={f.key} className="staged-item">
                    <Music size={13} className="track-icon" />
                    <span className="staged-name">{f.name}</span>
                    {f.size > 0 && <span className="staged-size">{formatBytes(f.size)}</span>}
                    <button
                      className="staged-remove"
                      onClick={() => setStaged((prev) => prev.filter((s) => s.key !== f.key))}
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import progress */}
          {progress && (
            <div className="import-progress">
              <span>
                Importando {progress.current}/{progress.total}…
              </span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cm-footer">
          <button className="btn btn-secondary" onClick={() => onClose()} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading
              ? 'Importando…'
              : isEdit
                ? 'Salvar'
                : staged.length > 0
                  ? 'Criar Campanha'
                  : 'Criar Campanha'}
          </button>
        </div>
      </div>
    </div>
  )
}
