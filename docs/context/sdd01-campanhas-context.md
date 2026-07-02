# SDD 01 — Campanhas — Session Context

**Status:** Implementation complete, typecheck passing.  
**Branch:** develop  
**Spec:** `specs/01-campanhas.md`

---

## What was built

All requirements from SDD 01 implemented. 7 files changed/created:

### Main process
- **`src/main/ipc-handlers.ts`** — Added campaign IPC handlers. New exports:
  - `generateCampaignInitials(name)` — skips PT stop words (a/as/o/de/da/etc), returns 2 uppercase chars
  - `campaignsList(db)` — LEFT JOIN with tracks, returns `CampaignWithCount[]` ordered by `updated_at DESC`
  - `campaignsCreate(db, sender, name, filePaths)` — creates campaign, copies files via `importTrack()`, emits `campaigns:import:progress` events
  - `campaignsUpdate(db, id, name)` — rename + recalculate initials
  - `campaignsDelete(db, id)` — CASCADE via SQLite + `rm(library/<id>/)` 
  - `campaignsGetTracks(db, campaignId)` — ordered by `order_index`
  - `campaignsAddTracks(db, sender, campaignId, filePaths)` — adds to existing campaign
  - `campaignsRemoveTrack(db, trackId)` — deletes record + `unlinkSync(file_path)`
  - `campaignsReorderTracks(db, campaignId, orderedTrackIds[])` — batch `order_index` update
  - `campaignsRenameTrack(db, trackId, title)` — updates title + campaign `updated_at`
  - IPC channels registered: `campaigns:list`, `campaigns:create`, `campaigns:update`, `campaigns:delete`, `campaigns:getTracks`, `campaigns:addTracks`, `campaigns:removeTrack`, `campaigns:reorderTracks`, `campaigns:renameTrack`, `campaigns:openAudioFilesDialog`

- **`src/preload/index.ts`** — Added `soundsmith.campaigns` namespace with all 11 methods

### Renderer types
- **`src/renderer/src/types/soundsmith.d.ts`** — Added `Campaign`, `CampaignWithCount`, `Track`, `ImportProgress`, `AudioFileInfo` interfaces; added `soundsmith.campaigns` to `Window` declaration

### Renderer screens
- **`src/renderer/src/screens/Campanhas.tsx`** — Full screen: grid of cards, create/edit/delete, relative time display
- **`src/renderer/src/screens/Campanhas.css`** — Campaign grid, card with gradient cover, dashed "new" card

### Modals
- **`src/renderer/src/modals/CampanhaModal.tsx`** — Create + edit modal: name input, drag-drop upload zone, staged file list, existing tracks (edit mode) with drag-reorder, inline rename, remove with confirm, import progress bar
- **`src/renderer/src/modals/CampanhaModal.css`** — Modal styles

---

## Open questions from spec (not blocking, but not resolved)

- **QA-01-01**: Using "MV" style (stop words skipped) — matches prototype
- **QA-01-02**: Auto palette (rotative by count), not choosable
- **QA-01-04**: Duplicate names allowed
- **QA-01-05**: Empty campaigns allowed (CAMP-RN-07)
- **QA-01-06**: No file size/count limit

---

## What's NOT done (out of spec or deferred)

- **Audio metadata extraction** (duration_ms, sample_rate, channels): stored as `NULL`. Requires `music-metadata` npm package or ffprobe. Not blocked — spec marks these fields nullable.
- **CAMP-CA-06** progress visible: progress bar renders in modal but file copy speed for typical audio files (~5-50MB) is near-instant locally. Visible on large WAV files.

---

## Next steps

Next spec is **SDD 02 — Estúdio** (`specs/02-estudio.md`). It depends on Campanhas being complete (track data + `file_path` available).

To continue in a new session:
1. Read `specs/02-estudio.md`
2. Read `src/renderer/src/screens/Estudio.tsx` (currently placeholder)
3. Verify SDD 01 by running the app with `npm run dev`

---

## Verification commands

```bash
npm run typecheck        # must pass clean
npm run dev              # start app, navigate to Campanhas screen
```

Expected behavior:
1. Campanhas screen shows empty state with "Criar primeira campanha" button
2. "Nova Campanha" opens modal with name input + upload zone
3. Drag MP3/WAV/FLAC/OGG onto zone → appears in staged list with size
4. Drag .txt → rejected with warning
5. "Criar Campanha" → card appears in grid with gradient cover + initials
6. Edit icon → modal opens pre-populated with existing tracks
7. Delete icon → confirm buttons appear → campaign removed from grid + library/<id>/ deleted
