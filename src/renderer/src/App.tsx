// src/renderer/src/App.tsx
import { useState } from 'react'
import { NavRail, Screen } from './components/NavRail'
import { Sala } from './screens/Sala'
import { Player } from './screens/Player'
import { Campanhas } from './screens/Campanhas'
import { Estudio } from './screens/Estudio'
import { Configuracoes } from './screens/Configuracoes'
import './App.css'

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('Sala')

  const screens: Record<Screen, React.ReactNode> = {
    Sala: <Sala />,
    Player: <Player />,
    Campanhas: <Campanhas />,
    Estudio: <Estudio />,
    Configuracoes: <Configuracoes />
  }

  return (
    <div className="app-shell">
      <main className="app-content">{screens[activeScreen]}</main>
      <NavRail active={activeScreen} onNavigate={setActiveScreen} />
    </div>
  )
}
