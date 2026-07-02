// src/renderer/src/App.tsx
import { useState } from 'react'
import { NavRail, Screen } from './components/NavRail'
import { Sala } from './screens/Sala'
import { Player } from './screens/Player'
import { Campanhas } from './screens/Campanhas'
import { Estudio } from './screens/Estudio'
import { Configuracoes } from './screens/Configuracoes'
import { FirstRunModal } from './modals/FirstRunModal'
import { EntrarNaSalaModal } from './modals/EntrarNaSalaModal'
import { useProfileStore } from './store/profile-store'
import './App.css'

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('Sala')
  const [showEntrarModal, setShowEntrarModal] = useState(false)
  const { profile, createProfile, updateProfile } = useProfileStore()

  if (profile === undefined) return <div className="app-shell" />

  if (profile === null) {
    return (
      <div className="app-shell">
        <FirstRunModal onComplete={async (n) => { await createProfile(n) }} />
      </div>
    )
  }

  const screens: Record<Screen, React.ReactNode> = {
    Sala: <Sala profile={profile} onEntrarNaSala={() => setShowEntrarModal(true)} />,
    Player: <Player onNavigateToCampanhas={() => setActiveScreen('Campanhas')} />,
    Campanhas: <Campanhas />,
    Estudio: <Estudio />,
    Configuracoes: <Configuracoes profile={profile} onUpdateProfile={updateProfile} />
  }

  return (
    <div className="app-shell">
      <main className="app-content">{screens[activeScreen]}</main>
      <NavRail active={activeScreen} onNavigate={setActiveScreen} profile={profile} />
      {showEntrarModal && <EntrarNaSalaModal onClose={() => setShowEntrarModal(false)} />}
    </div>
  )
}
