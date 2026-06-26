// src/renderer/src/screens/Sala.tsx
import { Profile } from '../types/soundsmith'

interface Props { profile: Profile }

export function Sala({ profile }: Props) {
  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 8 }}>
        Bom jogo, Mestre {profile.name}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Sala e Player em breve (SDD 03/04).
      </p>
    </div>
  )
}
