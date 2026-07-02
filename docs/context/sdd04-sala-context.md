# SDD 04 — Sala (Multiplayer) — Context

## Status: COMPLETE

## Files created/modified

| File | Action |
|------|--------|
| `src/main/room-server.ts` | NEW — WebSocket + HTTP host server |
| `src/main/ipc-handlers.ts` | MOD — room: IPC handlers |
| `src/preload/index.ts` | MOD — room namespace |
| `src/renderer/src/types/soundsmith.d.ts` | MOD — room types |
| `src/renderer/src/screens/Sala.tsx` | NEW (full rewrite) |
| `src/renderer/src/screens/Sala.css` | NEW |
| `src/renderer/src/modals/EntrarNaSalaModal.tsx` | NEW |
| `src/renderer/src/modals/EntrarNaSalaModal.css` | NEW |
| `src/renderer/src/screens/Player.tsx` | MOD — room broadcasting |
| `src/renderer/src/App.tsx` | MOD — modal wiring |

## Architecture

### Host (GM) side
- `RoomServer` (main process): manages WebSocket clients + HTTP file server
- IPC handlers expose: `room:create`, `room:close`, `room:getState`, `room:broadcastCmd`, `room:updatePlayback`, `room:copyInfo`
- Push event: `room:stateChanged` → renderer updates Sala.tsx player list

### Client (Player) side
- `EntrarNaSalaModal` (renderer): full client flow in 3 phases
  - Phase A (form): 6-char OTP code boxes + IP + player name
  - Phase B (connecting): connect → JOIN → WELCOME → download tracks → SYNCING → READY → sync steps UI
  - Phase C (session): full-screen read-only player view (cover, EQ bars, progress, volume)
- WebSocket is native browser `WebSocket` in renderer (no IPC needed)
- Downloads tracks via `fetch('http://{ip}:{port}/files/{trackId}')` → ArrayBuffer → Web Audio

### Clock sync
- PING sent by host every 3s with `t1 = Date.now()`
- Client: `clockOffset = t1 - Date.now()` (rough; good enough for ~120ms syncBuffer)
- CMD execution: `delay = Math.max(0, atHostTime - clockOffset - Date.now())`

### Host broadcasting (Player.tsx)
- `roomActiveRef` tracks if session active
- `broadcastCmd(cmd)` → `room.broadcastCmd` if active
- `updateRoomPlayback(overrides)` → `room.updatePlayback` (state for late-joiners)
- Broadcasts: LOAD_TRACK, PLAY, PAUSE, SEEK, SET_LOOP

## Commands (host → clients via CMD messages)
| Command | Payload |
|---------|---------|
| LOAD_TRACK | `{ trackId }` |
| PLAY | `{ positionMs, loopMode }` |
| PAUSE | — |
| SEEK | `{ positionMs }` |
| SET_LOOP | `{ loopMode }` |
| END_SESSION | — |

## RoomPlaybackState.loopMode encoding
- `'none'` — play through once
- `'full'` — loop entire track
- `{ startMs, endMs, fadeInMs, fadeOutMs }` — named loop region

## Next spec: SDD 05
