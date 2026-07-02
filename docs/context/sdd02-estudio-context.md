# SDD 02 — Estúdio — Session Context

**Status:** Implementation complete, typecheck passing.  
**Branch:** develop  
**Spec:** `specs/02-estudio.md`

---

## What was built

All requirements from SDD 02 implemented. 6 files changed/created:

### Main process
- **`src/main/ipc-handlers.ts`** — Added loops + tracks IPC handlers:
  - `loopsGetByTrack(db, trackId)` — list loops ordered by order_index
  - `loopsSaveAll(db, trackId, loopsData[])` — delete-all + reinsert atomically, updates track+campaign updated_at
  - `tracksRename(db, trackId, title)` — EST-RF-15
  - `tracksGetWaveformPeaks(db, trackId)` → number[] | null (JSON stored in BLOB column)
  - `tracksSaveWaveformPeaks(db, trackId, peaks[])` — persist computed peaks
  - `tracksUpdateDuration(db, trackId, durationMs)` — fills null duration_ms after decode
  - IPC channels: `loops:getByTrack`, `loops:saveAll`, `tracks:rename`, `tracks:getWaveformPeaks`, `tracks:saveWaveformPeaks`, `tracks:updateDuration`

### Renderer
- **`src/renderer/src/audio/AudioEngine.ts`** — Added `seek(ms)` method; `loadTrack` now returns `Promise<AudioBuffer>` for external peak calculation
- **`src/preload/index.ts`** — Added `soundsmith.loops` and `soundsmith.tracks` namespaces
- **`src/renderer/src/types/soundsmith.d.ts`** — Added `Loop`, `LoopInput` types; added loops/tracks to Window interface
- **`src/renderer/src/screens/Estudio.tsx`** — Full implementation (~500 lines):
  - Campaign → Track cascaded selection
  - Waveform canvas (peaks-based, ResizeObserver for canvas sizing)
  - Loop bands as positioned divs with drag handles (ew-resize, EST-RF-09b)
  - Playhead as positioned div, updated via RAF
  - Ruler with dynamic tick intervals based on duration + zoom
  - Transport: play/pause/stop, time display, volume slider
  - Waveform click-to-seek
  - Loop CRUD: create (smart gap finding), select, edit, delete (with confirm)
  - Loop properties panel: name, color swatches, start/end TimeInput, fade-in/out, notes, preview
  - Loop list: drag-to-reorder, color dot, name, range, duration
  - Save: validates no overlaps + end>start + fades≤duration, batch saveAll
  - Unsaved changes: window.confirm() guard on track switch
  - Track rename inline (EST-RF-15)
- **`src/renderer/src/screens/Estudio.css`** — Styles

---

## Key design decisions

- **Waveform peaks**: calculated in renderer via `calcPeaks(AudioBuffer)`, stored as JSON in BLOB column, loaded on track select
- **Audio loading**: `fetch('file:///...')` in renderer — works in Electron without IPC file-read
- **Loop bands**: CSS-positioned divs over canvas (not drawn on canvas) for easy mouse interaction
- **Loop drag**: global mousemove listener during drag, clamps at neighboring loop boundaries (EST-RN-03)
- **Waveform canvas**: `ResizeObserver` keeps canvas pixel dimensions synced with CSS layout
- **Save strategy**: local edit state, batch saveAll on Save button (not autosave)

---

## Open questions from spec (not blocking)

- **QA-02-02**: Loop order has no functional effect yet (Player TBD in SDD 03)
- **QA-02-03**: Default duration = 30s (implemented), name = "Loop N"
- **QA-02-04**: Manual save (button) — no autosave
- **QA-02-05**: Zoom not persisted per track
- **QA-02-07**: Notes are Mestre-only (not shown to players)
- **QA-02-08**: No snap-to-grid on drag; free positioning

---

## Next steps

Next spec is **SDD 03 — Player** (`specs/03-player.md`). It depends on Campanhas (SDD 01) and Estúdio (SDD 02) being complete.

To continue in a new session:
1. Read `specs/03-player.md`
2. Read `src/renderer/src/screens/Player.tsx` (currently placeholder)
3. Verify SDD 02 by running `npm run dev` and navigating to Estúdio screen

---

## Verification commands

```bash
npm run typecheck   # must pass clean
npm run dev         # start app
```

Expected behavior:
1. Estúdio screen shows campaign + track dropdowns
2. Select campaign with tracks → track loads, waveform renders
3. "Criar Loop" → band appears on waveform, loop in list
4. Click loop band → selects it, properties panel populates
5. Drag band edges → loop start/end update, clamped at neighbors
6. Edit name/color/start/end/fades → dirty flag → Save activates
7. Save → loops persisted, dirty cleared
8. Transport play/pause/stop + seek by clicking waveform
9. Preview loop → AudioEngine plays loop region with fades
