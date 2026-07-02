// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('soundsmith', {
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    create: (name: string) => ipcRenderer.invoke('profile:create', name),
    update: (name: string) => ipcRenderer.invoke('profile:update', name),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  libraryPaths: {
    list: () => ipcRenderer.invoke('libraryPaths:list'),
    add: (path: string) => ipcRenderer.invoke('libraryPaths:add', path),
    remove: (id: number) => ipcRenderer.invoke('libraryPaths:remove', id),
    countAudioFiles: (path: string) => ipcRenderer.invoke('libraryPaths:countAudio', path),
  },
  system: {
    getNetworkInterfaces: () => ipcRenderer.invoke('system:getNetworkInterfaces'),
    openDirectoryDialog: () => ipcRenderer.invoke('system:openDirectoryDialog'),
    getAppVersion: () => ipcRenderer.invoke('system:getAppVersion'),
  },
  loops: {
    getByTrack: (trackId: number) => ipcRenderer.invoke('loops:getByTrack', trackId),
    saveAll: (trackId: number, loopsData: unknown[]) =>
      ipcRenderer.invoke('loops:saveAll', trackId, loopsData),
  },
  tracks: {
    rename: (trackId: number, title: string) =>
      ipcRenderer.invoke('tracks:rename', trackId, title),
    getWaveformPeaks: (trackId: number) =>
      ipcRenderer.invoke('tracks:getWaveformPeaks', trackId),
    saveWaveformPeaks: (trackId: number, peaks: number[]) =>
      ipcRenderer.invoke('tracks:saveWaveformPeaks', trackId, peaks),
    updateDuration: (trackId: number, durationMs: number) =>
      ipcRenderer.invoke('tracks:updateDuration', trackId, durationMs),
  },
  room: {
    create: (campaignId: number, port: number, syncBufferMs: number) =>
      ipcRenderer.invoke('room:create', campaignId, port, syncBufferMs),
    close: () => ipcRenderer.invoke('room:close'),
    getState: () => ipcRenderer.invoke('room:getState'),
    broadcastCmd: (cmd: Record<string, unknown>) =>
      ipcRenderer.invoke('room:broadcastCmd', cmd),
    updatePlayback: (state: unknown) => ipcRenderer.invoke('room:updatePlayback', state),
    copyInfo: () => ipcRenderer.invoke('room:copyInfo'),
    onStateChanged: (cb: (state: unknown) => void) => {
      ipcRenderer.on('room:stateChanged', (_e, s) => cb(s))
    },
    offStateChanged: () => ipcRenderer.removeAllListeners('room:stateChanged'),
  },
  campaigns: {
    list: () => ipcRenderer.invoke('campaigns:list'),
    create: (name: string, filePaths: string[]) =>
      ipcRenderer.invoke('campaigns:create', name, filePaths),
    update: (id: number, name: string) => ipcRenderer.invoke('campaigns:update', id, name),
    delete: (id: number) => ipcRenderer.invoke('campaigns:delete', id),
    getTracks: (campaignId: number) => ipcRenderer.invoke('campaigns:getTracks', campaignId),
    addTracks: (campaignId: number, filePaths: string[]) =>
      ipcRenderer.invoke('campaigns:addTracks', campaignId, filePaths),
    removeTrack: (trackId: number) => ipcRenderer.invoke('campaigns:removeTrack', trackId),
    reorderTracks: (campaignId: number, orderedTrackIds: number[]) =>
      ipcRenderer.invoke('campaigns:reorderTracks', campaignId, orderedTrackIds),
    renameTrack: (trackId: number, title: string) =>
      ipcRenderer.invoke('campaigns:renameTrack', trackId, title),
    openFilesDialog: () => ipcRenderer.invoke('campaigns:openAudioFilesDialog'),
    onImportProgress: (
      cb: (p: {
        trackId: number
        current: number
        total: number
        status: string
        filename: string
      }) => void
    ) => {
      ipcRenderer.on('campaigns:import:progress', (_e, p) => cb(p))
    },
    offImportProgress: () => ipcRenderer.removeAllListeners('campaigns:import:progress'),
  },
})
