# SDD 03 — Player — Session Context

**Status:** Implementation complete, typecheck passing.  
**Branch:** develop  
**Spec:** `specs/03-player.md`

---

## What was built

All requirements from SDD 03 implemented. 3 files changed/created:

### AudioEngine (`src/renderer/src/audio/AudioEngine.ts`)
Full rewrite to support fades, pending loop state, and track-end callback:
- **Per-source GainNode** (`srcGain`) — enables scheduled fade-in/fade-out per play call
- **`play(opts, fadeInMs)`** — accepts optional fade-in; creates perGain → masterGain chain
- **`scheduleLoopChange(newLoop, { crossfade? })`** — enhanced with:
  - Schedules fade-out on current region's gain node via `linearRampToValueAtTime`
  - Crossfade: starts new source `overlap = min(fadeIn, fadeOut)` ms early
  - Sequential fades: waits full `remaining` ms before switching
  - Sets `_pendingLoop` for UI state
- **`setOnTrackEnded(cb)`** — called when a 'none'-mode track finishes naturally
- **`pendingLoop`** added to `AudioState` interface and `getState()`
- `loadTrack()` clears `_pendingLoop` on new load

### Player (`src/renderer/src/screens/Player.tsx` + `Player.css`)
Full implementation (~280 lines TSX, ~280 lines CSS):
- Two-column layout: left = Now Playing, right = Campaign/Queue
- Campaign cover: large radial gradient (same pattern as Campanhas)
- Loop badge: text + accent color when playing
- EQ animation: 5 spans with CSS `animation-play-state: running/paused`
- Progress bar: pointer capture drag-to-seek (click/drag anywhere)
- Transport: prev-loop (SkipBack), play/pause, next-loop (SkipForward)
- Volume: range input + persist in `player_volume` setting
- Loop chooser grid: Sem Loop, Faixa em Loop, named loops with color dots
- Pending loop: pulsing button + "Aguardando fim da região…" hint
- Campaign selector: `<select>` + persist in `player_campaign_id`
- Track queue: numbered list with "Tocando agora"/"Na fila" status
- Autoplay: `setOnTrackEnded` callback advances to next track (wraps)
- Settings persistence: volume + last campaign ID via `app_settings`
- Load race protection: `loadCounterRef` — only latest load triggers play

---

## Key design decisions

- **`displayActive`**: when playing → use `engine.activeLoop`; when paused → use component `loopMode` state
- **Autoplay behavior**: manual track click = start immediately; campaign select/initial load = load paused
- **Prev/next loop navigation** (QA-03-02): cycles through named loops only
- **Pending loop visual** (QA-03-06): pulsing animation on pending button + text hint
- **No new IPC handlers**: Player reads campaigns/tracks/loops via existing channels

---

## Requirements implemented

- PLAY-RF-01: Play/Pause ✓
- PLAY-RF-02: Progress bar seek ✓
- PLAY-RF-03: Volume ✓
- PLAY-RF-04: Campaign selector ✓
- PLAY-RF-05: Track queue ✓
- PLAY-RF-06: Loop selector (Sem Loop, Faixa em Loop, named) ✓
- PLAY-RF-07: Prev/next loop ✓
- PLAY-RF-08: Badge + checks ✓
- PLAY-RF-09: Default Sem Loop ✓
- PLAY-RF-10/11: Autoplay + wrap ✓
- PLAY-RF-12: New track defaults to Sem Loop ✓
- PLAY-RN-01: Wait for region end ✓ (scheduleLoopChange)
- PLAY-RN-02: Fades on transition ✓ (via srcGain ramp)
- PLAY-RN-03: Crossfade setting ✓ (reads `crossfade_loops`)
- PLAY-RN-06: Pending visual ✓ (pulsing + hint text)

---

## Open questions from spec

- QA-03-04: Persists volume + last campaign ✓ (implemented)
- QA-03-02: Prev/next navigates named loops only (decided)
- QA-03-05: No region active → immediate switch (implemented in engine else branch)
- QA-03-06: Pulsing pending button + text hint (implemented)

---

## Next steps

Next spec is **SDD 04 — Sala** (`specs/04-sala.md`). Depends on Player being complete.

---

## Verification commands

```bash
npm run typecheck   # must pass clean
npm run dev         # start app
```

Expected behavior:
1. Player screen shows campaign cover + track info
2. Play/pause + progress bar seek works
3. Loop chooser changes loop mode, scheduled transition shown as pulsing pending button
4. Track queue: click any track → loads + plays
5. Autoplay: track ends in Sem Loop mode → next track starts automatically
6. Campaign selector → changes queue + loads first track
