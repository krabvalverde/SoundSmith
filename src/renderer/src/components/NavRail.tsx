// src/renderer/src/components/NavRail.tsx
import { House, CirclePlay, Library, Waypoints, Settings } from 'lucide-react'
import './NavRail.css'

export type Screen = 'Sala' | 'Player' | 'Campanhas' | 'Estudio' | 'Configuracoes'

const NAV_ITEMS: { label: Screen; display: string; icon: React.ReactNode }[] = [
  { label: 'Sala',      display: 'Sala',     icon: <House size={20} /> },
  { label: 'Player',    display: 'Player',   icon: <CirclePlay size={20} /> },
  { label: 'Campanhas', display: 'Campanhas',icon: <Library size={20} /> },
  { label: 'Estudio',   display: 'Estúdio',  icon: <Waypoints size={20} /> }
]

interface Props {
  active: Screen
  onNavigate: (s: Screen) => void
}

export function NavRail({ active, onNavigate }: Props) {
  return (
    <nav className="nav-rail" aria-label="Navegação principal">
      <div className="nav-rail-items">
        {NAV_ITEMS.map(({ label, display, icon }) => (
          <button
            key={label}
            className={`nav-item${active === label ? ' nav-item--active' : ''}`}
            onClick={() => onNavigate(label)}
            aria-label={display}
            aria-current={active === label ? 'page' : undefined}
          >
            {icon}
            <span className="nav-item-label">{display}</span>
          </button>
        ))}
      </div>
      <button
        className={`nav-item${active === 'Configuracoes' ? ' nav-item--active' : ''}`}
        onClick={() => onNavigate('Configuracoes')}
        aria-label="Configurações"
      >
        <Settings size={20} />
        <span className="nav-item-label">Config</span>
      </button>
    </nav>
  )
}
