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
    }
  }
}
