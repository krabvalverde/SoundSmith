// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('soundsmith', {
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    create: (name: string) => ipcRenderer.invoke('profile:create', name),
    update: (name: string) => ipcRenderer.invoke('profile:update', name)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  libraryPaths: {
    list: () => ipcRenderer.invoke('libraryPaths:list'),
    add: (path: string) => ipcRenderer.invoke('libraryPaths:add', path),
    remove: (id: number) => ipcRenderer.invoke('libraryPaths:remove', id),
    countAudioFiles: (path: string) => ipcRenderer.invoke('libraryPaths:countAudio', path)
  },
  system: {
    getNetworkInterfaces: () => ipcRenderer.invoke('system:getNetworkInterfaces'),
    openDirectoryDialog: () => ipcRenderer.invoke('system:openDirectoryDialog'),
    getAppVersion: () => ipcRenderer.invoke('system:getAppVersion')
  }
})
