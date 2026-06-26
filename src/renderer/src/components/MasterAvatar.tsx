// src/renderer/src/components/MasterAvatar.tsx
import { Profile } from '../types/soundsmith'
import './MasterAvatar.css'

interface Props { profile: Profile; size?: number }

export function MasterAvatar({ profile, size = 38 }: Props) {
  return (
    <div className="master-avatar" style={{ background: profile.avatar_color, width: size, height: size }} title={profile.name}>
      <span className="master-avatar-initials" style={{ fontSize: size * 0.34 }}>
        {profile.initials}
      </span>
    </div>
  )
}
