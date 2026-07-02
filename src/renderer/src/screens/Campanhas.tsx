// src/renderer/src/screens/Campanhas.tsx
import { useState, useEffect } from 'react'
import { Plus, Music, Clock, Pencil, Trash2, Library } from 'lucide-react'
import { CampaignWithCount } from '../types/soundsmith'
import { CampanhaModal } from '../modals/CampanhaModal'
import './Campanhas.css'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours} hora${hours > 1 ? 's' : ''}`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'há 1 semana'
  return `há ${weeks} semanas`
}

export function Campanhas() {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    window.soundsmith.campaigns.list().then((cs) => {
      setCampaigns(cs)
      setLoading(false)
    })
  }, [])

  async function handleDelete(id: number) {
    await window.soundsmith.campaigns.delete(id)
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirmId(null)
  }

  function openCreate() {
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(id: number) {
    setEditId(id)
    setModalOpen(true)
  }

  function handleModalClose(refreshed?: CampaignWithCount[]) {
    setModalOpen(false)
    setEditId(null)
    if (refreshed) setCampaigns(refreshed)
  }

  return (
    <div className="campanhas-screen">
      <div className="campanhas-header">
        <div>
          <div className="campanhas-label">Biblioteca</div>
          <h1 className="campanhas-title">Campanhas</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="campanhas-empty">Carregando…</div>
      ) : campaigns.length === 0 ? (
        <div className="campanhas-empty">
          <Library size={28} className="campanhas-empty-icon" />
          <span>Nenhuma campanha ainda.</span>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={openCreate}>
            <Plus size={16} /> Criar primeira campanha
          </button>
        </div>
      ) : (
        <div className="campanhas-grid">
          {campaigns.map((c) => (
            <div key={c.id} className="campaign-card">
              <div
                className="campaign-cover"
                style={
                  {
                    '--color-glow': c.color_glow,
                    '--color-base': c.color_base,
                  } as React.CSSProperties
                }
              >
                <span className="campaign-initials">{c.initials}</span>
                <div className="campaign-card-actions">
                  <button
                    className="card-action-btn"
                    onClick={() => openEdit(c.id)}
                    title="Editar campanha"
                  >
                    <Pencil size={13} />
                  </button>
                  {deleteConfirmId === c.id ? (
                    <div className="delete-confirm">
                      <button
                        className="card-action-btn card-action-btn--danger"
                        onClick={() => handleDelete(c.id)}
                        title="Confirmar exclusão"
                      >
                        ✓
                      </button>
                      <button
                        className="card-action-btn"
                        onClick={() => setDeleteConfirmId(null)}
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="card-action-btn card-action-btn--danger"
                      onClick={() => setDeleteConfirmId(c.id)}
                      title="Excluir campanha"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="campaign-info">
                <div className="campaign-name">{c.name}</div>
                <div className="campaign-meta">
                  <span>
                    <Music size={12} />
                    {c.track_count} {c.track_count === 1 ? 'faixa' : 'faixas'}
                  </span>
                  <span>
                    <Clock size={12} />
                    {relativeTime(c.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button className="campaign-card campaign-card--new" onClick={openCreate}>
            <div className="campaign-new-inner">
              <Plus size={26} />
              <span>Criar Nova Campanha</span>
            </div>
          </button>
        </div>
      )}

      {modalOpen && <CampanhaModal editId={editId} onClose={handleModalClose} />}
    </div>
  )
}
