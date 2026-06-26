// src/renderer/src/modals/FirstRunModal.tsx
import { useState, FormEvent } from 'react'
import './FirstRunModal.css'

interface Props { onComplete: (name: string) => Promise<void> }

export function FirstRunModal({ onComplete }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Digite seu nome para começar.'); return }
    setLoading(true)
    try {
      await onComplete(trimmed)
    } catch {
      setLoading(false)
      setError('Erro ao criar perfil. Tente novamente.')
    }
  }

  return (
    <div className="modal-overlay first-run-overlay">
      <div className="modal first-run-modal">
        <h1 className="first-run-title">Bem-vindo ao SoundSmith</h1>
        <p className="first-run-subtitle">Qual é o seu nome, Mestre?</p>
        <form onSubmit={handleSubmit} className="first-run-form">
          <input
            className="input" type="text" placeholder="Seu nome"
            value={name} onChange={e => { setName(e.target.value); setError('') }}
            maxLength={60} autoFocus disabled={loading}
          />
          {error && <p className="first-run-error">{error}</p>}
          <button type="submit" className="btn btn-primary first-run-btn"
            disabled={loading || !name.trim()}>
            {loading ? 'Criando perfil…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
