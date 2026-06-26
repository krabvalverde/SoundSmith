// src/renderer/src/screens/Configuracoes.tsx
import { Profile } from '../types/soundsmith'

interface Props {
  profile: Profile
  onUpdateProfile: (name: string) => Promise<Profile>
}

export function Configuracoes(_props: Props) {
  return <div className="screen-placeholder"><span>Configurações — em breve</span></div>
}
