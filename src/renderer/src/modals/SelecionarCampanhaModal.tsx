// src/renderer/src/modals/SelecionarCampanhaModal.tsx
import { useState, useEffect } from 'react'
import { X, Radio, Music } from 'lucide-react'
import { CampaignWithCount } from '../types/soundsmith'
import './SelecionarCampanhaModal.css'

interface Props {
  onConfirm: (campaignId: number) => void
  onClose: () => void
}

export function SelecionarCampanhaModal({ onConfirm, onClose }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.soundsmith.campaigns.list().then(cs => {
      setCampaigns(cs)
      setLoaded(true)
    })
  }, [])

  const selected = campaigns.find(c => c.id === selectedId)

  return (
    <div className="modal-backdrop">
      <div className="modal selecionar-campanha-modal">
        <div className="modal-header">
          <div>
            <div className="modal-badge">NOVA SALA</div>
            <h2 className="modal-title">Escolha a Campanha</h2>
            <p className="modal-subtitle">
              Os jogadores baixarão as faixas desta campanha ao entrar na sala.
            </p>
          </div>
          <button className="btn btn-ghost modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {loaded && campaigns.length === 0 ? (
          <div className="sc-empty">
            <Music size={24} className="sc-empty-icon" />
            <p>Nenhuma campanha criada ainda.</p>
            <span>Crie uma campanha na Biblioteca antes de abrir a sala.</span>
          </div>
        ) : (
          <div className="sc-list" role="listbox" aria-label="Campanhas">
            {campaigns.map(c => {
              const semFaixas = c.track_count === 0
              return (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={selectedId === c.id}
                  className={`sc-item${selectedId === c.id ? ' sc-item--selected' : ''}`}
                  disabled={semFaixas}
                  onClick={() => setSelectedId(c.id)}
                  style={{ '--c-base': c.color_base, '--c-glow': c.color_glow } as React.CSSProperties}
                >
                  <div className="sc-cover">
                    <span className="sc-initials">{c.initials}</span>
                  </div>
                  <div className="sc-info">
                    <span className="sc-name">{c.name}</span>
                    <span className="sc-count">
                      {semFaixas
                        ? 'Sem faixas — adicione músicas primeiro'
                        : `${c.track_count} faixa${c.track_count !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <span className="sc-radio" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.id)}
          >
            <Radio size={14} /> Criar Sala
          </button>
        </div>
      </div>
    </div>
  )
}
