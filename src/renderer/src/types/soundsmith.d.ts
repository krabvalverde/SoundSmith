// src/renderer/src/types/soundsmith.d.ts
export interface Profile {
  id: 1
  name: string
  initials: string
  avatar_color: string
  created_at: string
  updated_at: string
}

export interface LibraryPath {
  id: number
  path: string
  added_at: string
}

export interface NetworkInterface {
  name: string
  address: string
}

export interface Campaign {
  id: number
  name: string
  initials: string
  color_base: string
  color_glow: string
  created_at: string
  updated_at: string
}

export interface CampaignWithCount extends Campaign {
  track_count: number
}

export interface Track {
  id: number
  campaign_id: number
  title: string
  file_path: string
  original_filename: string
  format: string
  duration_ms: number | null
  file_size_bytes: number | null
  sample_rate: number | null
  channels: number | null
  order_index: number
  import_status: 'pending' | 'ready' | 'error'
  created_at: string
  updated_at: string
}

export interface ImportProgress {
  trackId: number
  current: number
  total: number
  status: 'ready' | 'error'
  filename: string
}

export interface AudioFileInfo {
  path: string
  name: string
  size: number
}

export interface Loop {
  id: number
  track_id: number
  name: string
  color: string
  start_ms: number
  end_ms: number
  fade_in_ms: number
  fade_out_ms: number
  notes: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface LoopInput {
  name: string
  color: string
  start_ms: number
  end_ms: number
  fade_in_ms: number
  fade_out_ms: number
  notes: string | null
  order_index: number
  created_at?: string
}

export type PlayerStatus = 'connecting' | 'syncing' | 'synced'

export interface RoomPlayerInfo {
  id: string
  name: string
  avatarColor: string
  initials: string
  status: PlayerStatus
  latencyMs: number | null
}

export interface RoomStateInfo {
  active: boolean
  code: string
  port: number
  players: RoomPlayerInfo[]
}

export interface LoopManifestEntry {
  id: number
  name: string
  color: string
  startMs: number
  endMs: number
  fadeInMs: number
  fadeOutMs: number
  orderIndex: number
}

export interface TrackManifestEntry {
  id: number
  title: string
  originalFilename: string
  format: string
  durationMs: number | null
  loops: LoopManifestEntry[]
}

export interface CampaignManifest {
  id: number
  name: string
  initials: string
  colorBase: string
  colorGlow: string
  tracks: TrackManifestEntry[]
}

export interface RoomPlaybackState {
  trackId: number | null
  playing: boolean
  positionMs: number
  updatedAt: number
  loopMode: 'none' | 'full' | { startMs: number; endMs: number; fadeInMs: number; fadeOutMs: number } | null
}

declare global {
  interface Window {
    soundsmith: {
      profile: {
        get(): Promise<Profile | null>
        create(name: string): Promise<Profile>
        update(name: string): Promise<Profile>
      }
      settings: {
        get(key: string): Promise<string | null>
        set(key: string, value: string): Promise<void>
        getAll(): Promise<Record<string, string>>
      }
      libraryPaths: {
        list(): Promise<LibraryPath[]>
        add(path: string): Promise<LibraryPath>
        remove(id: number): Promise<void>
        countAudioFiles(path: string): Promise<number>
      }
      system: {
        getNetworkInterfaces(): Promise<NetworkInterface[]>
        openDirectoryDialog(): Promise<string | null>
        getAppVersion(): Promise<string>
      }
      loops: {
        getByTrack(trackId: number): Promise<Loop[]>
        saveAll(trackId: number, loopsData: LoopInput[]): Promise<Loop[]>
      }
      tracks: {
        rename(trackId: number, title: string): Promise<void>
        getWaveformPeaks(trackId: number): Promise<number[] | null>
        saveWaveformPeaks(trackId: number, peaks: number[]): Promise<void>
        updateDuration(trackId: number, durationMs: number): Promise<void>
      }
      room: {
        create(campaignId: number, port: number, syncBufferMs: number): Promise<RoomStateInfo>
        close(): Promise<RoomStateInfo>
        getState(): Promise<RoomStateInfo>
        broadcastCmd(cmd: Record<string, unknown>): Promise<void>
        updatePlayback(state: RoomPlaybackState): Promise<void>
        copyInfo(): Promise<void>
        onStateChanged(cb: (state: RoomStateInfo) => void): void
        offStateChanged(): void
      }
      campaigns: {
        list(): Promise<CampaignWithCount[]>
        create(
          name: string,
          filePaths: string[]
        ): Promise<{ campaign: CampaignWithCount; tracks: Track[] }>
        update(id: number, name: string): Promise<Campaign>
        delete(id: number): Promise<void>
        getTracks(campaignId: number): Promise<Track[]>
        addTracks(campaignId: number, filePaths: string[]): Promise<Track[]>
        removeTrack(trackId: number): Promise<void>
        reorderTracks(campaignId: number, orderedTrackIds: number[]): Promise<void>
        renameTrack(trackId: number, title: string): Promise<Track>
        openFilesDialog(): Promise<AudioFileInfo[]>
        onImportProgress(cb: (p: ImportProgress) => void): void
        offImportProgress(): void
      }
    }
  }
}
